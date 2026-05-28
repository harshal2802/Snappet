// Types mirror the Free Exercise DB shape (yuhonas/free-exercise-db).
// `force` and `mechanic` are nullable in the source data.

export type ExerciseCategory =
  | 'strength'
  | 'cardio'
  | 'stretching'
  | 'plyometrics'
  | 'powerlifting'
  | 'olympic weightlifting'
  | 'strongman'

export type ExerciseLevel = 'beginner' | 'intermediate' | 'expert'

export type Force = 'pull' | 'push' | 'static' | null
export type Mechanic = 'compound' | 'isolation' | null

export type Muscle =
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'forearms'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lower back'
  | 'middle back'
  | 'neck'
  | 'quadriceps'
  | 'shoulders'
  | 'traps'
  | 'triceps'

export type Equipment =
  | 'body only'
  | 'machine'
  | 'other'
  | 'foam roll'
  | 'kettlebells'
  | 'dumbbell'
  | 'cable'
  | 'barbell'
  | 'bands'
  | 'medicine ball'
  | 'exercise ball'
  | 'e-z curl bar'

export interface Exercise {
  id: string
  name: string
  force: Force
  level: ExerciseLevel
  mechanic: Mechanic
  equipment: Equipment
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  instructions: string[]
  category: ExerciseCategory
  images: string[]
}

export interface ExerciseFilters {
  categories: Set<ExerciseCategory>
  levels: Set<ExerciseLevel>
  equipment: Set<Equipment>
  muscles: Set<Muscle>
}

// Serializable shape for localStorage.
export interface ExerciseFiltersSerialized {
  categories: ExerciseCategory[]
  levels: ExerciseLevel[]
  equipment: Equipment[]
  muscles: Muscle[]
}

// ── Phase 2: Routines ───────────────────────────────────────────────────────

export type WeightUnit = 'kg' | 'lb'

export interface RoutineExercise {
  // ID from Free Exercise DB (matches Exercise.id).
  exerciseId: string
  // Target sets, 1..20.
  sets: number
  // Reps stored as a string so users can type "8-12", "AMRAP", "30s", etc.
  reps: string
  // Rest between sets in seconds. 0 = no rest.
  restSeconds: number
  // Target weight (optional — blank/zero means bodyweight or no specific load).
  weight?: number
  weightUnit?: WeightUnit
  // Free-form notes.
  notes?: string
  // User-provided override for the displayed name. Falls back to Exercise.name.
  displayName?: string
}

export interface RoutineDefaults {
  sets?: number
  reps?: string
  restSeconds?: number
  weightUnit?: WeightUnit
}

// ── Sport-tagged routines (issue #35) ────────────────────────────────────
// 'general' is the implicit bucket for user-created routines and pre-#35
// starter routines; new sport keys can be added without code changes
// elsewhere as long as RoutineList/Filter rows mention them.
export type SportTag = 'general' | 'climbing' | 'calisthenics'

export type RoutineLevel = 'beginner' | 'intermediate' | 'advanced'

export interface RoutineSource {
  label: string
  url?: string
}

export interface Routine {
  id: string
  name: string
  exercises: RoutineExercise[]
  createdAt: number
  updatedAt: number
  // Marks routines seeded from `starters.ts`. UI may treat slightly differently
  // (e.g. show a "Starter" pill). Users can delete starters — they don't
  // re-seed; the `snappet:workout:starters-seeded` flag guards that.
  isStarter?: boolean
  // Phase 5b — optional defaults inherited by newly picked exercises in the
  // editor. Existing rows are never auto-updated; user explicitly applies
  // via the per-row ⇪ icon. Absent until the user saves a routine through
  // the editor at least once.
  defaults?: RoutineDefaults
  // Issue #35 — sport-tagged metadata. All optional; absence treated as
  // 'general' / unspecified by filtering UI.
  sport?: SportTag
  level?: RoutineLevel
  tags?: string[]
  description?: string
  source?: RoutineSource
}

// ── Phase 3: Sessions ───────────────────────────────────────────────────────

export interface SetLog {
  // Actual reps performed; undefined = set not completed.
  actualReps?: number
  // Actual weight; optional (bodyweight or skipped logging).
  actualWeight?: number
  weightUnit?: WeightUnit
  completedAt?: number
}

export interface SessionExercise {
  exerciseId: string
  // Snapshots of the routine's targets at session-start so routine edits
  // mid-session don't corrupt the active log.
  targetSets: number
  targetReps: string
  targetRestSeconds: number
  targetWeight?: number
  targetWeightUnit?: WeightUnit
  // Length always === targetSets; empty {} = pending, populated = completed.
  sets: SetLog[]
  // True if user explicitly skipped the remaining sets of this exercise.
  skipped?: boolean
  // Snapshot of RoutineExercise.displayName at session start, so renaming the
  // routine later doesn't retroactively change historic session labels.
  displayName?: string
}

export interface WorkoutSession {
  id: string
  routineId: string
  // Snapshot — routine may be renamed/deleted after the session starts.
  routineName: string
  startedAt: number
  // Set when user taps Finish or the last set completes naturally.
  completedAt?: number
  exercises: SessionExercise[]
}
