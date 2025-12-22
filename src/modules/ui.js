/* eslint-disable no-mixed-operators */

//////////////////////////////
// Presentation Layer - Rendering, UI Controls, Event Handlers
//////////////////////////////

import * as config from "./config.js";
import * as state from "./state.js";
import * as data from "./data.js";
import * as algorithm from "./algorithm.js";

//////////////////////////////
// Drawing
//////////////////////////////
export function drawBoard() {
  const width = state.imgW;
  const height = state.imgH;

  state.ctx.imageSmoothingEnabled = false;
  state.ctx.clearRect(0, 0, width, height);

  for (let pos = 0; pos < state.tileCount; pos++) {
    const { tileId, rot } = state.board[pos];
    const [x, y] = data.xyOf(pos);
    const px = x * config.TILE_PX;
    const py = y * config.TILE_PX;

    const bmp = state.tileBitmaps[tileId];
    if (!bmp) continue;

    if ((rot & 3) === 0) {
      state.ctx.drawImage(bmp, px, py);
    } else {
      state.ctx.save();
      state.ctx.translate(px + config.TILE_PX / 2, py + config.TILE_PX / 2);
      state.ctx.rotate((Math.PI / 2) * (rot & 3));
      state.ctx.translate(-config.TILE_PX / 2, -config.TILE_PX / 2);
      state.ctx.drawImage(bmp, 0, 0);
      state.ctx.restore();
    }
  }
}

export function drawOverlay() {
  const width = state.imgW;
  const height = state.imgH;

  state.octx.clearRect(0, 0, width, height);

  state.octx.save();
  state.octx.lineWidth = 2;

  if (state.hiA >= 0) {
    const [x, y] = data.xyOf(state.hiA);
    state.octx.strokeStyle = "rgba(109,213,255,0.95)";
    state.octx.strokeRect(
      x * config.TILE_PX + 1,
      y * config.TILE_PX + 1,
      config.TILE_PX - 2,
      config.TILE_PX - 2
    );
  }
  if (state.hiB >= 0) {
    const [x, y] = data.xyOf(state.hiB);
    state.octx.strokeStyle = "rgba(255,204,102,0.95)";
    state.octx.strokeRect(
      x * config.TILE_PX + 1,
      y * config.TILE_PX + 1,
      config.TILE_PX - 2,
      config.TILE_PX - 2
    );
  }

  state.octx.restore();
}

export function resetHighlights() {
  state.setHighlights(-1, -1);
}

//////////////////////////////
// Image load / init
//////////////////////////////
export async function imageToCroppedImageData(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);

  const cols = (img.width / config.TILE_PX) | 0;
  const rows = (img.height / config.TILE_PX) | 0;
  const imgW = cols * config.TILE_PX;
  const imgH = rows * config.TILE_PX;

  state.setGridDimensions(cols, rows);
  state.setImgDimensions(imgW, imgH);

  const off = document.createElement("canvas");
  off.width = imgW;
  off.height = imgH;
  const c = off.getContext("2d", { alpha: false });
  c.imageSmoothingEnabled = false;

  c.drawImage(img, 0, 0, imgW, imgH, 0, 0, imgW, imgH);
  return c.getImageData(0, 0, imgW, imgH);
}

export async function buildTileBitmaps(imageData) {
  const off = document.createElement("canvas");
  off.width = config.TILE_PX;
  off.height = config.TILE_PX;
  const c = off.getContext("2d", { alpha: false });
  c.imageSmoothingEnabled = false;

  const tileBitmaps = new Array(state.tileCount);

  for (let ty = 0; ty < state.rows; ty++) {
    for (let tx = 0; tx < state.cols; tx++) {
      const tileId = ty * state.cols + tx;
      const sx = tx * config.TILE_PX;
      const sy = ty * config.TILE_PX;

      const tileData = c.createImageData(config.TILE_PX, config.TILE_PX);
      for (let y = 0; y < config.TILE_PX; y++) {
        const srcRow = (sy + y) * state.imgW + sx;
        const dstRow = y * config.TILE_PX;
        for (let x = 0; x < config.TILE_PX; x++) {
          const si = (srcRow + x) * 4;
          const di = (dstRow + x) * 4;
          tileData.data[di + 0] = imageData.data[si + 0];
          tileData.data[di + 1] = imageData.data[si + 1];
          tileData.data[di + 2] = imageData.data[si + 2];
          tileData.data[di + 3] = 255;
        }
      }

      c.putImageData(tileData, 0, 0);

      tileBitmaps[tileId] = await createImageBitmap(off, {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none",
        resizeQuality: "pixelated",
      });
    }
  }

  state.setTileBitmaps(tileBitmaps);
}

export async function loadFile(file, uiElements) {
  const { controls, stats } = uiElements;

  state.setRunning(false);
  state.setLoaded(false);

  controls.btnReset.disabled = true;
  controls.btnPlay.disabled = true;
  controls.btnStep.disabled = true;
  controls.btnSortRows.disabled = true;
  controls.btnSortCols.disabled = true;
  controls.btnPlay.textContent = "Play";

  resetHighlights();

  const imageData = await imageToCroppedImageData(file);

  // Resize canvases
  state.canvasEl.width = state.imgW;
  state.canvasEl.height = state.imgH;
  state.overlayEl.width = state.imgW;
  state.overlayEl.height = state.imgH;
  state.ctx.imageSmoothingEnabled = false;
  state.octx.imageSmoothingEnabled = false;

  stats.tiles.textContent = `${state.cols}×${state.rows} = ${state.tileCount}`;
  stats.aps.textContent = "0";
  stats.acc.textContent = "0";
  stats.delta.textContent = "0";

  data.precomputeOKLab(imageData);
  await buildTileBitmaps(imageData);

  data.precomputeTileMeans();
  data.precomputeSignaturesAndBuckets();

  algorithm.shuffleBoard();
  drawBoard();
  drawOverlay();

  state.setLoaded(true);

  controls.btnReset.disabled = false;
  controls.btnPlay.disabled = false;
  controls.btnStep.disabled = false;
  controls.btnSortRows.disabled = false;
  controls.btnSortCols.disabled = false;
}

//////////////////////////////
// UI Controls
//////////////////////////////
export function tickStats(uiElements) {
  const { stats } = uiElements;
  const now = performance.now();
  if (now - state.lastStatT >= 1000) {
    stats.aps.textContent = String(state.attemptsThisSec);
    stats.acc.textContent = String(state.acceptedThisSec);
    state.setStats(0, 0, now, state.lastDelta);
  }
}

// Export event handler functions to be called from HTML
export function handlePlayClick(uiElements) {
  const { controls } = uiElements;
  if (!state.loaded) return;
  state.setRunning(!state.running);
  controls.btnPlay.textContent = state.running ? "Pause" : "Play";
}

export function handleStepClick(uiElements) {
  const { controls, stats } = uiElements;
  if (!state.loaded) return;
  state.setRunning(false);
  controls.btnPlay.textContent = "Play";

  const maxTries = 300;
  for (let i = 0; i < maxTries; i++) {
    state.incrementAttemptsThisSec();
    if (algorithm.attemptImproveOnce()) {
      state.incrementAcceptedThisSec();
      stats.delta.textContent = state.lastDelta.toFixed(4);
      drawBoard();
      drawOverlay();
      break;
    }
  }
  tickStats(uiElements);
}

export function handleResetClick(uiElements) {
  const { controls } = uiElements;
  if (!state.loaded) return;
  state.setRunning(false);
  controls.btnPlay.textContent = "Play";

  resetHighlights();
  algorithm.shuffleBoard();
  drawBoard();
  drawOverlay();
}

export function handleSortRowsClick(uiElements) {
  const { controls } = uiElements;
  if (!state.loaded) return;
  state.setRunning(false);
  controls.btnPlay.textContent = "Play";

  resetHighlights();
  algorithm.sortRows();
  drawBoard();
  drawOverlay();
}

export function handleSortColumnsClick(uiElements) {
  const { controls } = uiElements;
  if (!state.loaded) return;
  state.setRunning(false);
  controls.btnPlay.textContent = "Play";

  resetHighlights();
  algorithm.sortColumns();
  drawBoard();
  drawOverlay();
}

export function handleOverlayChange(e, overlayEl) {
  overlayEl.style.opacity = e.target.checked ? "1" : "0";
  if (e.target.checked) {
    drawOverlay();
  }
}

export function handleVectorChange(e) {
  const checked = e.target.checked;
  if (!state.loaded) return;
  state.setUseVector(checked);
  for (let pos = 0; pos < state.tileCount; pos++) {
    state.localScore[pos] = algorithm.computeLocalScore(pos, checked);
    data.pushFrontier(pos);
  }
  drawOverlay();
}

export function handleRotationChange(e) {
  const checked = e.target.checked;
  state.setAllowRotation(checked);
  // Note: This doesn't recalculate scores immediately,
  // it will take effect on the next optimization attempt
}

export function handleToroidalXChange(e) {
  const checked = e.target.checked;
  if (!state.loaded) return;
  state.setUseToroidalX(checked);
  // Recalculate all local scores since edge behavior changed
  const useVector = state.useVector;
  for (let pos = 0; pos < state.tileCount; pos++) {
    state.localScore[pos] = algorithm.computeLocalScore(pos, useVector);
    data.pushFrontier(pos);
  }
  drawOverlay();
}

export function handleToroidalYChange(e) {
  const checked = e.target.checked;
  if (!state.loaded) return;
  state.setUseToroidalY(checked);
  // Recalculate all local scores since edge behavior changed
  const useVector = state.useVector;
  for (let pos = 0; pos < state.tileCount; pos++) {
    state.localScore[pos] = algorithm.computeLocalScore(pos, useVector);
    data.pushFrontier(pos);
  }
  drawOverlay();
}

export function handleSpeedChange(e, inputEls, setSpeed) {
  const speed = parseInt(e.target.value);
  inputEls.outSpeed.textContent = speed;
  setSpeed(speed);
}

export async function handleFileChange(e, uiElements) {
  const file = e.target.files?.[0];
  if (file) {
    await loadFile(file, uiElements);
  }
}
