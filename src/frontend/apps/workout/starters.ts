import type { Routine } from './types'

// All exerciseId values verified against public/exercises.json via
// `jq -r '.[].id' src/frontend/public/exercises.json`.
//
// Stable string ids (not random) so re-renders are stable and tests can
// pin them; createdAt: 0 keeps starters sorting before user-created ones
// when sorting by createdAt ascending.

export const STARTER_ROUTINES: Routine[] = [
  {
    id: 'starter-beginner-full-body',
    name: 'Beginner Full Body',
    isStarter: true,
    createdAt: 0,
    updatedAt: 0,
    exercises: [
      { exerciseId: 'Bodyweight_Squat', sets: 3, reps: '12', restSeconds: 60 },
      { exerciseId: 'Pushups', sets: 3, reps: '10', restSeconds: 60 },
      { exerciseId: 'Inverted_Row', sets: 3, reps: '10', restSeconds: 60 },
      { exerciseId: 'Plank', sets: 3, reps: '30s', restSeconds: 45 },
      { exerciseId: 'Butt_Lift_Bridge', sets: 3, reps: '12', restSeconds: 45 },
    ],
  },
  {
    id: 'starter-upper-body-push',
    name: 'Upper Body Push',
    isStarter: true,
    createdAt: 0,
    updatedAt: 0,
    exercises: [
      { exerciseId: 'Pushups', sets: 4, reps: '8-12', restSeconds: 90 },
      { exerciseId: 'Dumbbell_Shoulder_Press', sets: 4, reps: '8-10', restSeconds: 90 },
      { exerciseId: 'Bench_Dips', sets: 3, reps: '10', restSeconds: 60 },
      { exerciseId: 'Side_Lateral_Raise', sets: 3, reps: '12', restSeconds: 45 },
    ],
  },
  {
    id: 'starter-upper-body-pull',
    name: 'Upper Body Pull',
    isStarter: true,
    createdAt: 0,
    updatedAt: 0,
    exercises: [
      { exerciseId: 'Pullups', sets: 4, reps: '6-10', restSeconds: 90 },
      { exerciseId: 'Dumbbell_Bicep_Curl', sets: 3, reps: '12', restSeconds: 60 },
      { exerciseId: 'Face_Pull', sets: 3, reps: '15', restSeconds: 45 },
    ],
  },
  {
    id: 'starter-lower-body',
    name: 'Lower Body',
    isStarter: true,
    createdAt: 0,
    updatedAt: 0,
    exercises: [
      { exerciseId: 'Goblet_Squat', sets: 4, reps: '10', restSeconds: 90 },
      { exerciseId: 'Dumbbell_Lunges', sets: 3, reps: '10 each leg', restSeconds: 60 },
      { exerciseId: 'Romanian_Deadlift', sets: 3, reps: '8-10', restSeconds: 90 },
      { exerciseId: 'Standing_Calf_Raises', sets: 3, reps: '15', restSeconds: 30 },
    ],
  },
  {
    id: 'starter-core-crusher',
    name: 'Core Crusher',
    isStarter: true,
    createdAt: 0,
    updatedAt: 0,
    exercises: [
      { exerciseId: 'Plank', sets: 3, reps: '45s', restSeconds: 45 },
      { exerciseId: 'Russian_Twist', sets: 3, reps: '20', restSeconds: 30 },
      { exerciseId: 'Dead_Bug', sets: 3, reps: '10 each side', restSeconds: 30 },
      { exerciseId: 'Flat_Bench_Lying_Leg_Raise', sets: 3, reps: '12', restSeconds: 45 },
    ],
  },
  {
    id: 'starter-mobility',
    name: '5-Minute Mobility',
    isStarter: true,
    createdAt: 0,
    updatedAt: 0,
    exercises: [
      { exerciseId: 'Cat_Stretch', sets: 1, reps: '60s', restSeconds: 0 },
      { exerciseId: 'Worlds_Greatest_Stretch', sets: 1, reps: '30s each side', restSeconds: 0 },
      { exerciseId: 'Hamstring_Stretch', sets: 1, reps: '30s each leg', restSeconds: 0 },
      { exerciseId: 'Arm_Circles', sets: 1, reps: '60s', restSeconds: 0 },
    ],
  },
]
