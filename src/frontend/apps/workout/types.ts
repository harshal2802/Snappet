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
}
