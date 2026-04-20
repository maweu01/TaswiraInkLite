/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Map Engine
   MapLibre GL JS wrapper with full style control
   ═══════════════════════════════════════════════════════ */

import State from '../state.js';
import EventBus from '../event-bus.js';

let mapInstance = null;
let tileUrlBase = 'https://tiles.openfreemap.org/styles/';

const MapEngine = {

  // ─── Initialize ────────────────────────────────────────
  async init(containerId) {
    const mapState = State.get('map');

    mapInstance = new maplibregl.Map({
      container: containerId,
      style: this._getStyleURL(mapState.style),
      center: mapState.center,
      zoom: mapState.zoom,
      bearing: mapState.bearing,
      pitch: mapState.pitch,
      attributionControl: false,
      preserveDrawingBuffer: true,    // Required for canvas capture/export
      antialias: true,
      maxPitch: 65,
      fadeDuration: 300,
    });

    this._bindEvents();
    return new Promise(resolve => {
      mapInstance.once('load', () => {
        this._onLoad();
        resolve(mapInstance);
      });
    });
  },

  // ─── Style URL Builder ──────────────────────────────────
  _getStyleURL(themeId) {
    const map = {
      'midnight-circuit': `${tileUrlBase}dark`,
      'sahara-dust':      `${tileUrlBase}positron`,
      'ocean-ink':        `${tileUrlBase}dark`,
      'arctic-minimal':   `${tileUrlBase}positron`,
      'forest-terrain':   `${tileUrlBase}liberty`,
      'neon-cyber':       `${tileUrlBase}dark`,
      'golden-hour':      `${tileUrlBase}positron`,
      'industrial-grey':  `${tileUrlBase}dark`,
    };
    return map[themeId] || `${tileUrlBase}dark`;
  },

  // ─── On Map Load ───────────────────────────────────────
  _onLoad() {
    document.getElementById('canvas-area')?.classList.add('map-ready');
    EventBus.emit('map:loaded', { map: mapInstance });

    // Apply initial theme colors
    const themeEngine = this._currentThemeEngine;
    if (themeEngine) themeEngine.applyTheme(State.get('map.style'));

    // Apply layer visibility
    this.applyLayerVisibility(State.get('layerVisibility'));
  },

  // ─── Bind Map Events ───────────────────────────────────
  _bindEvents() {
    mapInstance.on('move', () => {
      const c = mapInstance.getCenter();
      State._data.map.center = [c.lng, c.lat];
      State._data.map.zoom = mapInstance.getZoom();
      State._data.map.bearing = mapInstance.getBearing();
      State._data.map.pitch = mapInstance.getPitch();
      EventBus.emit('map:move', {
        center: [c.lng, c.lat],
        zoom: mapInstance.getZoom(),
        bearing: mapInstance.getBearing(),
        pitch: mapInstance.getPitch(),
      });
    });

    mapInstance.on('click', (e) => {
      EventBus.emit('map:click', { lngLat: e.lngLat, point: e.point });
    });

    mapInstance.on('contextmenu', (e) => {
      EventBus.emit('map:rightclick', { lngLat: e.lngLat, point: e.point });
    });

    mapInstance.on('error', (e) => {
      console.warn('[MapEngine] Map error:', e);
      EventBus.emit('map:error', e);
    });
  },

  // ─── Fly to Location ───────────────────────────────────
  flyTo(lat, lon, zoom = 12, opts = {}) {
    if (!mapInstance) return;
    mapInstance.flyTo({
      center: [lon, lat],
      zoom,
      duration: opts.duration || 1600,
      curve: opts.curve || 1.4,
      essential: true,
      ...opts,
    });
  },

  // ─── Set Map Zoom ───────────────────────────────────────
  setZoom(zoom) {
    mapInstance?.setZoom(zoom);
  },

  // ─── Set Bearing ───────────────────────────────────────
  setBearing(bearing) {
    mapInstance?.setBearing(bearing);
  },

  // ─── Set Pitch ─────────────────────────────────────────
  setPitch(pitch) {
    mapInstance?.setPitch(pitch);
  },

  // ─── Reset North ───────────────────────────────────────
  resetNorth() {
    mapInstance?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  },

  // ─── Change Base Style ─────────────────────────────────
  setStyle(themeId) {
    if (!mapInstance) return;
    const url = this._getStyleURL(themeId);
    State.set('map.style', themeId);
    mapInstance.setStyle(url);
    mapInstance.once('style.load', () => {
      EventBus.emit('map:style-loaded', { themeId });
      this.applyLayerVisibility(State.get('layerVisibility'));
    });
  },

  // ─── Layer Visibility ──────────────────────────────────
  applyLayerVisibility(visibility) {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;
    try {
      const style = mapInstance.getStyle();
      if (!style || !style.layers) return;

      style.layers.forEach(layer => {
        const id = layer.id.toLowerCase();
        let visible = 'visible';

        const isWater = id.includes('water') || id.includes('ocean') || id.includes('sea') || id.includes('lake') || id.includes('river');
        const isPark  = id.includes('park') || id.includes('green') || id.includes('grass') || id.includes('landuse-residential') || id.includes('wood') || id.includes('forest');
        const isBldg  = id.includes('building') || id.includes('structure');
        const isRoad  = id.includes('road') || id.includes('highway') || id.includes('street') || id.includes('path') || id.includes('rail');
        const isLabel = id.includes('label') || id.includes('place') || id.includes('name') || id.includes('poi');

        if (isWater    && !visibility.water)     visible = 'none';
        if (isPark     && !visibility.parks)     visible = 'none';
        if (isBldg     && !visibility.buildings) visible = 'none';
        if (isRoad     && !visibility.roads)     visible = 'none';
        if (isLabel    && !visibility.labels)    visible = 'none';

        try { mapInstance.setLayoutProperty(layer.id, 'visibility', visible); } catch(_) {}
      });
    } catch(e) {
      console.warn('[MapEngine] Layer visibility error:', e);
    }
  },

  // ─── Add GeoJSON Source + Layers ───────────────────────
  addGeoJSONLayer(layerState) {
    if (!mapInstance || !mapInstance.isStyleLoaded()) {
      mapInstance?.once('style.load', () => this.addGeoJSONLayer(layerState));
      return;
    }

    const srcId = `gjsrc_${layerState.id}`;
    const geomType = this._detectGeomType(layerState.data);

    // Remove existing if present
    this.removeGeoJSONLayer(layerState.id);

    mapInstance.addSource(srcId, {
      type: 'geojson',
      data: layerState.data,
    });

    // Add fill layer for polygons
    if (geomType === 'Polygon' || geomType === 'MultiPolygon' || geomType === 'mixed') {
      mapInstance.addLayer({
        id: `gjfill_${layerState.id}`,
        type: 'fill',
        source: srcId,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': layerState.color,
          'fill-opacity': layerState.opacity * 0.3,
        },
      });
    }

    // Add line layer
    mapInstance.addLayer({
      id: `gjline_${layerState.id}`,
      type: 'line',
      source: srcId,
      paint: {
        'line-color': layerState.color,
        'line-width': layerState.lineWidth,
        'line-opacity': layerState.opacity,
        'line-cap': 'round',
        'line-join': 'round',
      },
    });

    // Add point layer for markers
    mapInstance.addLayer({
      id: `gjcircle_${layerState.id}`,
      type: 'circle',
      source: srcId,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 5,
        'circle-color': layerState.color,
        'circle-opacity': layerState.opacity,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      },
    });
  },

  // ─── Remove GeoJSON Layer ──────────────────────────────
  removeGeoJSONLayer(id) {
    if (!mapInstance) return;
    [`gjfill_${id}`, `gjline_${id}`, `gjcircle_${id}`].forEach(layerId => {
      if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
    });
    if (mapInstance.getSource(`gjsrc_${id}`)) mapInstance.removeSource(`gjsrc_${id}`);
  },

  // ─── Toggle GeoJSON Layer Visibility ──────────────────
  toggleGeoJSONLayerVisibility(id, visible) {
    if (!mapInstance) return;
    const v = visible ? 'visible' : 'none';
    [`gjfill_${id}`, `gjline_${id}`, `gjcircle_${id}`].forEach(layerId => {
      if (mapInstance.getLayer(layerId)) {
        try { mapInstance.setLayoutProperty(layerId, 'visibility', v); } catch(_) {}
      }
    });
  },

  // ─── Add UAV Flight Path ───────────────────────────────
  addUAVPath(pathId, coordinates, color = '#F59E0B', width = 3) {
    if (!mapInstance || !mapInstance.isStyleLoaded()) {
      mapInstance?.once('style.load', () => this.addUAVPath(pathId, coordinates, color, width));
      return;
    }

    const srcId = `uavsrc_${pathId}`;
    const lineId = `uavline_${pathId}`;
    const dotId  = `uavdot_${pathId}`;

    // Remove existing
    [lineId, dotId].forEach(lid => { if (mapInstance.getLayer(lid)) mapInstance.removeLayer(lid); });
    if (mapInstance.getSource(srcId)) mapInstance.removeSource(srcId);

    mapInstance.addSource(srcId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates },
          }
        ]
      }
    });

    mapInstance.addLayer({
      id: lineId,
      type: 'line',
      source: srcId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': color,
        'line-width': width,
        'line-dasharray': [2, 1],
      },
    });

    // Waypoint dots
    mapInstance.addSource(`${srcId}_pts`, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: coordinates.map((coord, i) => ({
          type: 'Feature',
          properties: { index: i, altitude: coord[2] || 0 },
          geometry: { type: 'Point', coordinates: coord.slice(0, 2) },
        }))
      }
    });

    mapInstance.addLayer({
      id: dotId,
      type: 'circle',
      source: `${srcId}_pts`,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 6],
        'circle-color': color,
        'circle-opacity': 0.9,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      },
    });
  },

  // ─── Update UAV Drone Position Marker ─────────────────
  updateUAVMarker(lngLat, heading = 0) {
    const el = document.getElementById('uav-drone-marker');
    if (el) {
      // Update existing marker
      this._uavMarker?.setLngLat(lngLat);
    } else {
      const markerEl = document.createElement('div');
      markerEl.id = 'uav-drone-marker';
      markerEl.className = 'uav-drone-marker';
      markerEl.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <polygon points="12,2 15,18 12,15 9,18" fill="#F59E0B" stroke="#fff" stroke-width="1"/>
        </svg>
      `;
      markerEl.style.cssText = `
        width:24px;height:24px;cursor:default;
        filter:drop-shadow(0 2px 6px rgba(245,158,11,0.8));
      `;

      this._uavMarker = new maplibregl.Marker({ element: markerEl, rotationAlignment: 'map', rotation: heading })
        .setLngLat(lngLat)
        .addTo(mapInstance);
    }
    this._uavMarker?.setRotation(heading);
  },

  removeUAVMarker() {
    this._uavMarker?.remove();
    this._uavMarker = null;
  },

  // ─── Get Map Canvas ────────────────────────────────────
  getCanvas() { return mapInstance?.getCanvas(); },

  // ─── Get Map Instance ──────────────────────────────────
  getInstance() { return mapInstance; },

  // ─── Center and Bounds ─────────────────────────────────
  getCenter() { return mapInstance?.getCenter(); },
  getZoom() { return mapInstance?.getZoom(); },
  getBearing() { return mapInstance?.getBearing(); },
  getPitch() { return mapInstance?.getPitch(); },

  // ─── Fit Bounds ────────────────────────────────────────
  fitBounds(bounds, opts = {}) {
    mapInstance?.fitBounds(bounds, { padding: 40, duration: 1200, ...opts });
  },

  // ─── Detect GeoJSON Geometry Type ─────────────────────
  _detectGeomType(geojson) {
    if (!geojson) return 'unknown';
    const features = geojson.features || [geojson];
    const types = new Set(features.map(f => f.geometry?.type).filter(Boolean));
    if (types.size > 1) return 'mixed';
    return [...types][0] || 'unknown';
  },

  // ─── Calculate Bounding Box of GeoJSON ────────────────
  getBoundingBox(geojson) {
    const coords = [];
    const extract = (g) => {
      if (!g) return;
      if (g.type === 'Point') coords.push(g.coordinates);
      else if (g.type === 'LineString') coords.push(...g.coordinates);
      else if (g.type === 'Polygon') coords.push(...g.coordinates[0]);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => coords.push(...p[0]));
      else if (g.type === 'FeatureCollection') g.features.forEach(f => extract(f.geometry));
      else if (g.type === 'Feature') extract(g.geometry);
    };
    extract(geojson);
    if (!coords.length) return null;
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
  },

  // ─── Geolocation ───────────────────────────────────────
  geolocate() {
    if (!navigator.geolocation) {
      EventBus.emit('ui:toast', { msg: '⚠ Geolocation not supported', type: 'error' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.flyTo(pos.coords.latitude, pos.coords.longitude, 14);
        EventBus.emit('ui:toast', { msg: '📍 Located', type: 'success' });
      },
      () => EventBus.emit('ui:toast', { msg: '⚠ Location access denied', type: 'error' })
    );
  },

  // ─── Destroy ───────────────────────────────────────────
  destroy() {
    mapInstance?.remove();
    mapInstance = null;
  },
};

export default MapEngine;
