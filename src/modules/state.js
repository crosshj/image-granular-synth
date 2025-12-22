//////////////////////////////
// Application State & Data Structures
//////////////////////////////

// Canvas contexts and elements (initialized via initCanvases)
export let ctx = null;
export let octx = null;
export let canvasEl = null;
export let overlayEl = null;

export function initCanvases(canvasCtx, overlayCtx, canvas, overlay) {
  ctx = canvasCtx;
  octx = overlayCtx;
  canvasEl = canvas;
  overlayEl = overlay;
  ctx.imageSmoothingEnabled = false;
  octx.imageSmoothingEnabled = false;
}

// Runtime state
export let running = false;
export let loaded = false;
export let useVector = true; // Whether to use vector scoring
export let allowRotation = true; // Whether tiles can be rotated during optimization
export let useToroidalX = true; // Whether to wrap around left-right edges
export let useToroidalY = true; // Whether to wrap around top-bottom edges

export let imgW = 0;
export let imgH = 0;
export let cols = 0;
export let rows = 0;
export let tileCount = 0;

// Data models
export let tileBitmaps = []; // ImageBitmap per original tile (unrotated)
export let board = []; // board[pos] = { tileId, rot }
export let localScore = null; // localScore[pos] = sum of 4 seams + blob term

export let hiA = -1; // overlay highlight pos A
export let hiB = -1; // overlay highlight pos B

// OKLab buffers for cropped image pixels
export let oklL = null;
export let oklA = null;
export let oklB = null;

// Signatures: sig[tileId][rot][edge] = { edgeIdxs, rayIdxs, rayAngle, edgeKey }
export let sig = null;

// Edge buckets: edgeBuckets[edge] => Map<key, Array<{tileId, rot}>>
export let edgeBuckets = null;

// Tile means (OKLab) for blob regularizer: tileMean[tileId] = [L,A,B]
export let tileMeanL = null;
export let tileMeanA = null;
export let tileMeanB = null;

// Frontier max-heap (positions prioritized by localScore)
export let heap = null;
export let posStamp = null; // increments when localScore[pos] updates

// Tabu: last moved step for each tileId
export let lastMovedStep = null;
export let stepIndex = 0;

// Cursor focus
export let cursorPos = 0;
export let cursorStayCount = 0;
export let stall = 0;
export let deltaEMA = 0;

// Statistics
export let attemptsThisSec = 0;
export let acceptedThisSec = 0;
export let lastStatT = performance.now();
export let lastDelta = 0;

// State setters (needed because of const exports)
export function setRunning(value) {
  running = value;
}
export function setLoaded(value) {
  loaded = value;
}
export function setUseVector(value) {
  useVector = value;
}
export function setAllowRotation(value) {
  allowRotation = value;
}
export function setUseToroidalX(value) {
  useToroidalX = value;
}
export function setUseToroidalY(value) {
  useToroidalY = value;
}
export function setImgDimensions(w, h) {
  imgW = w;
  imgH = h;
}
export function setGridDimensions(c, r) {
  cols = c;
  rows = r;
  tileCount = c * r;
}
export function setTileBitmaps(value) {
  tileBitmaps = value;
}
export function setBoard(value) {
  board = value;
}
export function setLocalScore(value) {
  localScore = value;
}
export function setHighlights(a, b) {
  hiA = a;
  hiB = b;
}
export function setOKLab(L, A, B) {
  oklL = L;
  oklA = A;
  oklB = B;
}
export function setSig(value) {
  sig = value;
}
export function setEdgeBuckets(value) {
  edgeBuckets = value;
}
export function setTileMeans(L, A, B) {
  tileMeanL = L;
  tileMeanA = A;
  tileMeanB = B;
}
export function setHeap(value) {
  heap = value;
}
export function setPosStamp(value) {
  posStamp = value;
}
export function setTabu(lms, si) {
  lastMovedStep = lms;
  stepIndex = si;
}
export function setCursor(pos, stay, st, ema) {
  cursorPos = pos;
  cursorStayCount = stay;
  stall = st;
  deltaEMA = ema;
}
export function setStats(attempts, accepted, statT, delta) {
  attemptsThisSec = attempts;
  acceptedThisSec = accepted;
  lastStatT = statT;
  lastDelta = delta;
}

// Individual state updates
export function incrementAttemptsThisSec() {
  attemptsThisSec++;
}
export function incrementAcceptedThisSec() {
  acceptedThisSec++;
}
export function updateLastDelta(value) {
  lastDelta = value;
}
export function updateCursorPos(value) {
  cursorPos = value;
}
export function updateCursorStayCount(value) {
  cursorStayCount = value;
}
export function updateStall(value) {
  stall = value;
}
export function updateDeltaEMA(value) {
  deltaEMA = value;
}
export function updateStepIndex() {
  stepIndex++;
}
export function updateLastMovedStep(tileId, step) {
  lastMovedStep[tileId] = step;
}
