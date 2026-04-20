/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — UI Controller
   Wires all DOM events → modules, manages panels/modals
   ═══════════════════════════════════════════════════════ */

import State from '../state.js';
import EventBus from '../event-bus.js';
import MapEngine from '../core/map-engine.js';
import ThemeEngine from '../core/theme-engine.js';
import ExportEngine, { LAYOUTS } from '../core/export-engine.js';
import TextOverlayModule from '../modules/text-overlay.js';
import GeoJSONModule from '../modules/geojson-module.js';
import UAVModule from '../modules/uav-module.js';
import GeocoderService from '../services/geocoder.js';
import AIService from '../services/ai-service.js';
import CITY_PRESETS from '../../data/presets/cities.js';

const UIController = {

  _searchTimer: null,
  _toastQueue: [],

  // ─── Initialize All UI ─────────────────────────────────
  init() {
    this._bindToolbar();
    this._bindPanelNav();
    this._bindLocationPanel();
    this._bindThemePanel();
    this._bindTextPanel();
    this._bindLayersPanel();
    this._bindUAVPanel();
    this._bindExportPanel();
    this._bindModals();
    this._bindMapControls();
    this._bindKeyboard();
    this._bindEventBus();
    this._syncUIFromState();
    window.addEventListener('resize', () => ExportEngine.updatePosterFrame());
  },

  // ─── Toolbar ───────────────────────────────────────────
  _bindToolbar() {
    // Search
    const searchInput = document.getElementById('city-search');
    const dropdown = document.getElementById('search-dropdown');

    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (!q) { dropdown.classList.remove('visible'); return; }
      GeocoderService.search(q, (results) => this._renderSearchResults(results));
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { dropdown.classList.remove('visible'); searchInput.blur(); }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.toolbar-search')) dropdown.classList.remove('visible');
    });

    // Toolbar buttons
    document.getElementById('btn-add-text')?.addEventListener('click', () => {
      EventBus.emit('text:start-add');
      this.showToast('🖊 Click on the map to place text', 'info');
    });

    document.getElementById('btn-load-geojson')?.addEventListener('click', () => {
      this._openModal('modal-geojson');
    });

    document.getElementById('btn-load-uav')?.addEventListener('click', () => {
      this._openModal('modal-uav');
    });

    document.getElementById('btn-share')?.addEventListener('click', () => {
      this._shareURL();
    });

    document.getElementById('btn-export-quick')?.addEventListener('click', () => {
      ExportEngine.export();
    });
  },

  // ─── Search Results Dropdown ───────────────────────────
  _renderSearchResults(results) {
    const dropdown = document.getElementById('search-dropdown');
    if (!results.length) { dropdown.classList.remove('visible'); return; }

    dropdown.innerHTML = results.map(r => `
      <div class="search-result" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${r.name}" data-secondary="${r.secondary}">
        <div class="sr-name">${this._escapeHTML(r.name)}</div>
        <div class="sr-detail">${this._escapeHTML(r.secondary)}</div>
      </div>
    `).join('');

    dropdown.classList.add('visible');

    dropdown.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        const lat = parseFloat(el.dataset.lat);
        const lon = parseFloat(el.dataset.lon);
        const name = el.dataset.name;
        const secondary = el.dataset.secondary;

        MapEngine.flyTo(lat, lon, 13);
        document.getElementById('city-search').value = name;
        dropdown.classList.remove('visible');

        // Auto-update poster typography
        const cityInput = document.getElementById('exp-city');
        const subInput = document.getElementById('exp-subtitle');
        if (cityInput) cityInput.value = name;
        if (subInput) subInput.value = secondary;
        State.merge('poster', { cityName: name, subtitle: secondary });

        // Update coord inputs
        document.getElementById('input-lat').value = lat.toFixed(5);
        document.getElementById('input-lon').value = lon.toFixed(5);
      });
    });
  },

  // ─── Panel Navigation ──────────────────────────────────
  _bindPanelNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        this._activatePanel(panel);
      });
    });
  },

  _activatePanel(panelId) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.panel === panelId);
    });
    // Show correct panel section
    document.querySelectorAll('.panel-section').forEach(s => {
      s.classList.toggle('active', s.id === `panel-${panelId}`);
    });
    State.set('ui.activePanel', panelId);
  },

  // ─── Location Panel ────────────────────────────────────
  _bindLocationPanel() {
    // Coord inputs + jump
    document.getElementById('btn-goto-coords')?.addEventListener('click', () => {
      const lat = parseFloat(document.getElementById('input-lat')?.value);
      const lon = parseFloat(document.getElementById('input-lon')?.value);
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        MapEngine.flyTo(lat, lon, 13);
      } else {
        this.showToast('⚠ Invalid coordinates', 'error');
      }
    });

    // Allow Enter key on coord inputs
    ['input-lat', 'input-lon'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btn-goto-coords')?.click();
      });
    });

    // Sliders
    this._bindSlider('sl-zoom', 'lbl-zoom', (v) => {
      MapEngine.setZoom(parseFloat(v));
    }, (v) => v + '');

    this._bindSlider('sl-bearing', 'lbl-bearing', (v) => {
      MapEngine.setBearing(parseFloat(v));
    }, (v) => v + '°');

    this._bindSlider('sl-pitch', 'lbl-pitch', (v) => {
      MapEngine.setPitch(parseFloat(v));
    }, (v) => v + '°');

    // City presets
    document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = CITY_PRESETS[btn.dataset.preset];
        if (!preset) return;
        MapEngine.flyTo(preset.lat, preset.lon, preset.zoom, {
          bearing: preset.bearing || 0,
          pitch: preset.pitch || 0,
        });
        State.merge('poster', { cityName: preset.name, subtitle: preset.subtitle });
        const cityInput = document.getElementById('exp-city');
        const subInput = document.getElementById('exp-subtitle');
        if (cityInput) cityInput.value = preset.name;
        if (subInput) subInput.value = preset.subtitle;
        ThemeEngine.applyTheme(preset.theme);
        this.showToast(`📍 ${preset.name}`, 'success');
        this._activatePanel('location');
      });
    });

    // Map move → update coord displays and sliders
    EventBus.on('map:move', ({ center, zoom, bearing, pitch }) => {
      this._updateCoordDisplay(center[1], center[0]);
      this._syncSlider('sl-zoom', zoom, 'lbl-zoom', v => v.toFixed(1));
      this._syncSlider('sl-bearing', bearing, 'lbl-bearing', v => Math.round(v) + '°');
      this._syncSlider('sl-pitch', pitch, 'lbl-pitch', v => Math.round(v) + '°');
    });
  },

  _updateCoordDisplay(lat, lon) {
    const latEl = document.getElementById('disp-lat');
    const lonEl = document.getElementById('disp-lon');
    const zoomEl = document.getElementById('disp-zoom');
    const sbCoords = document.getElementById('sb-coords');
    const sbZoom = document.getElementById('sb-zoom-level');

    if (latEl) latEl.textContent = lat.toFixed(4);
    if (lonEl) lonEl.textContent = lon.toFixed(4);
    if (zoomEl) zoomEl.textContent = MapEngine.getZoom()?.toFixed(1) || '—';
    if (sbCoords) sbCoords.textContent = `${Math.abs(lat).toFixed(4)}°${lat>=0?'N':'S'}  ${Math.abs(lon).toFixed(4)}°${lon>=0?'E':'W'}`;
    if (sbZoom) sbZoom.textContent = `Z${MapEngine.getZoom()?.toFixed(1) || '—'}`;

    // Also update coord inputs if not focused
    const inputLat = document.getElementById('input-lat');
    const inputLon = document.getElementById('input-lon');
    if (inputLat && document.activeElement !== inputLat) inputLat.value = lat.toFixed(5);
    if (inputLon && document.activeElement !== inputLon) inputLon.value = lon.toFixed(5);
  },

  // ─── Theme Panel ───────────────────────────────────────
  _bindThemePanel() {
    // AI Generate
    document.getElementById('btn-ai-generate')?.addEventListener('click', async () => {
      const prompt = document.getElementById('ai-prompt')?.value.trim();
      if (!prompt) { this.showToast('⚠ Enter a description', 'warning'); return; }

      const btn = document.getElementById('btn-ai-generate');
      btn.disabled = true;
      btn.classList.add('generating');
      this.showToast('🎨 AI generating palette…', 'info');

      try {
        const palette = await AIService.generatePalette(prompt);
        await ThemeEngine.generateFromPrompt(prompt, async () => palette);
        ThemeEngine.updateActiveCard('ai-generated');
        const sbStyle = document.getElementById('sb-style');
        if (sbStyle) sbStyle.textContent = palette.themeName || 'AI Generated';
        this.showToast(`✨ "${palette.themeName || 'AI Theme'}" applied`, 'success');
      } catch(e) {
        this.showToast('⚠ ' + (e.message || 'AI generation failed'), 'error');
      } finally {
        btn.disabled = false;
        btn.classList.remove('generating');
      }
    });

    document.getElementById('ai-prompt')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-ai-generate')?.click();
    });

    // Custom color pickers
    const colorMap = {
      'cc-bg': 'bg', 'cc-water': 'water',
      'cc-road': 'road', 'cc-park': 'park', 'cc-building': 'building',
    };
    Object.entries(colorMap).forEach(([elId, key]) => {
      document.getElementById(elId)?.addEventListener('input', (e) => {
        ThemeEngine.applyCustomColors({ [key]: e.target.value });
      });
    });

    // Theme applied → update status bar
    EventBus.on('theme:applied', (theme) => {
      const sbStyle = document.getElementById('sb-style');
      if (sbStyle) sbStyle.textContent = theme.label || theme.id;
      ThemeEngine.updateActiveCard(theme.id);
    });
  },

  // ─── Text Panel ────────────────────────────────────────
  _bindTextPanel() {
    document.getElementById('btn-add-text-panel')?.addEventListener('click', () => {
      EventBus.emit('text:start-add');
      this.showToast('🖊 Click on the map to place text', 'info');
    });

    // When a text element is selected, populate controls
    EventBus.on('text:select', ({ id }) => {
      const overlay = State.getTextOverlay(id);
      if (!overlay) return;
      this._populateTextControls(overlay);
      document.getElementById('text-style-controls')?.style.setProperty('display', 'block');
      // Highlight in list
      document.querySelectorAll('.text-layer-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === id);
      });
    });

    EventBus.on('text:deleted', () => {
      document.getElementById('text-style-controls')?.style.setProperty('display', 'none');
    });

    // Wire all text control inputs
    this._bindTextControls();
  },

  _populateTextControls(overlay) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setCheck = (id, active) => { const el = document.getElementById(id); if (el) el.classList.toggle('active', !!active); };

    document.getElementById('tc-label')?.textContent && (document.getElementById('tc-label').textContent = overlay.text.substring(0, 20));
    set('tc-content', overlay.text);
    set('tc-font', overlay.fontFamily);
    set('tc-size', overlay.fontSize);
    set('tc-color', overlay.color);
    setCheck('tc-bold', overlay.bold);
    setCheck('tc-italic', overlay.italic);

    // Gradient
    setCheck('tc-grad-on', overlay.gradient.enabled);
    document.getElementById('tc-grad-body')?.style.setProperty('display', overlay.gradient.enabled ? 'block' : 'none');
    set('tc-grad-from', overlay.gradient.from);
    set('tc-grad-to', overlay.gradient.to);
    set('tc-grad-angle', overlay.gradient.angle);
    document.getElementById('lbl-grad-angle').textContent = overlay.gradient.angle + '°';

    // Glow
    setCheck('tc-glow-on', overlay.glow.enabled);
    document.getElementById('tc-glow-body')?.style.setProperty('display', overlay.glow.enabled ? 'block' : 'none');
    set('tc-glow-color', overlay.glow.color);
    set('tc-glow-blur', overlay.glow.blur);
    document.getElementById('lbl-glow-blur').textContent = overlay.glow.blur + 'px';
    set('tc-glow-spread', overlay.glow.spread);

    // Stroke
    setCheck('tc-stroke-on', overlay.stroke.enabled);
    document.getElementById('tc-stroke-body')?.style.setProperty('display', overlay.stroke.enabled ? 'block' : 'none');
    set('tc-stroke-color', overlay.stroke.color);
    set('tc-stroke-width', overlay.stroke.width);
    document.getElementById('lbl-stroke-width').textContent = overlay.stroke.width + 'px';

    // Shadow
    setCheck('tc-shadow-on', overlay.shadow.enabled);
    document.getElementById('tc-shadow-body')?.style.setProperty('display', overlay.shadow.enabled ? 'block' : 'none');
    set('tc-shadow-color', overlay.shadow.color);
    set('tc-shadow-blur', overlay.shadow.blur);
    set('tc-shadow-x', overlay.shadow.offsetX);
    set('tc-shadow-y', overlay.shadow.offsetY);

    set('tc-rotation', overlay.rotation);
    document.getElementById('lbl-rotation').textContent = overlay.rotation + '°';
    set('tc-opacity', Math.round(overlay.opacity * 100));
    document.getElementById('lbl-opacity').textContent = Math.round(overlay.opacity * 100) + '%';
  },

  _bindTextControls() {
    const getSelectedId = () => State.get('ui.selectedTextId');

    const wire = (id, updater) => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        const selId = getSelectedId();
        if (!selId) return;
        updater(e.target.value, selId);
      });
    };

    wire('tc-content', (v, id) => State.updateTextOverlay(id, { text: v }));
    wire('tc-font', (v, id) => State.updateTextOverlay(id, { fontFamily: v }));
    wire('tc-size', (v, id) => State.updateTextOverlay(id, { fontSize: parseInt(v) || 48 }));
    wire('tc-color', (v, id) => State.updateTextOverlay(id, { color: v }));
    wire('tc-grad-from', (v, id) => { const o = State.getTextOverlay(id); if (o) State.updateTextOverlay(id, { gradient: {...o.gradient, from: v} }); });
    wire('tc-grad-to', (v, id) => { const o = State.getTextOverlay(id); if (o) State.updateTextOverlay(id, { gradient: {...o.gradient, to: v} }); });
    this._bindSlider('tc-grad-angle', 'lbl-grad-angle', (v, id = getSelectedId()) => {
      const o = State.getTextOverlay(id);
      if (o) State.updateTextOverlay(id, { gradient: {...o.gradient, angle: parseInt(v)} });
    }, v => v + '°');
    wire('tc-glow-color', (v, id) => { const o = State.getTextOverlay(id); if (o) State.updateTextOverlay(id, { glow: {...o.glow, color: v} }); });
    this._bindSlider('tc-glow-blur', 'lbl-glow-blur', (v) => {
      const id = getSelectedId(); const o = State.getTextOverlay(id);
      if (o) State.updateTextOverlay(id, { glow: {...o.glow, blur: parseInt(v)} });
    }, v => v + 'px');
    this._bindSlider('tc-glow-spread', 'lbl-glow-spread', (v) => {
      const id = getSelectedId(); const o = State.getTextOverlay(id);
      if (o) State.updateTextOverlay(id, { glow: {...o.glow, spread: parseInt(v)} });
    }, v => v + '×');
    wire('tc-stroke-color', (v, id) => { const o = State.getTextOverlay(id); if (o) State.updateTextOverlay(id, { stroke: {...o.stroke, color: v} }); });
    this._bindSlider('tc-stroke-width', 'lbl-stroke-width', (v) => {
      const id = getSelectedId(); const o = State.getTextOverlay(id);
      if (o) State.updateTextOverlay(id, { stroke: {...o.stroke, width: parseInt(v)} });
    }, v => v + 'px');
    wire('tc-shadow-color', (v, id) => { const o = State.getTextOverlay(id); if (o) State.updateTextOverlay(id, { shadow: {...o.shadow, color: v} }); });
    this._bindSlider('tc-shadow-blur', 'lbl-shadow-blur', (v) => {
      const id = getSelectedId(); const o = State.getTextOverlay(id);
      if (o) State.updateTextOverlay(id, { shadow: {...o.shadow, blur: parseInt(v)} });
    }, v => v + 'px');
    this._bindSlider('tc-shadow-x', 'lbl-shadow-x', (v) => {
      const id = getSelectedId(); const o = State.getTextOverlay(id);
      if (o) State.updateTextOverlay(id, { shadow: {...o.shadow, offsetX: parseInt(v)} });
    }, v => v + 'px');
    this._bindSlider('tc-shadow-y', 'lbl-shadow-y', (v) => {
      const id = getSelectedId(); const o = State.getTextOverlay(id);
      if (o) State.updateTextOverlay(id, { shadow: {...o.shadow, offsetY: parseInt(v)} });
    }, v => v + 'px');

    this._bindSlider('tc-rotation', 'lbl-rotation', (v) => {
      const id = getSelectedId();
      if (id) State.updateTextOverlay(id, { rotation: parseInt(v) });
    }, v => v + '°');
    this._bindSlider('tc-opacity', 'lbl-opacity', (v) => {
      const id = getSelectedId();
      if (id) State.updateTextOverlay(id, { opacity: parseInt(v) / 100 });
    }, v => v + '%');

    // Toggle buttons (bold, italic)
    document.getElementById('tc-bold')?.addEventListener('click', () => {
      const id = getSelectedId(); if (!id) return;
      const o = State.getTextOverlay(id); if (!o) return;
      State.updateTextOverlay(id, { bold: !o.bold });
      document.getElementById('tc-bold')?.classList.toggle('active', !o.bold);
    });
    document.getElementById('tc-italic')?.addEventListener('click', () => {
      const id = getSelectedId(); if (!id) return;
      const o = State.getTextOverlay(id); if (!o) return;
      State.updateTextOverlay(id, { italic: !o.italic });
      document.getElementById('tc-italic')?.classList.toggle('active', !o.italic);
    });

    // Effect toggle switches
    const bindEffectToggle = (btnId, bodyId, stateKey) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        const id = getSelectedId(); if (!id) return;
        const o = State.getTextOverlay(id); if (!o) return;
        const newVal = !o[stateKey].enabled;
        State.updateTextOverlay(id, { [stateKey]: {...o[stateKey], enabled: newVal} });
        document.getElementById(btnId)?.classList.toggle('active', newVal);
        document.getElementById(bodyId)?.style.setProperty('display', newVal ? 'block' : 'none');
      });
    };
    bindEffectToggle('tc-grad-on', 'tc-grad-body', 'gradient');
    bindEffectToggle('tc-glow-on', 'tc-glow-body', 'glow');
    bindEffectToggle('tc-stroke-on', 'tc-stroke-body', 'stroke');
    bindEffectToggle('tc-shadow-on', 'tc-shadow-body', 'shadow');

    // Delete selected text
    document.getElementById('btn-delete-text')?.addEventListener('click', () => {
      const id = getSelectedId();
      if (id) State.deleteTextOverlay(id);
    });
  },

  // ─── Layers Panel ──────────────────────────────────────
  _bindLayersPanel() {
    document.getElementById('btn-add-layer')?.addEventListener('click', () => {
      this._openModal('modal-geojson');
    });

    // Map layer toggle switches
    document.querySelectorAll('.toggle-switch[data-layer]').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const layer = toggle.dataset.layer;
        const isNowActive = toggle.classList.toggle('active');
        const visibility = State.get('layerVisibility');
        visibility[layer] = isNowActive;
        State.set('layerVisibility', { ...visibility });
        MapEngine.applyLayerVisibility(visibility);
      });
    });
  },

  // ─── UAV Panel ─────────────────────────────────────────
  _bindUAVPanel() {
    document.getElementById('uav-play')?.addEventListener('click', () => UAVModule.play());
    document.getElementById('uav-pause')?.addEventListener('click', () => UAVModule.pause());
    document.getElementById('uav-stop')?.addEventListener('click', () => UAVModule.stop());
    document.getElementById('uav-rewind')?.addEventListener('click', () => UAVModule.rewind());

    this._bindSlider('uav-speed', 'lbl-uav-speed', (v) => {
      State.set('uav.speed', parseInt(v));
    }, v => v + '×');

    document.getElementById('uav-path-color')?.addEventListener('input', (e) => {
      const w = document.getElementById('uav-path-width')?.value || 3;
      UAVModule.updatePathStyle(e.target.value, parseInt(w));
    });

    this._bindSlider('uav-path-width', 'lbl-uav-width', (v) => {
      const c = document.getElementById('uav-path-color')?.value || '#F59E0B';
      UAVModule.updatePathStyle(c, parseInt(v));
    }, v => v + 'px');

    document.getElementById('uav-animate-toggle')?.addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('active');
    });
  },

  // ─── Export Panel ──────────────────────────────────────
  _bindExportPanel() {
    document.getElementById('exp-layout')?.addEventListener('change', (e) => {
      const layout = e.target.value;
      State.set('poster.layout', layout);
      document.getElementById('custom-dims').style.display = layout === 'custom' ? 'grid' : 'none';
      ExportEngine.updatePosterFrame();
    });

    document.getElementById('exp-w')?.addEventListener('input', (e) => {
      State.set('poster.width', parseInt(e.target.value));
      ExportEngine.updatePosterFrame();
    });

    document.getElementById('exp-h')?.addEventListener('input', (e) => {
      State.set('poster.height', parseInt(e.target.value));
      ExportEngine.updatePosterFrame();
    });

    // Format pills
    document.querySelectorAll('.fpill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.fpill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        State.set('poster.format', pill.dataset.fmt);
      });
    });

    // Resolution buttons
    document.querySelectorAll('.res-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.set('poster.resolution', parseInt(btn.dataset.res));
        ExportEngine.updatePosterFrame();
      });
    });

    // Typography
    document.getElementById('exp-city')?.addEventListener('input', (e) => State.set('poster.cityName', e.target.value));
    document.getElementById('exp-subtitle')?.addEventListener('input', (e) => State.set('poster.subtitle', e.target.value));

    // Toggle switches
    document.getElementById('toggle-show-coords')?.addEventListener('click', (e) => {
      const active = e.currentTarget.classList.toggle('active');
      State.set('poster.showCoords', active);
    });
    document.getElementById('toggle-show-scale')?.addEventListener('click', (e) => {
      const active = e.currentTarget.classList.toggle('active');
      State.set('poster.showScale', active);
    });

    this._bindSlider('exp-jpeg-quality', 'lbl-jpeg-quality', (v) => {
      State.set('poster.jpegQuality', parseInt(v) / 100);
    }, v => v);

    document.getElementById('btn-export-main')?.addEventListener('click', () => {
      ExportEngine.export();
    });
  },

  // ─── Modals ────────────────────────────────────────────
  _bindModals() {
    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this._closeModal(btn.dataset.close));
    });

    document.getElementById('modal-backdrop')?.addEventListener('click', () => {
      const open = State.get('ui.modalOpen');
      if (open) this._closeModal(open);
    });

    // GeoJSON modal
    const gjInput = document.getElementById('geojson-file-input');
    document.getElementById('geojson-file-btn')?.addEventListener('click', () => gjInput?.click());
    gjInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const nameInput = document.getElementById('geojson-name');
      if (nameInput && !nameInput.value) {
        nameInput.value = file.name.replace(/\.(geojson|json)$/i, '');
      }
      try {
        const text = await file.text();
        document.getElementById('geojson-paste').value = text;
      } catch(e) {
        this.showToast('⚠ Failed to read file', 'error');
      }
    });

    this._bindDropzone('geojson-dropzone', 'geojson-file-input', async (file) => {
      try { await GeoJSONModule.importFromFile(file); this._closeModal('modal-geojson'); }
      catch(e) { this.showToast('⚠ ' + e.message, 'error'); }
    });

    document.getElementById('btn-import-geojson')?.addEventListener('click', async () => {
      const paste = document.getElementById('geojson-paste')?.value.trim();
      const name = document.getElementById('geojson-name')?.value.trim() || 'Layer';
      if (!paste) { this.showToast('⚠ No GeoJSON provided', 'error'); return; }
      try {
        await GeoJSONModule.importFromString(paste, name);
        this._closeModal('modal-geojson');
        this.showToast('✓ Layer imported', 'success');
        this._activatePanel('layers');
      } catch(e) {
        this.showToast('⚠ ' + e.message, 'error');
      }
    });

    // UAV modal
    const uavInput = document.getElementById('uav-file-input');
    document.getElementById('uav-file-btn')?.addEventListener('click', () => uavInput?.click());
    uavInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        EventBus.emit('uav:load', data);
        this._closeModal('modal-uav');
        this._activatePanel('uav');
      } catch(err) {
        this.showToast('⚠ ' + err.message, 'error');
      }
    });

    this._bindDropzone('uav-dropzone', 'uav-file-input', async (file) => {
      try {
        const text = await file.text();
        EventBus.emit('uav:load', JSON.parse(text));
        this._closeModal('modal-uav');
        this._activatePanel('uav');
      } catch(e) { this.showToast('⚠ ' + e.message, 'error'); }
    });

    document.getElementById('btn-load-sample-uav')?.addEventListener('click', () => {
      UAVModule.loadSamplePath();
      this._closeModal('modal-uav');
      this._activatePanel('uav');
      MapEngine.flyTo(-4.0435, 39.6682, 14);
    });
  },

  _openModal(id) {
    document.getElementById(id)?.classList.add('visible');
    document.getElementById('modal-backdrop')?.classList.add('visible');
    State.set('ui.modalOpen', id);
  },

  _closeModal(id) {
    document.getElementById(id)?.classList.remove('visible');
    document.getElementById('modal-backdrop')?.classList.remove('visible');
    State.set('ui.modalOpen', null);
  },

  _bindDropzone(zoneId, inputId, onFile) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files?.[0];
      if (file) await onFile(file);
    });
    zone.addEventListener('click', () => document.getElementById(inputId)?.click());
  },

  // ─── Map Controls ──────────────────────────────────────
  _bindMapControls() {
    document.getElementById('mc-zoom-in')?.addEventListener('click', () => MapEngine.getInstance()?.zoomIn());
    document.getElementById('mc-zoom-out')?.addEventListener('click', () => MapEngine.getInstance()?.zoomOut());
    document.getElementById('mc-reset-north')?.addEventListener('click', () => MapEngine.resetNorth());
    document.getElementById('mc-geolocate')?.addEventListener('click', () => MapEngine.geolocate());
  },

  // ─── Keyboard Shortcuts ────────────────────────────────
  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Prevent shortcuts when typing
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      switch(e.key) {
        case 't': case 'T': EventBus.emit('text:start-add'); break;
        case '+': case '=': MapEngine.getInstance()?.zoomIn(); e.preventDefault(); break;
        case '-': MapEngine.getInstance()?.zoomOut(); e.preventDefault(); break;
        case 'n': case 'N': if (e.shiftKey) MapEngine.resetNorth(); break;
        case 'Escape':
          TextOverlayModule.deselectAll();
          const modal = State.get('ui.modalOpen');
          if (modal) this._closeModal(modal);
          break;
        default: TextOverlayModule.handleKeyboard(e);
      }
    });
  },

  // ─── EventBus Listeners ────────────────────────────────
  _bindEventBus() {
    EventBus.on('ui:toast', ({ msg, type }) => this.showToast(msg, type));
    EventBus.on('map:loaded', () => {
      ExportEngine.updatePosterFrame();
      const center = MapEngine.getCenter();
      if (center) this._updateCoordDisplay(center.lat, center.lng);
    });
  },

  // ─── Toast System ──────────────────────────────────────
  showToast(msg, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✓', error: '⚠', warning: '⚡', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${this._escapeHTML(msg)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ─── Share URL ─────────────────────────────────────────
  _shareURL() {
    const url = new URL(window.location.href);
    url.search = State.toURL();
    navigator.clipboard?.writeText(url.toString())
      .then(() => this.showToast('📋 Link copied', 'success'))
      .catch(() => this.showToast('⚠ Copy failed', 'error'));
  },

  // ─── Sync UI from State ────────────────────────────────
  _syncUIFromState() {
    const poster = State.get('poster');
    const map = State.get('map');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('exp-city', poster.cityName);
    setVal('exp-subtitle', poster.subtitle);
    setVal('exp-layout', poster.layout);
    setVal('sl-zoom', map.zoom);
    setVal('sl-bearing', map.bearing);
    setVal('sl-pitch', map.pitch);

    document.getElementById('lbl-zoom')?.textContent && (document.getElementById('lbl-zoom').textContent = map.zoom);
    document.getElementById('lbl-bearing')?.textContent && (document.getElementById('lbl-bearing').textContent = map.bearing + '°');
    document.getElementById('lbl-pitch')?.textContent && (document.getElementById('lbl-pitch').textContent = map.pitch + '°');
    this._updateCoordDisplay(map.center[1], map.center[0]);
  },

  // ─── Slider Helper ─────────────────────────────────────
  _bindSlider(slId, lblId, onChange, format = v => v) {
    const slider = document.getElementById(slId);
    const label = document.getElementById(lblId);
    if (!slider) return;
    slider.addEventListener('input', (e) => {
      if (label) label.textContent = format(e.target.value);
      onChange(e.target.value);
    });
  },

  _syncSlider(slId, val, lblId, format) {
    const sl = document.getElementById(slId);
    const lb = document.getElementById(lblId);
    if (sl && document.activeElement !== sl) sl.value = val;
    if (lb) lb.textContent = format ? format(val) : val;
  },

  // ─── Escape HTML ───────────────────────────────────────
  _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};

export default UIController;
