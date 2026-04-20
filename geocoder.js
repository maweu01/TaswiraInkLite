/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Geocoder Service
   Nominatim-based geocoding with cache & debounce
   ═══════════════════════════════════════════════════════ */

const GeocoderService = {

  _cache: new Map(),
  _timer: null,
  _DEBOUNCE_MS: 380,
  _MAX_RESULTS: 7,

  // ─── Search with Debounce ──────────────────────────────
  search(query, callback) {
    clearTimeout(this._timer);
    if (!query || query.trim().length < 2) {
      callback([]);
      return;
    }
    this._timer = setTimeout(async () => {
      const results = await this._fetch(query.trim());
      callback(results);
    }, this._DEBOUNCE_MS);
  },

  // ─── Cancel pending search ─────────────────────────────
  cancel() {
    clearTimeout(this._timer);
  },

  // ─── Fetch from Nominatim ──────────────────────────────
  async _fetch(query) {
    const cacheKey = query.toLowerCase();
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', String(this._MAX_RESULTS));
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('extratags', '1');
      url.searchParams.set('accept-language', 'en');

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TaswiraSpaceInk/2.0',
        },
      });

      if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

      const raw = await res.json();
      const parsed = raw.map(r => this._parseResult(r));
      this._cache.set(cacheKey, parsed);
      return parsed;

    } catch(e) {
      console.warn('[GeocoderService] Search failed:', e);
      return [];
    }
  },

  // ─── Parse Nominatim Result ────────────────────────────
  _parseResult(r) {
    const addr = r.address || {};
    const displayParts = r.display_name.split(',');
    const primaryName = (
      addr.city || addr.town || addr.village || addr.county ||
      addr.state || addr.country || displayParts[0] || ''
    ).trim();

    const secondaryParts = [];
    if (addr.state && addr.state !== primaryName) secondaryParts.push(addr.state);
    if (addr.country) secondaryParts.push(addr.country);
    const secondary = secondaryParts.join(', ') || displayParts.slice(1, 3).join(', ');

    return {
      id: r.place_id,
      name: primaryName,
      displayName: r.display_name,
      secondary: secondary.trim(),
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      type: r.type,
      class: r.class,
      importance: r.importance || 0,
      boundingBox: r.boundingbox
        ? r.boundingbox.map(parseFloat)
        : null,
      countryCode: addr.country_code?.toUpperCase() || '',
    };
  },

  // ─── Reverse Geocode (coords → name) ──────────────────
  async reverse(lat, lon) {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('lat', lat.toFixed(6));
      url.searchParams.set('lon', lon.toFixed(6));
      url.searchParams.set('format', 'json');
      url.searchParams.set('accept-language', 'en');

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'TaswiraSpaceInk/2.0' },
      });

      if (!res.ok) return null;
      const data = await res.json();
      return this._parseResult(data);
    } catch(e) {
      return null;
    }
  },

  // ─── Format Coordinates for Display ───────────────────
  formatCoordsDMS(lat, lon) {
    const fmt = (val, posLabel, negLabel) => {
      const dir = val >= 0 ? posLabel : negLabel;
      const abs = Math.abs(val);
      const deg = Math.floor(abs);
      const minTotal = (abs - deg) * 60;
      const min = Math.floor(minTotal);
      const sec = ((minTotal - min) * 60).toFixed(1);
      return `${deg}°${min}′${sec}″${dir}`;
    };
    return `${fmt(lat, 'N', 'S')}  ${fmt(lon, 'E', 'W')}`;
  },

  // ─── Clear Cache ───────────────────────────────────────
  clearCache() { this._cache.clear(); },
};

export default GeocoderService;
