/* eslint-disable no-mixed-operators */

//////////////////////////////
// Data Layer - Math, Geometry, Color Conversion, Data Structures
//////////////////////////////

import * as config from "./config.js";
import * as state from "./state.js";

//////////////////////////////
// Utilities
//////////////////////////////
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function randInt(n) {
  return (Math.random() * n) | 0;
}

export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function norm01(v, base, span) {
  return clamp((v - base) / span, 0, 1);
}

//////////////////////////////
// Grid & Geometry
//////////////////////////////
export function posOf(x, y) {
  return y * state.cols + x;
}

export function xyOf(pos) {
  return [pos % state.cols, (pos / state.cols) | 0];
}

export function nPos(pos) {
  const [x, y] = xyOf(pos);
  if (!state.useToroidalY && y === 0) return null; // No neighbor at top edge
  return posOf(x, (y - 1 + state.rows) % state.rows);
}

export function sPos(pos) {
  const [x, y] = xyOf(pos);
  if (!state.useToroidalY && y === state.rows - 1) return null; // No neighbor at bottom edge
  return posOf(x, (y + 1) % state.rows);
}

export function wPos(pos) {
  const [x, y] = xyOf(pos);
  if (!state.useToroidalX && x === 0) return null; // No neighbor at left edge
  return posOf((x - 1 + state.cols) % state.cols, y);
}

export function ePos(pos) {
  const [x, y] = xyOf(pos);
  if (!state.useToroidalX && x === state.cols - 1) return null; // No neighbor at right edge
  return posOf((x + 1) % state.cols, y);
}

// dir: 0=N,1=E,2=S,3=W
export function neighborPos(pos, dir) {
  switch (dir) {
    case 0:
      return nPos(pos);
    case 1:
      return ePos(pos);
    case 2:
      return sPos(pos);
    case 3:
      return wPos(pos);
    default:
      return pos;
  }
}

export function oppDir(dir) {
  return (dir + 2) & 3;
}

export function rotLocal(x, y, rot) {
  switch (rot & 3) {
    case 0:
      return [x, y];
    case 1:
      return [config.TILE_PX - 1 - y, x];
    case 2:
      return [config.TILE_PX - 1 - x, config.TILE_PX - 1 - y];
    case 3:
      return [y, config.TILE_PX - 1 - x];
    default:
      return [x, y];
  }
}

export function rotDir(dx, dy, rot) {
  switch (rot & 3) {
    case 0:
      return [dx, dy];
    case 1:
      return [-dy, dx];
    case 2:
      return [-dx, -dy];
    case 3:
      return [dy, -dx];
    default:
      return [dx, dy];
  }
}

//////////////////////////////
// OKLab conversion
//////////////////////////////
export function srgbToLinear(u) {
  u /= 255;
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
}

export function rgbLinToOKLab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return [L, A, B];
}

export function pixIdx(x, y) {
  return y * state.imgW + x;
}

export function oklabDist2(i1, i2) {
  const dL = state.oklL[i1] - state.oklL[i2];
  const dA = state.oklA[i1] - state.oklA[i2];
  const dB = state.oklB[i1] - state.oklB[i2];
  return dL * dL + dA * dA + dB * dB;
}

export function oklabDist2_3(L1, A1, B1, L2, A2, B2) {
  const dL = L1 - L2;
  const dA = A1 - A2;
  const dB = B1 - B2;
  return dL * dL + dA * dA + dB * dB;
}

export function precomputeOKLab(imageData) {
  const data = imageData.data;
  const n = state.imgW * state.imgH;
  const oklL = new Float32Array(n);
  const oklA = new Float32Array(n);
  const oklB = new Float32Array(n);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = srgbToLinear(data[p + 0]);
    const g = srgbToLinear(data[p + 1]);
    const b = srgbToLinear(data[p + 2]);
    const [L, A, B] = rgbLinToOKLab(r, g, b);
    oklL[i] = L;
    oklA[i] = A;
    oklB[i] = B;
  }

  state.setOKLab(oklL, oklA, oklB);
}

//////////////////////////////
// Max-heap (frontier queue)
//////////////////////////////
export class MaxHeap {
  constructor() {
    this.a = [];
  }
  push(item) {
    const a = this.a;
    a.push(item);
    this._up(a.length - 1);
  }
  pop() {
    const a = this.a;
    if (a.length === 0) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      this._down(0);
    }
    return top;
  }
  _up(i) {
    const a = this.a;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].score >= a[i].score) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  _down(i) {
    const a = this.a;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < a.length && a[l].score > a[m].score) m = l;
      if (r < a.length && a[r].score > a[m].score) m = r;
      if (m === i) break;
      [a[m], a[i]] = [a[i], a[m]];
      i = m;
    }
  }
}

export function pushFrontier(pos) {
  const stamp = ++state.posStamp[pos];
  state.heap.push({ pos, stamp, score: state.localScore[pos] });
}

export function popFrontierValid() {
  for (;;) {
    const it = state.heap.pop();
    if (!it) return null;
    if (state.posStamp[it.pos] !== it.stamp) continue;
    return it.pos;
  }
}

//////////////////////////////
// Signatures / bucketing
//////////////////////////////
export function edgeSampleLocal(i, edge) {
  const t = config.EDGE_SAMPLES === 1 ? 0.5 : i / (config.EDGE_SAMPLES - 1);
  const u = (t * (config.TILE_PX - 1)) | 0;
  switch (edge) {
    case 0:
      return [u, 0];
    case 1:
      return [config.TILE_PX - 1, u];
    case 2:
      return [u, config.TILE_PX - 1];
    case 3:
      return [0, u];
    default:
      return [u, 0];
  }
}

export function edgeInwardNormal(edge) {
  switch (edge) {
    case 0:
      return [0, 1];
    case 1:
      return [-1, 0];
    case 2:
      return [0, -1];
    case 3:
      return [1, 0];
    default:
      return [0, 1];
  }
}

export function rayDirsForEdge(edge) {
  const [nx, ny] = edgeInwardNormal(edge);
  const base = Math.atan2(ny, nx);
  return config.RAY_ANGLES_DEG.map((deg) => {
    const a = base + (deg * Math.PI) / 180;
    return [Math.cos(a), Math.sin(a)];
  });
}

export function edgeKeyFromMean(L, A, B) {
  const qL = clamp((L * (config.KEY_LEVELS - 1)) | 0, 0, config.KEY_LEVELS - 1);
  const qA = clamp(
    (((A + 0.5) / 1.0) * (config.KEY_LEVELS - 1)) | 0,
    0,
    config.KEY_LEVELS - 1
  );
  const qB = clamp(
    (((B + 0.5) / 1.0) * (config.KEY_LEVELS - 1)) | 0,
    0,
    config.KEY_LEVELS - 1
  );
  return (qL << (config.KEY_BITS * 2)) | (qA << config.KEY_BITS) | qB;
}

export function rayCoherenceScore(idxList) {
  let s = 0;
  for (let k = 1; k < idxList.length; k++)
    s += oklabDist2(idxList[k - 1], idxList[k]);
  return s;
}

export function precomputeTileMeans() {
  const tileMeanL = new Float32Array(state.tileCount);
  const tileMeanA = new Float32Array(state.tileCount);
  const tileMeanB = new Float32Array(state.tileCount);

  for (let tileId = 0; tileId < state.tileCount; tileId++) {
    const tx = (tileId % state.cols) * config.TILE_PX;
    const ty = ((tileId / state.cols) | 0) * config.TILE_PX;

    let sL = 0,
      sA = 0,
      sB = 0;
    const n = config.TILE_PX * config.TILE_PX;

    for (let y = 0; y < config.TILE_PX; y++) {
      for (let x = 0; x < config.TILE_PX; x++) {
        const i = pixIdx(tx + x, ty + y);
        sL += state.oklL[i];
        sA += state.oklA[i];
        sB += state.oklB[i];
      }
    }

    tileMeanL[tileId] = sL / n;
    tileMeanA[tileId] = sA / n;
    tileMeanB[tileId] = sB / n;
  }

  state.setTileMeans(tileMeanL, tileMeanA, tileMeanB);
}

export function precomputeSignaturesAndBuckets() {
  const edgeBuckets = Array.from({ length: 4 }, () => new Map());

  const sig = Array.from({ length: state.tileCount }, () =>
    Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => null))
  );

  const edgeRayDirs = [0, 1, 2, 3].map((edge) => rayDirsForEdge(edge));

  for (let tileId = 0; tileId < state.tileCount; tileId++) {
    const tx = (tileId % state.cols) * config.TILE_PX;
    const ty = ((tileId / state.cols) | 0) * config.TILE_PX;

    for (let rot = 0; rot < 4; rot++) {
      for (let edge = 0; edge < 4; edge++) {
        const edgeIdxs = new Int32Array(config.EDGE_SAMPLES);
        const rayAngle = new Int8Array(config.EDGE_SAMPLES);
        const rayIdxs = new Int32Array(config.EDGE_SAMPLES * config.RAY_DEPTH);

        let meanL = 0,
          meanA = 0,
          meanB = 0;

        const candDirs = edgeRayDirs[edge];
        const candDirsRot = candDirs.map(([dx, dy]) => rotDir(dx, dy, rot));

        for (let i = 0; i < config.EDGE_SAMPLES; i++) {
          const [lx0, ly0] = edgeSampleLocal(i, edge);
          const [lx, ly] = rotLocal(lx0, ly0, rot);
          const gx0 = tx + lx;
          const gy0 = ty + ly;
          const eIdx = pixIdx(gx0, gy0);
          edgeIdxs[i] = eIdx;

          meanL += state.oklL[eIdx];
          meanA += state.oklA[eIdx];
          meanB += state.oklB[eIdx];

          let bestA = 0;
          let bestScore = Infinity;
          let bestRay = null;

          for (let a = 0; a < candDirsRot.length; a++) {
            const [dx, dy] = candDirsRot[a];
            const list = new Int32Array(config.RAY_DEPTH);

            for (let d = 0; d < config.RAY_DEPTH; d++) {
              const stepX = (gx0 + dx * d) | 0;
              const stepY = (gy0 + dy * d) | 0;
              const clampedX = clamp(stepX, tx, tx + config.TILE_PX - 1);
              const clampedY = clamp(stepY, ty, ty + config.TILE_PX - 1);
              list[d] = pixIdx(clampedX, clampedY);
            }

            const score = rayCoherenceScore(list);
            if (score < bestScore) {
              bestScore = score;
              bestA = a;
              bestRay = list;
            }
          }

          rayAngle[i] = bestA;
          for (let d = 0; d < config.RAY_DEPTH; d++)
            rayIdxs[i * config.RAY_DEPTH + d] = bestRay[d];
        }

        meanL /= config.EDGE_SAMPLES;
        meanA /= config.EDGE_SAMPLES;
        meanB /= config.EDGE_SAMPLES;

        const edgeKey = edgeKeyFromMean(meanL, meanA, meanB);

        sig[tileId][rot][edge] = { edgeIdxs, rayIdxs, rayAngle, edgeKey };

        const m = edgeBuckets[edge];
        let arr = m.get(edgeKey);
        if (!arr) {
          arr = [];
          m.set(edgeKey, arr);
        }
        arr.push({ tileId, rot });
      }
    }
  }

  state.setSig(sig);
  state.setEdgeBuckets(edgeBuckets);
}
