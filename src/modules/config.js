/* eslint-disable no-mixed-operators */

//////////////////////////////
// Configuration & Constants
//////////////////////////////

// Tunables (edit here)
export const TILE_PX = 32; // square tile side in source pixels
export const EDGE_SAMPLES = 8; // points sampled along each edge (perf lever)
export const RAY_DEPTH = 10; // pixels sampled inward (perf lever)
export const RAY_ANGLES_DEG = [-60, -30, 0, 30, 60]; // relative to inward normal

// Candidate search
export const K_BUCKET = 24; // candidates sampled from matching bucket
export const K_RANDOM = 16; // exploratory random candidates
export const TOURNAMENT_T = 8; // fallback A-pick: worst among T random positions

// Selection / acceptance
export const ESCAPE_MOVE_CHANCE = 0.1 / 100; // accept a non-improving best move rarely
export const TABU_STEPS = 50; // tiles moved in last TABU_STEPS are penalized
export const TABU_OVERRIDE = -0.1; // allow tabu move if improvement at least this

// Scoring weights (perceptual-ish)
export const W_COLOR = 1.0;
export const W_VECTOR = 0.7;

// Blob regularizer (tile-mean attraction)
// Keeps regions coherent (texture blobs) without requiring perfect seam matches.
export const W_BLOB = 0.12;

// Bucket quantization (edge attraction)
export const KEY_BITS = 5; // per channel (5 => 32 levels)
export const KEY_LEVELS = 1 << KEY_BITS;

// Cursor focus (sense-making movement)
export const CURSOR_ENABLE = true;
export const CURSOR_MAX_STAY = 12; // max consecutive stays on same cursorPos
export const CURSOR_SIDE_STEP_CHANCE = 0.18; // chance to step sideways vs straight along worst seam
export const CURSOR_JUMP_BASE = 0.02; // minimum teleport probability
export const CURSOR_JUMP_FRONTIER_P = 0.75; // when jumping, probability to jump to frontier vs random/tournament

// Stall dynamics (controls jump tendency)
export const STALL_INC_ON_FAIL = 1;
export const STALL_DECAY_ON_ACCEPT = 0.6;
export const STALL_HARD_CAP = 200;
export const DELTA_EMA_ALPHA = 0.06;

// Normalization heuristics for cursor logic (rough; only shapes movement)
// ALT: auto-estimate from running percentiles later.
export const BADNESS_BASELINE = 0.1;
export const BADNESS_SPAN = 0.35;
export const COHESION_BASELINE = 0.01;
export const COHESION_SPAN = 0.06;

// Performance / responsiveness
export const DEFAULT_SPEED = 20; // UI range 1..60
export const MAX_TRIES_PER_FRAME = 400; // hard cap for safety

// Grow mode
export const GROW_MATCH_THRESHOLD = 0.95; // Initial threshold for tile matching in grow mode
