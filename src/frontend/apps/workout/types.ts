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
