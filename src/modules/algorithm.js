/* eslint-disable no-mixed-operators */

//////////////////////////////
// Algorithm Core - Scoring, Selection, Optimization
//////////////////////////////

import * as config from "./config.js";
import * as state from "./state.js";
import * as data from "./data.js";

//////////////////////////////
// Seam scoring
//////////////////////////////
export function scoreColorSeam(sigA, sigB) {
  let s = 0;
  const a = sigA.edgeIdxs;
  const b = sigB.edgeIdxs;
  for (let i = 0; i < a.length; i++) s += data.oklabDist2(a[i], b[i]);
  return s / a.length;
}

export function scoreVectorSeamV2(sigA, sigB) {
  const aAngle = sigA.rayAngle;
  const bAngle = sigB.rayAngle;
  const aRay = sigA.rayIdxs;
  const bRay = sigB.rayIdxs;

  let anglePenalty = 0;
  let rayMismatch = 0;

  for (let i = 0; i < config.EDGE_SAMPLES; i++) {
    anglePenalty += Math.abs(aAngle[i] - bAngle[i]);

    const oa = i * config.RAY_DEPTH;
    const ob = i * config.RAY_DEPTH;
    for (let d = 0; d < config.RAY_DEPTH; d++)
      rayMismatch += data.oklabDist2(aRay[oa + d], bRay[ob + d]);
  }

  anglePenalty /= config.EDGE_SAMPLES;
  rayMismatch /= config.EDGE_SAMPLES * config.RAY_DEPTH;

  return rayMismatch + 0.15 * anglePenalty;
}

export function scoreSeam(
  tileIdA,
  rotA,
  edgeA,
  tileIdB,
  rotB,
  edgeB,
  useVector
) {
  const sA = state.sig[tileIdA][rotA][edgeA];
  const sB = state.sig[tileIdB][rotB][edgeB];

  let score = config.W_COLOR * scoreColorSeam(sA, sB);
  if (useVector) score += config.W_VECTOR * scoreVectorSeamV2(sA, sB);
  return score;
}

// seam between pos and its neighbor in dir (dir is from pos perspective)
export function seamDir(pos, dir, useVector) {
  const pN = data.neighborPos(pos, dir);
  if (pN === null) return 0; // No neighbor, no seam cost
  const a = state.board[pos];
  const b = state.board[pN];
  // In grow mode, tiles can be null
  if (!a || !b) return 0;
  return scoreSeam(
    a.tileId,
    a.rot,
    dir,
    b.tileId,
    b.rot,
    data.oppDir(dir),
    useVector
  );
}

export function blobTerm(pos) {
  const tile = state.board[pos];
  if (!tile) return 0; // In grow mode, position might be empty

  const t = tile.tileId;
  const L1 = state.tileMeanL[t],
    A1 = state.tileMeanA[t],
    B1 = state.tileMeanB[t];

  let sL = 0,
    sA = 0,
    sB = 0;
  let count = 0;
  for (let d = 0; d < 4; d++) {
    const neighborIdx = data.neighborPos(pos, d);
    if (neighborIdx === null) continue; // Skip null neighbors
    const neighborTile = state.board[neighborIdx];
    if (!neighborTile) continue; // In grow mode, neighbor might be empty
    const tn = neighborTile.tileId;
    sL += state.tileMeanL[tn];
    sA += state.tileMeanA[tn];
    sB += state.tileMeanB[tn];
    count++;
  }
  if (count === 0) return 0; // No neighbors at all
  const L2 = sL / count,
    A2 = sA / count,
    B2 = sB / count;

  return data.oklabDist2_3(L1, A1, B1, L2, A2, B2);
}

export function computeLocalScore(pos, useVector) {
  let s = 0;
  s += seamDir(pos, 0, useVector);
  s += seamDir(pos, 1, useVector);
  s += seamDir(pos, 2, useVector);
  s += seamDir(pos, 3, useVector);
  if (config.W_BLOB > 0) s += config.W_BLOB * blobTerm(pos);
  return s;
}

export function updateLocalScoresAround(pos, useVector) {
  const list = [
    pos,
    data.nPos(pos),
    data.ePos(pos),
    data.sPos(pos),
    data.wPos(pos),
  ];
  for (const p of list) {
    if (p === null) continue; // Skip null neighbors
    state.localScore[p] = computeLocalScore(p, useVector);
    data.pushFrontier(p);
  }
}

export function worstEdgeDir(pos, useVector) {
  let worstD = 0;
  let worstS = -Infinity;
  for (let d = 0; d < 4; d++) {
    const s = seamDir(pos, d, useVector);
    if (s > worstS) {
      worstS = s;
      worstD = d;
    }
  }
  return worstD;
}

//////////////////////////////
// Cursor-based A selection
//////////////////////////////
export function pickJumpTarget(useVector) {
  if (Math.random() < config.CURSOR_JUMP_FRONTIER_P) {
    const p = data.popFrontierValid();
    if (p !== null) return p;
  }
  // fallback tournament
  let best = data.randInt(state.tileCount);
  let bestScore = state.localScore[best];
  for (let i = 1; i < config.TOURNAMENT_T; i++) {
    const p = data.randInt(state.tileCount);
    const s = state.localScore[p];
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return best;
}

export function chooseLocalStepDir(pos, useVector) {
  const dWorst = worstEdgeDir(pos, useVector);
  if (Math.random() < config.CURSOR_SIDE_STEP_CHANCE) {
    const left = (dWorst + 3) & 3;
    const right = (dWorst + 1) & 3;
    const sL = seamDir(pos, left, useVector);
    const sR = seamDir(pos, right, useVector);
    return sL > sR ? left : right;
  }
  return dWorst;
}

export function pickPosAWithCursor(useVector) {
  if (!config.CURSOR_ENABLE) {
    const frontier = data.popFrontierValid();
    if (frontier !== null) return frontier;
    let best = data.randInt(state.tileCount);
    let bestScore = state.localScore[best];
    for (let i = 1; i < config.TOURNAMENT_T; i++) {
      const p = data.randInt(state.tileCount);
      const s = state.localScore[p];
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    return best;
  }

  if (!(state.cursorPos >= 0 && state.cursorPos < state.tileCount)) {
    state.updateCursorPos(pickJumpTarget(useVector));
    state.updateCursorStayCount(0);
  }

  const badness = state.localScore[state.cursorPos];
  const cohesion =
    config.W_BLOB > 0 ? config.W_BLOB * blobTerm(state.cursorPos) : 0;

  const b = data.norm01(badness, config.BADNESS_BASELINE, config.BADNESS_SPAN);
  const c = data.norm01(
    cohesion,
    config.COHESION_BASELINE,
    config.COHESION_SPAN
  );
  const s = data.clamp(state.stall / 60, 0, 1);
  const g = data.clamp(-state.deltaEMA / 0.15, 0, 1);

  let pJump =
    config.CURSOR_JUMP_BASE + 0.35 * (1 - b) + 0.35 * s + 0.2 * (1 - c);
  pJump = data.clamp(pJump, 0.01, 0.85);

  let pStay = 0.2 + 0.65 * b * g * (1 - s);
  pStay = data.clamp(pStay, 0.05, 0.9);

  if (state.cursorStayCount >= config.CURSOR_MAX_STAY) {
    pStay = 0;
    state.updateCursorStayCount(0);
  }

  const r = Math.random();
  if (r < pJump) {
    state.updateCursorPos(pickJumpTarget(useVector));
    state.updateCursorStayCount(0);
    return state.cursorPos;
  }

  if (r < pJump + pStay) {
    state.updateCursorStayCount(state.cursorStayCount + 1);
    return state.cursorPos;
  }

  const dir = chooseLocalStepDir(state.cursorPos, useVector);
  const newPos = data.neighborPos(state.cursorPos, dir);
  if (newPos !== null) {
    state.updateCursorPos(newPos);
    state.updateCursorStayCount(0);
  } else {
    // Can't move in that direction (edge with no wrap), stay put
    state.updateCursorStayCount(state.cursorStayCount + 1);
  }
  return state.cursorPos;
}

export function cursorOnAccept(posA, posB, d) {
  state.updateCursorPos(
    state.localScore[posA] >= state.localScore[posB] ? posA : posB
  );
  state.updateCursorStayCount(0);
  state.updateStall(Math.floor(state.stall * config.STALL_DECAY_ON_ACCEPT));
  state.updateDeltaEMA(
    (1 - config.DELTA_EMA_ALPHA) * state.deltaEMA + config.DELTA_EMA_ALPHA * d
  );
}

export function cursorOnFail() {
  state.updateStall(
    Math.min(config.STALL_HARD_CAP, state.stall + config.STALL_INC_ON_FAIL)
  );
  state.updateDeltaEMA((1 - config.DELTA_EMA_ALPHA) * state.deltaEMA);
}

//////////////////////////////
// Grow from center mode
//////////////////////////////

export function initializeGrowMode() {
  // Start with empty board
  const board = Array.from({ length: state.tileCount }, () => null);
  state.setBoard(board);

  // Track which tiles have been used
  const unusedTiles = new Set(
    Array.from({ length: state.tileCount }, (_, i) => i)
  );
  state.setUnusedTiles(unusedTiles);

  // Place first tile near center
  const centerPos = data.posOf(
    Math.floor(state.cols / 2),
    Math.floor(state.rows / 2)
  );

  const firstTile = data.randInt(state.tileCount);
  board[centerPos] = {
    tileId: firstTile,
    rot: state.allowRotation ? data.randInt(4) : 0,
  };
  unusedTiles.delete(firstTile);

  // Initialize growth frontier - positions adjacent to placed tiles
  const growthFrontier = new Set();
  for (let d = 0; d < 4; d++) {
    const neighbor = data.neighborPos(centerPos, d);
    if (neighbor !== null && board[neighbor] === null) {
      growthFrontier.add(neighbor);
    }
  }
  state.setGrowthFrontier(growthFrontier);

  const localScore = new Float64Array(state.tileCount);
  state.setLocalScore(localScore);

  const posStamp = new Uint32Array(state.tileCount);
  state.setPosStamp(posStamp);

  const heap = new data.MaxHeap();
  state.setHeap(heap);

  // Initialize tabu (needed if user switches to normal mode)
  const lastMovedStep = new Int32Array(state.tileCount);
  for (let i = 0; i < state.tileCount; i++) lastMovedStep[i] = -999999;
  state.setTabu(lastMovedStep, 0);

  state.updateCursorPos(centerPos);
  state.updateCursorStayCount(0);
  state.updateStall(0);
  state.updateDeltaEMA(0);

  //   state.setGrowMatchThreshold(0.5);
}

export function findBestTileForPosition(pos, matchThreshold, useVector) {
  if (state.board[pos] !== null) return null; // Already filled

  let bestTile = null;
  let bestRot = 0;
  let bestScore = Infinity;

  // Get neighbors that are already placed
  const neighbors = [];
  for (let d = 0; d < 4; d++) {
    const neighborPos = data.neighborPos(pos, d);
    if (neighborPos !== null && state.board[neighborPos] !== null) {
      neighbors.push({ pos: neighborPos, dir: d });
    }
  }

  if (neighbors.length === 0) return null; // No neighbors to match against

  // Try each unused tile
  for (const tileId of state.unusedTiles) {
    const rotations = state.allowRotation ? [0, 1, 2, 3] : [0];

    for (const rot of rotations) {
      let totalScore = 0;
      let edgeCount = 0;

      // Score against all neighbors
      for (const { pos: neighborPos, dir } of neighbors) {
        const neighbor = state.board[neighborPos];
        const score = scoreSeam(
          tileId,
          rot,
          dir,
          neighbor.tileId,
          neighbor.rot,
          data.oppDir(dir),
          useVector
        );
        totalScore += score;
        edgeCount++;
      }

      const avgScore = totalScore / edgeCount;

      if (avgScore < bestScore) {
        bestScore = avgScore;
        bestTile = tileId;
        bestRot = rot;
      }
    }
  }

  // Only return if score is below threshold (good match)
  if (bestScore < matchThreshold) {
    return { tileId: bestTile, rot: bestRot, score: bestScore };
  }

  return null;
}

export function growOnce() {
  if (!state.loaded || state.unusedTiles.size === 0) return false;

  const useVector = state.useVector;
  const matchThreshold = state.growMatchThreshold;

  // Try frontier positions in order of how many neighbors they have
  const frontierArray = Array.from(state.growthFrontier);
  frontierArray.sort((a, b) => {
    const countA = [0, 1, 2, 3].filter((d) => {
      const n = data.neighborPos(a, d);
      return n !== null && state.board[n] !== null;
    }).length;
    const countB = [0, 1, 2, 3].filter((d) => {
      const n = data.neighborPos(b, d);
      return n !== null && state.board[n] !== null;
    }).length;
    return countB - countA; // More neighbors first
  });

  for (const pos of frontierArray) {
    const result = findBestTileForPosition(pos, matchThreshold, useVector);

    if (result !== null) {
      // Place the tile
      state.board[pos] = { tileId: result.tileId, rot: result.rot };
      state.unusedTiles.delete(result.tileId);
      state.growthFrontier.delete(pos);

      // Add new frontier positions
      for (let d = 0; d < 4; d++) {
        const neighbor = data.neighborPos(pos, d);
        if (neighbor !== null && state.board[neighbor] === null) {
          state.growthFrontier.add(neighbor);
        }
      }

      // Update local score for the placed position
      state.localScore[pos] = computeLocalScore(pos, useVector);

      state.setHighlights(pos, -1);
      return true;
    }
  }

  // No good matches found, relax threshold
  state.setGrowMatchThreshold(matchThreshold * 1.05);
  return false;
}

//////////////////////////////
// Board init / shuffle
//////////////////////////////
export function shuffleBoard() {
  const ids = Array.from({ length: state.tileCount }, (_, i) => i);
  data.shuffleInPlace(ids);

  const board = Array.from({ length: state.tileCount }, (_, pos) => ({
    tileId: ids[pos],
    rot: state.allowRotation ? data.randInt(4) : 0,
  }));
  state.setBoard(board);

  const localScore = new Float64Array(state.tileCount);
  state.setLocalScore(localScore);

  const posStamp = new Uint32Array(state.tileCount);
  state.setPosStamp(posStamp);

  const heap = new data.MaxHeap();
  state.setHeap(heap);

  const lastMovedStep = new Int32Array(state.tileCount);
  for (let i = 0; i < state.tileCount; i++) lastMovedStep[i] = -999999;
  state.setTabu(lastMovedStep, 0);

  const useVector = state.useVector;
  for (let pos = 0; pos < state.tileCount; pos++) {
    state.localScore[pos] = computeLocalScore(pos, useVector);
    data.pushFrontier(pos);
  }

  state.updateCursorPos(data.randInt(state.tileCount));
  state.updateCursorStayCount(0);
  state.updateStall(0);
  state.updateDeltaEMA(0);
}

//////////////////////////////
// Sort operations
//////////////////////////////
export function sortRows() {
  // Sort each row so tiles are in their original positions within that row
  const board = state.board;

  for (let row = 0; row < state.rows; row++) {
    // Get all tiles in this row
    const rowTiles = [];
    for (let col = 0; col < state.cols; col++) {
      const pos = data.posOf(col, row);
      rowTiles.push({ ...board[pos], pos });
    }

    // Sort by original tileId position (which column the tile came from)
    rowTiles.sort((a, b) => {
      const [colA] = data.xyOf(a.tileId);
      const [colB] = data.xyOf(b.tileId);
      return colA - colB;
    });

    // Put sorted tiles back into the board
    for (let col = 0; col < state.cols; col++) {
      const pos = data.posOf(col, row);
      board[pos] = { tileId: rowTiles[col].tileId, rot: rowTiles[col].rot };
    }
  }

  // Recalculate all local scores
  const useVector = state.useVector;
  for (let pos = 0; pos < state.tileCount; pos++) {
    state.localScore[pos] = computeLocalScore(pos, useVector);
    data.pushFrontier(pos);
  }
}

export function sortColumns() {
  // Sort each column so tiles are in their original positions within that column
  const board = state.board;

  for (let col = 0; col < state.cols; col++) {
    // Get all tiles in this column
    const colTiles = [];
    for (let row = 0; row < state.rows; row++) {
      const pos = data.posOf(col, row);
      colTiles.push({ ...board[pos], pos });
    }

    // Sort by original tileId position (which row the tile came from)
    colTiles.sort((a, b) => {
      const [, rowA] = data.xyOf(a.tileId);
      const [, rowB] = data.xyOf(b.tileId);
      return rowA - rowB;
    });

    // Put sorted tiles back into the board
    for (let row = 0; row < state.rows; row++) {
      const pos = data.posOf(col, row);
      board[pos] = { tileId: colTiles[row].tileId, rot: colTiles[row].rot };
    }
  }

  // Recalculate all local scores
  const useVector = state.useVector;
  for (let pos = 0; pos < state.tileCount; pos++) {
    state.localScore[pos] = computeLocalScore(pos, useVector);
    data.pushFrontier(pos);
  }
}

//////////////////////////////
// Fast seam-only delta for swap
//////////////////////////////
export function sumIncidentSeams(pos, useVector) {
  return (
    seamDir(pos, 0, useVector) +
    seamDir(pos, 1, useVector) +
    seamDir(pos, 2, useVector) +
    seamDir(pos, 3, useVector) +
    (config.W_BLOB > 0 ? config.W_BLOB * blobTerm(pos) : 0)
  );
}

export function deltaForSwap(posA, posB, newA, newB, useVector) {
  const affectedSet = new Set([
    posA,
    data.nPos(posA),
    data.ePos(posA),
    data.sPos(posA),
    data.wPos(posA),
    posB,
    data.nPos(posB),
    data.ePos(posB),
    data.sPos(posB),
    data.wPos(posB),
  ]);
  // Filter out null neighbors
  affectedSet.delete(null);
  const affected = Array.from(affectedSet);

  let before = 0;
  for (const p of affected) before += sumIncidentSeams(p, useVector);

  const oldA = state.board[posA];
  const oldB = state.board[posB];
  state.board[posA] = newA;
  state.board[posB] = newB;

  let after = 0;
  for (const p of affected) after += sumIncidentSeams(p, useVector);

  state.board[posA] = oldA;
  state.board[posB] = oldB;

  return after - before;
}

//////////////////////////////
// Candidate generation
//////////////////////////////
export function sampleFromArray(arr, count, out) {
  if (!arr || arr.length === 0) return;
  for (let i = 0; i < count; i++) out.push(arr[data.randInt(arr.length)]);
}

export function generateCandidates(posA, useVector) {
  const candidates = [];
  const a = state.board[posA];
  const dWorst = worstEdgeDir(posA, useVector);

  const keyA = state.sig[a.tileId][a.rot][dWorst].edgeKey;
  const wantEdge = data.oppDir(dWorst);

  const bucket = state.edgeBuckets[wantEdge].get(keyA);
  sampleFromArray(bucket, config.K_BUCKET, candidates);

  for (let i = 0; i < config.K_RANDOM; i++) {
    candidates.push({
      tileId: data.randInt(state.tileCount),
      rot: data.randInt(4),
    });
  }

  return { candidates, dWorst, keyA };
}

//////////////////////////////
// Optimization step
//////////////////////////////
export function attemptImproveOnce() {
  if (!state.loaded) return false;

  const useVector = state.useVector;

  const posA = pickPosAWithCursor(useVector);
  const curA = state.board[posA];

  state.setHighlights(posA, -1);

  const { candidates } = generateCandidates(posA, useVector);

  let best = null;
  let bestDelta = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];

    // Find a position posB that currently holds cand.tileId.
    let posB = -1;
    for (let tries = 0; tries < 6; tries++) {
      const p = data.randInt(state.tileCount);
      if (state.board[p].tileId === cand.tileId) {
        posB = p;
        break;
      }
    }
    if (posB < 0) {
      for (let p = 0; p < state.tileCount; p++) {
        if (state.board[p].tileId === cand.tileId) {
          posB = p;
          break;
        }
      }
    }
    if (posB < 0 || posB === posA) continue;

    const curB = state.board[posB];

    // Rotation search
    const rbList = state.allowRotation
      ? [cand.rot, (cand.rot + 1) & 3, (cand.rot + 3) & 3]
      : [curB.rot]; // If rotation disabled, keep current rotation
    for (let rbi = 0; rbi < rbList.length; rbi++) {
      const rb = rbList[rbi];
      const raList = state.allowRotation ? [0, 1, 2, 3] : [curA.rot];
      for (let rai = 0; rai < raList.length; rai++) {
        const ra = raList[rai];
        const newA = { tileId: curB.tileId, rot: rb };
        const newB = { tileId: curA.tileId, rot: ra };

        const d = deltaForSwap(posA, posB, newA, newB, useVector);
        if (d < bestDelta) {
          bestDelta = d;
          best = { posB, newA, newB, d };
        }
      }
    }
  }

  if (!best) {
    cursorOnFail();
    return false;
  }

  state.setHighlights(posA, best.posB);

  const movingTileA = state.board[posA].tileId;
  const movingTileB = state.board[best.posB].tileId;

  const tabuA =
    state.stepIndex - state.lastMovedStep[movingTileA] < config.TABU_STEPS;
  const tabuB =
    state.stepIndex - state.lastMovedStep[movingTileB] < config.TABU_STEPS;
  const isTabu = tabuA || tabuB;

  let accept = false;
  if (!isTabu) {
    accept = best.d < 0 || Math.random() < config.ESCAPE_MOVE_CHANCE;
  } else {
    accept =
      best.d < config.TABU_OVERRIDE ||
      Math.random() < config.ESCAPE_MOVE_CHANCE * 0.25;
  }

  if (!accept) {
    cursorOnFail();
    return false;
  }

  // Commit
  state.board[posA] = best.newA;
  state.board[best.posB] = best.newB;

  state.updateLastMovedStep(movingTileA, state.stepIndex);
  state.updateLastMovedStep(movingTileB, state.stepIndex);
  state.updateStepIndex();

  // Update local scores for affected areas
  updateLocalScoresAround(posA, useVector);
  updateLocalScoresAround(best.posB, useVector);

  cursorOnAccept(posA, best.posB, best.d);

  state.updateLastDelta(best.d);

  return true;
}
