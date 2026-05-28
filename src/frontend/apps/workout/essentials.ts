// Curated subset of Free Exercise DB, ~100 entries. Default Browser view.
// Power users can toggle to "All exercises" (800-row catalog) at any time.
//
// Every ID below was verified to exist in public/exercises.json on 2026-05-28
// via a startup assert in dev mode (see ExerciseBrowser; a console.warn fires
// for any missing ID so dataset upgrades are caught early).

export const ESSENTIAL_EXERCISE_IDS: ReadonlyArray<string> = [
  // ── Chest (10) ───────────────────────────────────────────────────────────
  'Barbell_Bench_Press_-_Medium_Grip',
  'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Decline_Barbell_Bench_Press',
  'Dumbbell_Bench_Press',
  'Incline_Dumbbell_Press',
  'Decline_Dumbbell_Bench_Press',
  'Dumbbell_Flyes',
  'Cable_Crossover',
  'Pushups',
  'Dumbbell_Floor_Press',

  // ── Back / Pull (12) ─────────────────────────────────────────────────────
  'Pullups',
  'Chin-Up',
  'Bent_Over_Barbell_Row',
  'One-Arm_Dumbbell_Row',
  'Seated_Cable_Rows',
  'Wide-Grip_Lat_Pulldown',
  'Close-Grip_Front_Lat_Pulldown',
  'Inverted_Row',
  'T-Bar_Row_with_Handle',
  'Romanian_Deadlift',
  'Barbell_Deadlift',
  'Face_Pull',

  // ── Shoulders (8) ────────────────────────────────────────────────────────
  'Standing_Military_Press',
  'Dumbbell_Shoulder_Press',
  'Push_Press',
  'Side_Lateral_Raise',
  'Front_Dumbbell_Raise',
  'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench',
  'Upright_Barbell_Row',
  'Reverse_Flyes',

  // ── Biceps (6) ───────────────────────────────────────────────────────────
  'Barbell_Curl',
  'EZ-Bar_Curl',
  'Dumbbell_Bicep_Curl',
  'Hammer_Curls',
  'Preacher_Curl',
  'Concentration_Curls',

  // ── Triceps (6) ──────────────────────────────────────────────────────────
  'Tricep_Dumbbell_Kickback',
  'Bench_Dips',
  'Triceps_Pushdown',
  'EZ-Bar_Skullcrusher',
  'Close-Grip_Barbell_Bench_Press',
  'Standing_Dumbbell_Triceps_Extension',

  // ── Legs — quads / hamstrings (13) ───────────────────────────────────────
  'Barbell_Squat',
  'Front_Barbell_Squat',
  'Bodyweight_Squat',
  'Goblet_Squat',
  'Dumbbell_Squat',
  'Leg_Press',
  'Dumbbell_Lunges',
  'Barbell_Walking_Lunge',
  'Split_Squats',
  'Leg_Extensions',
  'Lying_Leg_Curls',
  'Stiff-Legged_Barbell_Deadlift',
  'Sumo_Deadlift',
  'Good_Morning',

  // ── Glutes (3) ───────────────────────────────────────────────────────────
  'Butt_Lift_Bridge',
  'Barbell_Hip_Thrust',
  'Barbell_Glute_Bridge',

  // ── Calves (2) ───────────────────────────────────────────────────────────
  'Standing_Calf_Raises',
  'Seated_Calf_Raise',

  // ── Core (12) ────────────────────────────────────────────────────────────
  'Plank',
  'Russian_Twist',
  'Crunches',
  'Reverse_Crunch',
  'Decline_Crunch',
  'Hanging_Leg_Raise',
  'Flat_Bench_Lying_Leg_Raise',
  'Ab_Roller',
  'Dead_Bug',
  'Mountain_Climbers',
  'Superman',
  'Hyperextensions_Back_Extensions',

  // ── Kettlebell / Olympic (6) ─────────────────────────────────────────────
  'One-Arm_Kettlebell_Swings',
  'Two-Arm_Kettlebell_Clean',
  'Kettlebell_Arnold_Press',
  'Power_Clean',
  'Clean_and_Jerk',
  'Snatch',

  // ── Cardio (4) ───────────────────────────────────────────────────────────
  'Running_Treadmill',
  'Rowing_Stationary',
  'Stairmaster',
  'Rope_Jumping',

  // ── Plyometrics (4) ──────────────────────────────────────────────────────
  'Box_Jump_Multiple_Response',
  'Knee_Tuck_Jump',
  'Lateral_Box_Jump',
  'Step-up_with_Knee_Raise',

  // ── Stretching / Mobility (10) ───────────────────────────────────────────
  'Cat_Stretch',
  'Worlds_Greatest_Stretch',
  'Hamstring_Stretch',
  'Calf_Stretch_Elbows_Against_Wall',
  'Arm_Circles',
  'Childs_Pose',
  'Standing_Toe_Touches',
  'Standing_Hamstring_and_Calf_Stretch',
  'Quad_Stretch',
  'Shoulder_Stretch',
]

export const ESSENTIAL_ID_SET = new Set<string>(ESSENTIAL_EXERCISE_IDS)
