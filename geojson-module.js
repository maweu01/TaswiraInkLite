/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — GeoJSON Module
   Import, validate, style, and render GeoJSON layers
   ═══════════════════════════════════════════════════════ */

import State from '../state.js';
import EventBus from '../event-bus.js';
import MapEngine from '../core/map-engine.js';

const LAYER_COLORS = [
  '#5B8DEF', '#00C9A7', '#A78BFA', '#F59E0B',
  '#F87171', '#34D399', '#60A5FA', '#FB923C',
];

let colorIdx = 0;

const GeoJSONModule = {

  init() {
    EventBus.on('geojson:added', (layer) => {
      MapEngine.addGeoJSONLayer(layer);
      this._addLayerToPanel(layer);
    });

    EventBus.on('geojson:removed', (layer) => {
      MapEngine.removeGeoJSONLayer(layer.id);
      this._removeLayerFromPanel(layer.id);
    });

    EventBus.on('geojson:toggled', (layer) => {
      MapEngine.toggleGeoJSONLayerVisibility(layer.id, layer.visible);
      this._updateLayerVisibilityInPanel(layer);
    });

    EventBus.on('map:style-loaded', () => {
      // Re-add all GeoJSON layers after style reload
      const layers = State.get('geojsonLayers') || [];
      layers.forEach(layer => MapEngine.addGeoJSONLayer(layer));
    });
  },

  // ─── Import from String / File ─────────────────────────
  async importFromString(jsonStr, name = 'Layer') {
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch(e) {
      throw new Error('Invalid JSON: ' + e.message);
    }
    return this.importFromObject(data, name);
  },

  importFromObject(geojson, name = 'Layer') {
    const validated = this._validate(geojson);
    if (!validated.valid) {
      throw new Error('Invalid GeoJSON: ' + validated.error);
    }

    const color = LAYER_COLORS[colorIdx % LAYER_COLORS.length];
    colorIdx++;

    const layer = State.addGeoJSONLayer({
      name,
      data: geojson,
      color,
      opacity: 0.85,
      lineWidth: 2,
    });

    // Fit to bounds
    const bbox = MapEngine.getBoundingBox(geojson);
    if (bbox) MapEngine.fitBounds(bbox, { padding: 60 });

    return layer;
  },

  // ─── Import from File ──────────────────────────────────
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const layer = this.importFromString(e.target.result, file.name.replace(/\.(geojson|json)$/i, ''));
          resolve(layer);
        } catch(err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    });
  },

  // ─── Validate GeoJSON ──────────────────────────────────
  _validate(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Not a valid object' };
    }
    const validTypes = ['FeatureCollection', 'Feature', 'Point', 'LineString',
                        'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'];
    if (!validTypes.includes(data.type)) {
      return { valid: false, error: `Unknown type: ${data.type}` };
    }
    if (data.type === 'FeatureCollection') {
      if (!Array.isArray(data.features)) {
        return { valid: false, error: 'FeatureCollection missing "features" array' };
      }
      if (data.features.length === 0) {
        return { valid: false, error: 'FeatureCollection has no features' };
      }
    }
    return { valid: true };
  },

  // ─── Add Layer Card to Panel ───────────────────────────
  _addLayerToPanel(layer) {
    const list = document.getElementById('geojson-layer-list');
    if (!list) return;

    const empty = list.querySelector('.empty-state');
    if (empty) empty.remove();

    const geomType = this._getGeomTypeLabel(layer.data);
    const featureCount = layer.data?.features?.length || 1;

    const item = document.createElement('div');
    item.className = 'layer-item';
    item.id = `layer_item_${layer.id}`;
    item.innerHTML = `
      <div class="layer-color-swatch" style="background:${layer.color}"></div>
      <span class="layer-name" title="${layer.name}">${layer.name}</span>
      <span class="layer-type-badge">${geomType} · ${featureCount}</span>
      <button class="toggle-switch active" data-gjlayer="${layer.id}" title="Toggle visibility">
        <div class="ts-thumb"></div>
      </button>
      <button class="btn-icon-sm danger" data-dellayer="${layer.id}" title="Remove layer" style="margin-left:4px">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
        </svg>
      </button>
    `;

    // Toggle visibility
    item.querySelector(`[data-gjlayer="${layer.id}"]`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      State.toggleGeoJSONLayer(layer.id);
      e.currentTarget.classList.toggle('active');
    });

    // Delete layer
    item.querySelector(`[data-dellayer="${layer.id}"]`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      State.removeGeoJSONLayer(layer.id);
    });

    list.appendChild(item);
  },

  _removeLayerFromPanel(id) {
    document.getElementById(`layer_item_${id}`)?.remove();

    const list = document.getElementById('geojson-layer-list');
    if (list && !list.querySelector('.layer-item')) {
      list.innerHTML = `
        <div class="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
          <p>No GeoJSON layers loaded.<br/>Click "+ Import" to load a file.</p>
        </div>`;
    }
  },

  _updateLayerVisibilityInPanel(layer) {
    const toggle = document.querySelector(`[data-gjlayer="${layer.id}"]`);
    if (toggle) toggle.classList.toggle('active', layer.visible);
  },

  _getGeomTypeLabel(geojson) {
    if (!geojson) return 'Unknown';
    const features = geojson.features || [geojson];
    const types = new Set(features.map(f => {
      const t = f.geometry?.type || f.type;
      if (t?.includes('Point')) return 'Point';
      if (t?.includes('Line')) return 'Line';
      if (t?.includes('Polygon')) return 'Polygon';
      return t;
    }).filter(Boolean));
    return [...types].join('/') || 'Mixed';
  },
};

export default GeoJSONModule;
