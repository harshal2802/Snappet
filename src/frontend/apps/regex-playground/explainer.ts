import type { ExplainerToken } from './types'

/**
 * Walk a regex pattern string and produce plain-English explanations
 * for each recognized token.
 */
export function explainPattern(pattern: string): ExplainerToken[] {
  const tokens: ExplainerToken[] = []
  let i = 0
  let groupCounter = 0

  while (i < pattern.length) {
    const ch = pattern[i]

    // ── Escape sequences (\d, \w, \s, \b, \B, etc.) ──
    if (ch === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1]
      const escapeMap: Record<string, string> = {
        d: 'Any digit (0-9)',
        D: 'Any non-digit',
        w: 'Any word character (a-z, A-Z, 0-9, _)',
        W: 'Any non-word character',
        s: 'Any whitespace',
        S: 'Any non-whitespace',
        b: 'Word boundary',
        B: 'Non-word boundary',
        n: 'Newline',
        r: 'Carriage return',
        t: 'Tab',
        f: 'Form feed',
        v: 'Vertical tab',
        '0': 'Null character',
      }
      if (escapeMap[next]) {
        tokens.push({ token: `\\${next}`, description: escapeMap[next] })
        i += 2
        continue
      }
      // Back-references \1-\9
      if (next >= '1' && next <= '9') {
        tokens.push({
          token: `\\${next}`,
          description: `Back-reference to group #${next}`,
        })
        i += 2
        continue
      }
      // Escaped literal character
      tokens.push({
        token: `\\${next}`,
        description: `Literal "${next}"`,
      })
      i += 2
      continue
    }

    // ── Character classes [...] ──
    if (ch === '[') {
      let j = i + 1
      let classContent = '['
      const negated = j < pattern.length && pattern[j] === '^'
      if (negated) {
        classContent += '^'
        j++
      }
      // Allow ] as the first char inside the class
      if (j < pattern.length && pattern[j] === ']') {
        classContent += ']'
        j++
      }
      while (j < pattern.length && pattern[j] !== ']') {
        if (pattern[j] === '\\' && j + 1 < pattern.length) {
          classContent += pattern[j] + pattern[j + 1]
          j += 2
        } else {
          classContent += pattern[j]
          j++
        }
      }
      if (j < pattern.length) {
        classContent += ']'
        j++
      }
      const inner = classContent.slice(1, -1)
      const prefix = negated ? 'Any character NOT in' : 'Any character in'
      const desc = describeCharClass(inner, negated)
      tokens.push({
        token: classContent,
        description: desc || `${prefix}: ${inner}`,
      })
      i = j
      continue
    }

    // ── Groups (?:...), (?=...), (?!...), (?<=...), (?<!...), (?<name>...), (...) ──
    if (ch === '(') {
      if (pattern[i + 1] === '?') {
        // Non-capturing group (?:
        if (pattern[i + 2] === ':') {
          tokens.push({
            token: '(?:',
            description: 'Non-capturing group',
          })
          i += 3
          continue
        }
        // Positive lookahead (?=
        if (pattern[i + 2] === '=') {
          tokens.push({
            token: '(?=',
            description: 'Positive lookahead',
          })
          i += 3
          continue
        }
        // Negative lookahead (?!
        if (pattern[i + 2] === '!') {
          tokens.push({
            token: '(?!',
            description: 'Negative lookahead',
          })
          i += 3
          continue
        }
        // Positive lookbehind (?<=
        if (pattern[i + 2] === '<' && pattern[i + 3] === '=') {
          tokens.push({
            token: '(?<=',
            description: 'Positive lookbehind',
          })
          i += 4
          continue
        }
        // Negative lookbehind (?<!
        if (pattern[i + 2] === '<' && pattern[i + 3] === '!') {
          tokens.push({
            token: '(?<!',
            description: 'Negative lookbehind',
          })
          i += 4
          continue
        }
        // Named group (?<name>
        if (pattern[i + 2] === '<') {
          let j = i + 3
          let name = ''
          while (j < pattern.length && pattern[j] !== '>') {
            name += pattern[j]
            j++
          }
          if (j < pattern.length) j++ // skip >
          groupCounter++
          tokens.push({
            token: `(?<${name}>`,
            description: `Named capturing group "${name}" (#${groupCounter})`,
          })
          i = j
          continue
        }
        // Fallback: unknown (? construct
        tokens.push({ token: '(?', description: 'Group modifier' })
        i += 2
        continue
      }
      // Plain capturing group
      groupCounter++
      tokens.push({
        token: '(',
        description: `Capturing group #${groupCounter}`,
      })
      i++
      continue
    }

    if (ch === ')') {
      tokens.push({ token: ')', description: 'End of group' })
      i++
      continue
    }

    // ── Quantifiers {n}, {n,}, {n,m} ──
    if (ch === '{') {
      let j = i + 1
      let quant = '{'
      while (j < pattern.length && pattern[j] !== '}') {
        quant += pattern[j]
        j++
      }
      if (j < pattern.length) {
        quant += '}'
        j++
      }
      const inner = quant.slice(1, -1)
      let desc: string
      if (inner.includes(',')) {
        const parts = inner.split(',')
        const min = parts[0].trim()
        const max = parts[1].trim()
        if (max === '') {
          desc = `${min} or more times`
        } else {
          desc = `Between ${min} and ${max} times`
        }
      } else {
        desc = `Exactly ${inner} times`
      }
      // Check for lazy modifier
      if (j < pattern.length && pattern[j] === '?') {
        desc += ' (lazy)'
        quant += '?'
        j++
      }
      tokens.push({ token: quant, description: desc })
      i = j
      continue
    }

    // ── Simple metacharacters ──
    if (ch === '.') {
      tokens.push({ token: '.', description: 'Any character except newline' })
      i++
      continue
    }
    if (ch === '^') {
      tokens.push({ token: '^', description: 'Start of string' })
      i++
      continue
    }
    if (ch === '$') {
      tokens.push({ token: '$', description: 'End of string' })
      i++
      continue
    }
    if (ch === '|') {
      tokens.push({ token: '|', description: 'OR' })
      i++
      continue
    }

    // ── Quantifiers +, *, ? ──
    if (ch === '+') {
      let token = '+'
      let desc = 'One or more'
      if (i + 1 < pattern.length && pattern[i + 1] === '?') {
        token = '+?'
        desc = 'One or more (lazy)'
        i++
      }
      tokens.push({ token, description: desc })
      i++
      continue
    }
    if (ch === '*') {
      let token = '*'
      let desc = 'Zero or more'
      if (i + 1 < pattern.length && pattern[i + 1] === '?') {
        token = '*?'
        desc = 'Zero or more (lazy)'
        i++
      }
      tokens.push({ token, description: desc })
      i++
      continue
    }
    if (ch === '?') {
      let token = '?'
      let desc = 'Zero or one (optional)'
      if (i + 1 < pattern.length && pattern[i + 1] === '?') {
        token = '??'
        desc = 'Zero or one (lazy)'
        i++
      }
      tokens.push({ token, description: desc })
      i++
      continue
    }

    // ── Literal character ──
    tokens.push({ token: ch, description: `Literal "${ch}"` })
    i++
  }

  return tokens
}

/** Produce human-readable descriptions for common character classes */
function describeCharClass(inner: string, negated: boolean): string | null {
  const content = negated ? inner.slice(1) : inner

  const knownClasses: Record<string, string> = {
    'a-z': 'Any lowercase letter (a-z)',
    'A-Z': 'Any uppercase letter (A-Z)',
    'a-zA-Z': 'Any letter (a-z, A-Z)',
    '0-9': 'Any digit (0-9)',
    'a-zA-Z0-9': 'Any alphanumeric character',
    'a-z0-9': 'Any lowercase letter or digit',
    '\\d': 'Any digit (0-9)',
    '\\w': 'Any word character',
    '\\s': 'Any whitespace',
  }

  const match = knownClasses[content]
  if (match) {
    return negated ? match.replace('Any', 'Any character NOT') : match
  }

  // Build description from ranges and literals
  const prefix = negated ? 'Not any of' : 'Any of'
  return `${prefix}: ${content}`
}
