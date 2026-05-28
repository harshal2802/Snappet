import type {
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseLevel,
  Force,
  Mechanic,
  Muscle,
} from './types'
import { generateId } from './utils'

export const CUSTOM_EXERCISES_KEY = 'snappet:workout:custom-exercises'

// Canonical option arrays for exercise fields. Shared by the ExerciseEditor's
// chip rows and the ExerciseBrowser / ExercisePicker filter rows (single
// source of truth — don't redefine these locally). The `null`-able Force /
// Mechanic lists are editor-only (the browser/picker don't filter on them).
export const ALL_CATEGORIES: ExerciseCategory[] = [
  'strength',
  'cardio',
  'stretching',
  'plyometrics',
  'powerlifting',
  'olympic weightlifting',
  'strongman',
]

export const ALL_LEVELS: ExerciseLevel[] = ['beginner', 'intermediate', 'expert']

export const ALL_EQUIPMENT: Equipment[] = [
  'body only',
  'dumbbell',
  'barbell',
  'cable',
  'machine',
  'kettlebells',
  'bands',
  'medicine ball',
  'exercise ball',
  'foam roll',
  'e-z curl bar',
  'other',
]

export const ALL_MUSCLES: Muscle[] = [
  'abdominals',
  'biceps',
  'triceps',
  'chest',
  'shoulders',
  'forearms',
  'lats',
  'middle back',
  'lower back',
  'traps',
  'neck',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abductors',
  'adductors',
]

// Non-null choices; the editor adds a "None" option that maps to null.
export const ALL_FORCE: Exclude<Force, null>[] = ['pull', 'push', 'static']
export const ALL_MECHANIC: Exclude<Mechanic, null>[] = ['compound', 'isolation']

// Prefix keeps custom ids from ever colliding with DB slugs (long hyphenated
// names) and makes them identifiable in routine/history references without a
// catalog lookup.
export function newCustomExerciseId(): string {
  return `custom-${generateId()}`
}

// Build a blank custom exercise (used by "+ New exercise") or seed from a DB
// exercise (used by "Customize"). When seeding, copy the source's fields but
// always assign a fresh id, set isCustom, and drop the CDN images.
export function makeCustomExercise(seed?: Partial<Exercise>): Exercise {
  return {
    id: newCustomExerciseId(),
    name: seed?.name ? `${seed.name} (custom)` : '',
    force: seed?.force ?? null,
    level: seed?.level ?? 'beginner',
    mechanic: seed?.mechanic ?? null,
    equipment: seed?.equipment ?? 'body only',
    primaryMuscles: seed?.primaryMuscles ? [...seed.primaryMuscles] : [],
    secondaryMuscles: seed?.secondaryMuscles ? [...seed.secondaryMuscles] : [],
    instructions: seed?.instructions ? [...seed.instructions] : [],
    category: seed?.category ?? 'strength',
    images: [], // custom exercises have no CDN images in v1
    isCustom: true,
  }
}

// Custom first (easy to find, top of the list), then the DB catalog.
export function mergeCatalog(db: Exercise[], custom: Exercise[]): Exercise[] {
  return [...custom, ...db]
}
