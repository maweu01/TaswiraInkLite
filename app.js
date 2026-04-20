/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Application Entry Point
   Boot sequence: Splash → Map → Modules → UI
   ═══════════════════════════════════════════════════════ */

import State from './state.js';
import EventBus from './event-bus.js';
import MapEngine from './core/map-engine.js';
import ThemeEngine from './core/theme-engine.js';
import ExportEngine from './core/export-engine.js';
import TextOverlayModule from './modules/text-overlay.js';
import GeoJSONModule from './modules/geojson-module.js';
import UAVModule from './modules/uav-module.js';
import UIController from './ui/ui-controller.js';

// ─── Boot Sequence ────────────────────────────────────────
async function boot() {
  const splash = document.getElementById('splash-screen');
  const statusEl = document.getElementById('splash-status');
  const barEl = document.querySelector('.splash-bar');
  const appEl = document.getElementById('app');

  const setStatus = (msg, pct) => {
    if (statusEl) statusEl.textContent = msg;
    if (barEl) barEl.style.width = pct + '%';
  };

  // Remove loading class after splash
  appEl?.classList.remove('loading');

  setStatus('Loading state…', 10);
  await tick();

  // ── Step 1: Load state from URL params ──────────────────
  State.fromURL();
  setStatus('Initializing map engine…', 25);
  await tick();

  // ── Step 2: Build theme swatches (before map loads) ─────
  ThemeEngine.buildThemeGrid();
  setStatus('Building theme engine…', 38);
  await tick();

  // ── Step 3: Initialize map ──────────────────────────────
  setStatus('Loading map tiles…', 50);
  try {
    await MapEngine.init('map');
  } catch(e) {
    console.error('[Boot] Map init failed:', e);
    setStatus('⚠ Map load failed — retrying…', 50);
    await delay(1000);
    await MapEngine.init('map');
  }

  setStatus('Initializing modules…', 68);
  await tick();

  // ── Step 4: Init all modules ────────────────────────────
  TextOverlayModule.init();
  GeoJSONModule.init();
  UAVModule.init();
  setStatus('Wiring UI controllers…', 82);
  await tick();

  // ── Step 5: Wire all UI events ──────────────────────────
  UIController.init();
  setStatus('Configuring poster frame…', 92);
  await tick();

  // ── Step 6: Update poster frame ─────────────────────────
  ExportEngine.updatePosterFrame();
  window.addEventListener('resize', () => ExportEngine.updatePosterFrame());

  setStatus('Ready.', 100);
  await delay(350);

  // ── Step 7: Hide splash ─────────────────────────────────
  splash?.classList.add('hidden');

  // ── Step 8: Apply initial theme from URL ────────────────
  const themeId = State.get('map.style');
  ThemeEngine.updateActiveCard(themeId);
  const sbStyle = document.getElementById('sb-style');
  if (sbStyle && themeId) {
    const { THEMES } = await import('./core/theme-engine.js');
    sbStyle.textContent = THEMES[themeId]?.label || themeId;
  }

  // ── Step 9: Emit ready ──────────────────────────────────
  EventBus.emit('app:ready', { timestamp: Date.now() });
  console.log(
    '%c 🗺 Taswira Space Ink v2 ',
    'background:linear-gradient(135deg,#5B8DEF,#00C9A7);color:#fff;font-weight:bold;padding:4px 10px;border-radius:6px;font-size:12px'
  );
  console.log('%c Cartographic Artistry Engine — Ready', 'color:#5B8DEF;font-size:11px');
}

// ─── Utility Helpers ─────────────────────────────────────
function tick() { return new Promise(r => requestAnimationFrame(() => r())); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Handle Unhandled Errors ──────────────────────────────
window.addEventListener('unhandledrejection', (e) => {
  console.error('[App] Unhandled rejection:', e.reason);
  EventBus.emit('ui:toast', {
    msg: '⚠ Unexpected error: ' + (e.reason?.message || String(e.reason)).substring(0, 60),
    type: 'error',
  });
});

// ─── Start ────────────────────────────────────────────────
boot();
