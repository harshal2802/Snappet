// Pure, constrained autoregressive decoding for the climb generator — no
// onnxruntime, no React, so it unit-tests in Node. The model is injected as a
// `runLogits` function. This mirrors scripts/train_generator.py `generate()`:
// every sample is valid by construction (per-size hold mask + no duplicate
// placement + ≥1 start + ≥1 finish), independent of model quality.

export interface GradeModel {
  bias: number
  w_nomatch: number
  w_angle: number[]
  angle_index: Record<string, number>
  w_hold: number[]
  y_mean: number
}

export interface SizeInfo {
  id: number
  name: string
  box: [number, number, number, number]
}

export interface GenMeta {
  block: number
  pad: number
  specials: { BOS: number; EOS: number; PAD: number; MATCH: number; NOMATCH: number }
  firstHoldId: number
  itos: string[]
  sizes: SizeInfo[]
  placements: { id: number; x: number; y: number }[]
  roles: { id: number; name: string; color: string }[]
  sizeMasks: Record<string, number[]>
  sizeNames: Record<string, string>
  gradeModel: GradeModel
  grades: number[]
  gradeLabels: Record<string, string>
  angles: number[]
  defaultSize: number
}

export interface GenOptions {
  sizeId: number
  angle: number
  grade: number
  nomatch: boolean
  temperature?: number
  maxHolds?: number
  minHolds?: number
}

/** Next-token logits at the LAST position of `tokens` (length = vocab). */
export type RunLogits = (tokens: number[]) => Promise<Float32Array> | Float32Array

export interface Prepared {
  stoi: Map<string, number>
  placementOf: Map<number, number>
  roleOf: Map<number, number>
  roleName: Map<number, string>
}

/** Index the vocab once: token strings → ids, and HOLD token → (placement, role). */
export function prepare(meta: GenMeta): Prepared {
  const stoi = new Map<string, number>()
  const placementOf = new Map<number, number>()
  const roleOf = new Map<number, number>()
  meta.itos.forEach((t, i) => {
    stoi.set(t, i)
    if (t.startsWith('HOLD_')) {
      const parts = t.split('_')
      placementOf.set(i, Number(parts[1]))
      roleOf.set(i, Number(parts[2]))
    }
  })
  const roleName = new Map<number, string>(meta.roles.map((r) => [r.id, r.name]))
  return { stoi, placementOf, roleOf, roleName }
}

/** Sample one id from already-temperature-scaled logits over the eligible tokens. */
function sample(logits: number[], ids: number[], rand: () => number): number {
  let max = -Infinity
  for (const v of logits) if (v > max) max = v
  let sum = 0
  const probs = logits.map((v) => {
    const e = Math.exp(v - max)
    sum += e
    return e
  })
  let r = rand() * sum
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i]
    if (r <= 0) return ids[i]
  }
  return ids[ids.length - 1]
}

export interface GeneratedClimb {
  holds: number[] // hold token ids, in climbing order
  frames: string // "p<placement>r<role>…" for the board renderer
}

export async function decodeClimb(
  meta: GenMeta,
  prep: Prepared,
  opts: GenOptions,
  runLogits: RunLogits,
  rand: () => number = Math.random,
): Promise<GeneratedClimb> {
  const temp = opts.temperature ?? 0.9
  const maxHolds = opts.maxHolds ?? 20
  const minHolds = opts.minHolds ?? 4
  const { stoi, placementOf, roleOf, roleName } = prep
  const eos = meta.specials.EOS
  const allowed = meta.sizeMasks[String(opts.sizeId)]
  if (!allowed) throw new Error(`no hold mask for size ${opts.sizeId}`)
  const tok = (s: string): number => {
    const id = stoi.get(s)
    if (id === undefined) throw new Error(`unknown token ${s}`)
    return id
  }
  const matchTok = opts.nomatch ? meta.specials.NOMATCH : meta.specials.MATCH
  const seq = [meta.specials.BOS, tok(`SIZE_${opts.sizeId}`), tok(`ANGLE_${opts.angle}`),
    tok(`GRADE_${opts.grade}`), matchTok]
  const used = new Set<number>()
  const holds: number[] = []
  let haveStart = false
  let haveFinish = false

  for (let step = 0; step < maxHolds; step++) {
    const logits = await runLogits(seq.slice(-meta.block))
    const eligible = haveStart && haveFinish && holds.length >= minHolds
    const ids: number[] = []
    const vals: number[] = []
    for (const t of allowed) {
      if (t === eos) {
        if (eligible) {
          ids.push(t)
          vals.push(logits[t] / temp)
        }
      } else if (!used.has(placementOf.get(t)!)) {
        ids.push(t)
        vals.push(logits[t] / temp)
      }
    }
    if (!ids.length) break
    const next = sample(vals, ids, rand)
    if (next === eos) break
    seq.push(next)
    holds.push(next)
    used.add(placementOf.get(next)!)
    const rn = roleName.get(roleOf.get(next)!)
    if (rn === 'start') haveStart = true
    if (rn === 'finish') haveFinish = true
  }

  // Guarantee validity even from a weak model (mirrors generate()'s repair).
  const sorted = [...allowed].sort((a, b) => a - b)
  for (const [need, missing] of [['start', !haveStart], ['finish', !haveFinish]] as const) {
    if (!missing) continue
    for (const t of sorted) {
      if (t !== eos && !used.has(placementOf.get(t) ?? -1) && roleName.get(roleOf.get(t)!) === need) {
        holds.push(t)
        used.add(placementOf.get(t)!)
        break
      }
    }
  }

  const frames = holds.map((t) => `p${placementOf.get(t)}r${roleOf.get(t)}`).join('')
  return { holds, frames }
}

/** Linear grade estimate for a climb (scripts/train_grade_predictor.py). */
export function predictGrade(gm: GradeModel, holds: number[], angle: number, nomatch: boolean): number {
  const ai = gm.angle_index[String(angle)]
  let v = gm.bias + gm.w_nomatch * (nomatch ? 1 : 0) + (ai !== undefined ? gm.w_angle[ai] : 0)
  for (const t of holds) v += gm.w_hold[t] ?? 0
  return v + gm.y_mean
}

export type RerankedClimb = GeneratedClimb & { predictedGrade: number }

/** Sample `n` candidates; keep the one the grade model rates closest to target. */
export async function generateReranked(
  meta: GenMeta,
  prep: Prepared,
  opts: GenOptions,
  runLogits: RunLogits,
  n: number,
  rand: () => number = Math.random,
): Promise<RerankedClimb> {
  let best: RerankedClimb | null = null
  for (let i = 0; i < Math.max(1, n); i++) {
    const c = await decodeClimb(meta, prep, opts, runLogits, rand)
    const pg = predictGrade(meta.gradeModel, c.holds, opts.angle, opts.nomatch)
    if (!best || Math.abs(pg - opts.grade) < Math.abs(best.predictedGrade - opts.grade)) {
      best = { ...c, predictedGrade: pg }
    }
  }
  return best!
}
