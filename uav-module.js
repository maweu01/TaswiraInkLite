/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — UAV Flight Path Module
   Mission path visualization, animation, telemetry
   ═══════════════════════════════════════════════════════ */

import State from '../state.js';
import EventBus from '../event-bus.js';
import MapEngine from '../core/map-engine.js';

const UAVModule = {

  _pathId: 'uav_primary',
  _coordinates: [],
  _animFrame: null,
  _step: 0,
  _playing: false,
  _droneMarkerOnMap: null,

  // ─── Initialize ────────────────────────────────────────
  init() {
    EventBus.on('uav:load', (data) => this.loadPath(data));
    EventBus.on('map:style-loaded', () => {
      // Re-render UAV layer after style change
      if (this._coordinates.length) {
        const uavState = State.get('uav');
        MapEngine.addUAVPath(
          this._pathId,
          this._coordinates,
          uavState.pathColor,
          uavState.pathWidth
        );
      }
    });
  },

  // ─── Load Flight Path from GeoJSON ─────────────────────
  loadPath(geojson) {
    try {
      const coords = this._extractCoordinates(geojson);
      if (!coords || coords.length < 2) {
        EventBus.emit('ui:toast', {
          msg: '⚠ No valid LineString found in GeoJSON',
          type: 'error',
        });
        return;
      }

      this._coordinates = coords;
      this._step = 0;
      this._playing = false;

      const uavState = State.get('uav');
      State.set('uav.paths', [{ id: this._pathId, coords }]);
      State.set('uav.currentStep', 0);

      // Render path on map
      MapEngine.addUAVPath(
        this._pathId,
        coords,
        uavState.pathColor,
        uavState.pathWidth
      );

      // Fit map to path bounds
      const bbox = MapEngine.getBoundingBox(geojson);
      if (bbox) MapEngine.fitBounds(bbox, { padding: 80 });

      // Compute stats
      const stats = this._computeStats(coords);
      this._updateTelemetryUI(stats);
      this._showControls(stats);

      EventBus.emit('ui:toast', {
        msg: `✓ Flight path loaded — ${stats.waypointCount} waypoints, ${stats.distanceKm} km`,
        type: 'success',
      });

    } catch(e) {
      console.error('[UAVModule] Load error:', e);
      EventBus.emit('ui:toast', { msg: '⚠ Failed to parse flight path', type: 'error' });
    }
  },

  // ─── Extract Coordinates from GeoJSON ─────────────────
  _extractCoordinates(geojson) {
    const features = geojson.features || [geojson];
    for (const feature of features) {
      const geom = feature.geometry;
      if (!geom) continue;
      if (geom.type === 'LineString' && geom.coordinates?.length >= 2) {
        return geom.coordinates;
      }
      if (geom.type === 'MultiLineString' && geom.coordinates?.length) {
        // Concatenate all line segments
        return geom.coordinates.flat();
      }
    }
    return null;
  },

  // ─── Compute Path Statistics ───────────────────────────
  _computeStats(coords) {
    let totalDist = 0;
    for (let i = 1; i < coords.length; i++) {
      totalDist += this._haversine(coords[i-1], coords[i]);
    }
    const avgSpeedMs = 15; // 15 m/s typical survey UAV
    const durationSec = totalDist / avgSpeedMs;

    return {
      waypointCount: coords.length,
      distanceKm: (totalDist / 1000).toFixed(2),
      durationMin: Math.round(durationSec / 60),
      altitudes: coords.map(c => c[2] || 0),
      avgAlt: coords.reduce((s, c) => s + (c[2] || 0), 0) / coords.length,
    };
  },

  // ─── Haversine Distance (meters) ──────────────────────
  _haversine([lon1, lat1], [lon2, lat2]) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  // ─── Compute Bearing between Two Points ───────────────
  _bearing([lon1, lat1], [lon2, lat2]) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  },

  // ─── Playback ─────────────────────────────────────────
  play() {
    if (this._playing || !this._coordinates.length) return;
    if (this._step >= this._coordinates.length - 1) this._step = 0;
    this._playing = true;
    this._animate();
    document.getElementById('uav-play')?.classList.add('active');
  },

  pause() {
    this._playing = false;
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    document.getElementById('uav-play')?.classList.remove('active');
  },

  stop() {
    this.pause();
    this._step = 0;
    State.set('uav.currentStep', 0);
    MapEngine.removeUAVMarker();
    this._updateProgress(0);
  },

  rewind() {
    this.stop();
  },

  // ─── Animation Loop ────────────────────────────────────
  _animate() {
    if (!this._playing) return;

    const speed = State.get('uav.speed') || 5;
    this._step = Math.min(this._step + speed * 0.02, this._coordinates.length - 1);
    State.set('uav.currentStep', this._step);

    const idx = Math.floor(this._step);
    const coord = this._coordinates[idx];
    if (!coord) { this.stop(); return; }

    // Update drone marker on map
    const lngLat = [coord[0], coord[1]];
    const nextIdx = Math.min(idx + 1, this._coordinates.length - 1);
    const heading = this._bearing(coord, this._coordinates[nextIdx]);
    MapEngine.updateUAVMarker(lngLat, heading);

    // Update telemetry
    const alt = coord[2] || 0;
    const progress = (this._step / (this._coordinates.length - 1)) * 100;
    const distSoFar = this._distanceSoFar(idx);
    const totalDist = this._computeStats(this._coordinates).distanceKm;

    document.getElementById('tel-alt')?.setAttribute('data-val', alt.toFixed(0) + ' m');
    const telAlt = document.getElementById('tel-alt');
    if (telAlt) telAlt.textContent = alt.toFixed(0) + ' m';

    const telSpd = document.getElementById('tel-spd');
    if (telSpd) telSpd.textContent = '15.0 m/s';

    const telHdg = document.getElementById('tel-hdg');
    if (telHdg) telHdg.textContent = heading.toFixed(1) + '°';

    const telProg = document.getElementById('tel-prog');
    if (telProg) telProg.textContent = progress.toFixed(1) + '%';

    this._updateProgress(progress);

    if (this._step >= this._coordinates.length - 1) {
      this._playing = false;
      document.getElementById('uav-play')?.classList.remove('active');
      EventBus.emit('ui:toast', { msg: '✓ Flight path complete', type: 'success' });
      return;
    }

    this._animFrame = requestAnimationFrame(() => this._animate());
  },

  _distanceSoFar(idx) {
    let d = 0;
    for (let i = 1; i <= idx && i < this._coordinates.length; i++) {
      d += this._haversine(this._coordinates[i-1], this._coordinates[i]);
    }
    return (d / 1000).toFixed(2);
  },

  _updateProgress(pct) {
    // Visual progress could be shown in a future progress bar element
    State.set('uav.currentStep', (pct / 100) * (this._coordinates.length - 1));
  },

  // ─── Update Path Style ─────────────────────────────────
  updatePathStyle(color, width) {
    State.merge('uav', { pathColor: color, pathWidth: width });
    if (this._coordinates.length) {
      MapEngine.addUAVPath(this._pathId, this._coordinates, color, width);
    }
  },

  // ─── Update Telemetry Panel ────────────────────────────
  _updateTelemetryUI(stats) {
    const wp = document.getElementById('uav-waypoints');
    const dist = document.getElementById('uav-distance');
    const dur = document.getElementById('uav-duration');
    if (wp)   wp.textContent = stats.waypointCount;
    if (dist) dist.textContent = stats.distanceKm + ' km';
    if (dur)  dur.textContent = stats.durationMin + ' min';
  },

  // ─── Show UAV Controls Panel ───────────────────────────
  _showControls(stats) {
    document.getElementById('uav-status')?.style.setProperty('display', 'none');
    const ctrl = document.getElementById('uav-controls');
    if (ctrl) ctrl.style.display = 'flex';
  },

  // ─── Load Sample Mombasa Survey Path ──────────────────
  loadSamplePath() {
    // Synthetic Mombasa coastal survey grid pattern
    const base = [39.6682, -4.0435];
    const coords = [];
    const rows = 6;
    const cols = 8;
    const stepLon = 0.003;
    const stepLat = 0.002;
    const surveyAlt = 120;

    for (let row = 0; row < rows; row++) {
      const lat = base[1] + row * stepLat;
      const isEven = row % 2 === 0;
      for (let col = 0; col < cols; col++) {
        const c = isEven ? col : (cols - 1 - col);
        coords.push([
          base[0] + c * stepLon,
          lat,
          surveyAlt + Math.sin(row * 0.5 + col * 0.3) * 10,
        ]);
      }
    }

    this.loadPath({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: 'Mombasa Coastal Survey', operator: 'GeoCart', altitude: surveyAlt },
        geometry: { type: 'LineString', coordinates: coords },
      }]
    });
  },

  // ─── Validate GeoJSON ──────────────────────────────────
  validateGeoJSON(geojson) {
    if (!geojson) return false;
    if (geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature' && !geojson.coordinates) return false;
    return true;
  },

  // ─── State Getters ─────────────────────────────────────
  isLoaded() { return this._coordinates.length > 0; },
  getCoordinates() { return this._coordinates; },
  isPlaying() { return this._playing; },
};

export default UAVModule;
