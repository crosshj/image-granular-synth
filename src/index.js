/* eslint-disable no-mixed-operators */

/*
	Image Granular Synth - Main Entry Point

	Full revised app including:
	✅ Responsiveness: time-sliced rAF loop (ms budget)
	✅ Trouble-first selection: frontier max-heap + tournament fallback
	✅ Attraction: edge-mean bucketing for candidate generation (+ random exploration)
	✅ Anti-thrash: light tabu on recently moved tiles
	✅ Faster evaluation: seam-only delta (no full neighborhood rescoring per candidate)
	✅ Optional blob regularizer: tile-mean similarity term (low weight)
	✅ Cursor-based "sense-making" focus: sticky cursor + frontier-walk + probabilistic jumps

	Vector scoring: V2 inward rays (toggleable). ALT hook for V3 patch correlation.
*/

import * as config from "./modules/config.js";
import * as state from "./modules/state.js";
import * as data from "./modules/data.js";
import * as algorithm from "./modules/algorithm.js";
import * as ui from "./modules/ui.js";

// Store UI elements
let uiElements = null;
let currentSpeed = config.DEFAULT_SPEED;
let overlayEl = null;
let inputEls = null;

//////////////////////////////
// Main Loop (time-sliced)
//////////////////////////////
function loop() {
  if (state.running && state.loaded && uiElements) {
    if (state.useGrowMode) {
      // In grow mode, try to place one tile per frame
      const budgetMs = data.clamp(1 + currentSpeed * 0.3, 1, 10);
      const t0 = performance.now();
      let placed = 0;

      while (performance.now() - t0 < budgetMs && placed < 5) {
        if (algorithm.growOnce()) {
          placed++;
          ui.drawBoard();
          ui.drawOverlay();
        } else {
          // No tiles could be placed, might be finished or stuck
          if (state.unusedTiles.size === 0) {
            // All tiles placed, stop running
            state.setRunning(false);
            uiElements.controls.btnPlay.textContent = "Play";
          }
          break;
        }
      }

      uiElements.stats.acc.textContent = String(
        state.tileCount - state.unusedTiles.size
      );
      uiElements.stats.aps.textContent = String(state.unusedTiles.size);
    } else {
      // Normal optimization mode
      const budgetMs = data.clamp(1 + currentSpeed * 0.3, 1, 10);

      const t0 = performance.now();
      let tries = 0;
      while (
        performance.now() - t0 < budgetMs &&
        tries < config.MAX_TRIES_PER_FRAME
      ) {
        tries++;
        state.incrementAttemptsThisSec();
        if (algorithm.attemptImproveOnce()) {
          state.incrementAcceptedThisSec();
          uiElements.stats.delta.textContent = state.lastDelta.toFixed(4);
          ui.drawBoard();
          ui.drawOverlay();
        }
      }
      ui.tickStats(uiElements);
    }
  }
  requestAnimationFrame(loop);
}

//////////////////////////////
// Initialization & Public API
//////////////////////////////
export function init({ canvas, overlay, controls, stats, inputs, loadingIndicator }) {
  uiElements = { controls, stats, loadingIndicator };
  overlayEl = overlay;
  inputEls = inputs;

  // Get canvas contexts
  const canvasCtx = canvas.getContext("2d", { alpha: false });
  const overlayCtx = overlay.getContext("2d");

  // Initialize canvas contexts in state
  state.initCanvases(canvasCtx, overlayCtx, canvas, overlay);

  // Set initial state
  state.setUseVector(true);
  state.setAllowRotation(true);
  state.setUseToroidalX(true);
  state.setUseToroidalY(true);

  // Update initial UI state
  controls.btnReset.disabled = true;
  controls.btnRandomize.disabled = true;
  controls.btnPlay.disabled = true;
  controls.btnStep.disabled = true;
  controls.btnSortRows.disabled = true;
  controls.btnSortCols.disabled = true;
  controls.btnPlay.textContent = "Play";

  // Bind control events
  controls.btnPlay.addEventListener("click", () =>
    ui.handlePlayClick(uiElements)
  );
  controls.btnStep.addEventListener("click", () =>
    ui.handleStepClick(uiElements)
  );
  controls.btnReset.addEventListener("click", () =>
    ui.handleResetClick(uiElements)
  );
  controls.btnRandomize.addEventListener("click", () =>
    ui.handleRandomizeClick(uiElements)
  );
  controls.btnSortRows.addEventListener("click", () =>
    ui.handleSortRowsClick(uiElements)
  );
  controls.btnSortCols.addEventListener("click", () =>
    ui.handleSortColumnsClick(uiElements)
  );

  // Bind input events
  inputs.file.addEventListener("change", (e) =>
    ui.handleFileChange(e, uiElements)
  );
  inputs.chkOverlay.addEventListener("change", (e) =>
    ui.handleOverlayChange(e, overlayEl)
  );
  inputs.chkVector.addEventListener("change", (e) => ui.handleVectorChange(e));
  inputs.chkRotation.addEventListener("change", (e) =>
    ui.handleRotationChange(e)
  );
  inputs.chkGrowMode.addEventListener("change", (e) =>
    ui.handleGrowModeChange(e)
  );
  inputs.chkToroidalX.addEventListener("change", (e) =>
    ui.handleToroidalXChange(e)
  );
  inputs.chkToroidalY.addEventListener("change", (e) =>
    ui.handleToroidalYChange(e)
  );
  inputs.rngSpeed.addEventListener("input", (e) =>
    ui.handleSpeedChange(e, inputEls, (speed) => {
      currentSpeed = speed;
    })
  );

  // Try to load saved image from localStorage
  ui.tryLoadSavedImage(uiElements);

  // Start the loop
  loop();
}
