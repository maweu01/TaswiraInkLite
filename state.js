/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Application State
   Single source of truth for all app data
   ═══════════════════════════════════════════════════════ */

import EventBus from './event-bus.js';

const State = {
  _data: {
    // Map view
    map: {
      center: [39.6682, -4.0435],   // Mombasa default
      zoom: 12,
      bearing: 0,
      pitch: 0,
      style: 'midnight-circuit',
    },

    // Poster layout
    poster: {
      layout: 'portrait_a3',
      width: 2480,
      height: 3508,
      resolution: 2,
      format: 'png',
      jpegQuality: 0.92,
      cityName: 'Mombasa',
      subtitle: 'Kenya · East Africa',
      showCoords: true,
      showScale: true,
    },

    // Active theme
    theme: {
      id: 'midnight-circuit',
      customColors: {
        bg: '#111827',
        water: '#1e3a5f',
        road: '#2d3748',
        park: '#1a3a2a',
        building: '#374151',
      },
    },

    // Text overlays array
    textOverlays: [],

    // GeoJSON layers
    geojsonLayers: [],

    // UAV flight paths
    uav: {
      paths: [],
      isPlaying: false,
      speed: 5,
      currentStep: 0,
      animating: true,
      pathColor: '#F59E0B',
      pathWidth: 3,
    },

    // Map layer visibility
    layerVisibility: {
      water: true,
      parks: true,
      buildings: true,
      roads: true,
      labels: true,
    },

    // UI state
    ui: {
      activePanel: 'location',
      selectedTextId: null,
      isAddingText: false,
      modalOpen: null,
    },

    // Export state
    export: {
      loading: false,
      progress: 0,
      status: '',
    },
  },

  // ─── Getters ───────────────────────────────────────────
  get(path) {
    const keys = path.split('.');
    let val = this._data;
    for (const k of keys) {
      if (val === undefined || val === null) return undefined;
      val = val[k];
    }
    return val;
  },

  // ─── Setters ───────────────────────────────────────────
  set(path, value) {
    const keys = path.split('.');
    let obj = this._data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] === undefined) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    const lastKey = keys[keys.length - 1];
    const oldValue = obj[lastKey];
    obj[lastKey] = value;
    EventBus.emit(`state:${path}`, { value, oldValue });
    EventBus.emit('state:change', { path, value, oldValue });
  },

  // ─── Merge update ──────────────────────────────────────
  merge(path, updates) {
    const current = this.get(path);
    if (typeof current === 'object' && current !== null) {
      this.set(path, { ...current, ...updates });
    }
  },

  // ─── Text Overlays ─────────────────────────────────────
  addTextOverlay(overlay) {
    const newOverlay = {
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
      text: 'New Text',
      x: 50,    // percent of container
      y: 50,
      fontSize: 48,
      fontFamily: 'Syne',
      bold: false,
      italic: false,
      color: '#ffffff',
      opacity: 1,
      rotation: 0,
      gradient: { enabled: false, from: '#5B8DEF', to: '#A78BFA', angle: 90 },
      glow: { enabled: false, color: '#5B8DEF', blur: 20, spread: 2 },
      stroke: { enabled: false, color: '#000000', width: 2 },
      shadow: { enabled: false, color: '#000000', blur: 10, offsetX: 2, offsetY: 4 },
      ...overlay,
    };
    this._data.textOverlays.push(newOverlay);
    EventBus.emit('text:added', newOverlay);
    return newOverlay;
  },

  updateTextOverlay(id, updates) {
    const idx = this._data.textOverlays.findIndex(t => t.id === id);
    if (idx === -1) return;
    Object.assign(this._data.textOverlays[idx], updates);
    EventBus.emit('text:updated', this._data.textOverlays[idx]);
  },

  deleteTextOverlay(id) {
    const idx = this._data.textOverlays.findIndex(t => t.id === id);
    if (idx === -1) return;
    const removed = this._data.textOverlays.splice(idx, 1)[0];
    EventBus.emit('text:deleted', removed);
    if (this._data.ui.selectedTextId === id) {
      this.set('ui.selectedTextId', null);
    }
  },

  getTextOverlay(id) {
    return this._data.textOverlays.find(t => t.id === id);
  },

  // ─── GeoJSON Layers ────────────────────────────────────
  addGeoJSONLayer(layer) {
    const newLayer = {
      id: `gjson_${Date.now()}`,
      name: 'Layer',
      data: null,
      visible: true,
      color: '#5B8DEF',
      opacity: 0.8,
      lineWidth: 2,
      ...layer,
    };
    this._data.geojsonLayers.push(newLayer);
    EventBus.emit('geojson:added', newLayer);
    return newLayer;
  },

  removeGeoJSONLayer(id) {
    const idx = this._data.geojsonLayers.findIndex(l => l.id === id);
    if (idx === -1) return;
    const removed = this._data.geojsonLayers.splice(idx, 1)[0];
    EventBus.emit('geojson:removed', removed);
  },

  toggleGeoJSONLayer(id) {
    const layer = this._data.geojsonLayers.find(l => l.id === id);
    if (!layer) return;
    layer.visible = !layer.visible;
    EventBus.emit('geojson:toggled', layer);
  },

  // ─── URL State Serialization ────────────────────────────
  toURL() {
    const m = this._data.map;
    const p = this._data.poster;
    return new URLSearchParams({
      lat: m.center[1].toFixed(5),
      lon: m.center[0].toFixed(5),
      zoom: m.zoom.toFixed(2),
      bearing: m.bearing.toFixed(1),
      pitch: m.pitch.toFixed(1),
      theme: m.style,
      city: p.cityName,
      sub: p.subtitle,
    }).toString();
  },

  fromURL() {
    const p = new URLSearchParams(window.location.search);
    if (p.get('lat') && p.get('lon')) {
      this._data.map.center = [parseFloat(p.get('lon')), parseFloat(p.get('lat'))];
    }
    if (p.get('zoom')) this._data.map.zoom = parseFloat(p.get('zoom'));
    if (p.get('bearing')) this._data.map.bearing = parseFloat(p.get('bearing'));
    if (p.get('pitch')) this._data.map.pitch = parseFloat(p.get('pitch'));
    if (p.get('theme')) this._data.map.style = p.get('theme');
    if (p.get('city')) this._data.poster.cityName = p.get('city');
    if (p.get('sub')) this._data.poster.subtitle = p.get('sub');
  },
};

export default State;
