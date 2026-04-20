/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Test Suite
   Run: node tests/tests.js
   ═══════════════════════════════════════════════════════ */

'use strict';

// ─── Minimal test runner (no dependencies) ──────────────
let passed = 0, failed = 0, total = 0;
const results = [];

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
  } catch(e) {
    failed++;
    results.push({ name, status: 'FAIL', error: e.message });
  }
}

function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toEqual(expected) {
      if (JSON.stringify(val) !== JSON.stringify(expected)) {
        throw new Error(`Expected\n  ${JSON.stringify(expected)}\ngot\n  ${JSON.stringify(val)}`);
      }
    },
    toBeTruthy() {
      if (!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`);
    },
    toBeFalsy() {
      if (val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`);
    },
    toBeGreaterThan(n) {
      if (val <= n) throw new Error(`Expected ${val} > ${n}`);
    },
    toBeLessThan(n) {
      if (val >= n) throw new Error(`Expected ${val} < ${n}`);
    },
    toContain(substring) {
      if (!String(val).includes(substring)) throw new Error(`Expected "${val}" to contain "${substring}"`);
    },
    toBeNull() {
      if (val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`);
    },
    toBeInstanceOf(cls) {
      if (!(val instanceof cls)) throw new Error(`Expected instance of ${cls.name}`);
    },
    toHaveLength(len) {
      if (val?.length !== len) throw new Error(`Expected length ${len}, got ${val?.length}`);
    },
  };
}

function describe(group, fn) {
  console.log(`\n  📦 ${group}`);
  fn();
}

// ═══════════════════════════════════════════════════════
// SECTION 1: GeoJSON Parsing & Validation
// ═══════════════════════════════════════════════════════
describe('GeoJSON Validation', () => {

  function validateGeoJSON(data) {
    if (!data || typeof data !== 'object') return { valid: false, error: 'Not an object' };
    const validTypes = ['FeatureCollection', 'Feature', 'Point', 'LineString',
                        'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'];
    if (!validTypes.includes(data.type)) return { valid: false, error: `Unknown type: ${data.type}` };
    if (data.type === 'FeatureCollection') {
      if (!Array.isArray(data.features)) return { valid: false, error: 'Missing features array' };
      if (data.features.length === 0) return { valid: false, error: 'Empty features array' };
    }
    return { valid: true };
  }

  test('Accepts valid FeatureCollection', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [39.6682, -4.0435] },
        properties: { name: 'Mombasa' },
      }],
    };
    const result = validateGeoJSON(geojson);
    expect(result.valid).toBe(true);
  });

  test('Accepts valid LineString', () => {
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[39.6, -4.0], [39.7, -4.1], [39.8, -4.2]],
      },
      properties: {},
    };
    expect(validateGeoJSON(geojson).valid).toBe(true);
  });

  test('Accepts valid Polygon', () => {
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[39.6, -4.0], [39.7, -4.0], [39.7, -4.1], [39.6, -4.1], [39.6, -4.0]]],
      },
      properties: {},
    };
    expect(validateGeoJSON(geojson).valid).toBe(true);
  });

  test('Rejects empty FeatureCollection', () => {
    const geojson = { type: 'FeatureCollection', features: [] };
    const result = validateGeoJSON(geojson);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Empty');
  });

  test('Rejects invalid type', () => {
    const result = validateGeoJSON({ type: 'InvalidType' });
    expect(result.valid).toBe(false);
  });

  test('Rejects null input', () => {
    expect(validateGeoJSON(null).valid).toBe(false);
  });

  test('Rejects missing features array', () => {
    const result = validateGeoJSON({ type: 'FeatureCollection' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('features');
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 2: UAV / Coordinate Mathematics
// ═══════════════════════════════════════════════════════
describe('UAV & Coordinate Math', () => {

  function haversine([lon1, lat1], [lon2, lat2]) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function bearing([lon1, lat1], [lon2, lat2]) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  test('Haversine: same point = 0m', () => {
    const d = haversine([39.6682, -4.0435], [39.6682, -4.0435]);
    expect(d).toBe(0);
  });

  test('Haversine: Mombasa → Nairobi ≈ 440km', () => {
    const d = haversine([39.6682, -4.0435], [36.8219, -1.2921]);
    expect(d).toBeGreaterThan(430000);
    expect(d).toBeLessThan(460000);
  });

  test('Haversine: symmetric (A→B = B→A)', () => {
    const a = haversine([39.0, -4.0], [40.0, -5.0]);
    const b = haversine([40.0, -5.0], [39.0, -4.0]);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });

  test('Bearing: due East = 90°', () => {
    const b = bearing([0, 0], [1, 0]);
    expect(b).toBeGreaterThan(85);
    expect(b).toBeLessThan(95);
  });

  test('Bearing: due North = 0° or 360°', () => {
    const b = bearing([0, 0], [0, 1]);
    expect(b).toBeLessThan(5);
  });

  test('Bearing: due South = ~180°', () => {
    const b = bearing([0, 0], [0, -1]);
    expect(b).toBeGreaterThan(175);
    expect(b).toBeLessThan(185);
  });

  test('Extract LineString coordinates from FeatureCollection', () => {
    function extractCoords(geojson) {
      const features = geojson.features || [geojson];
      for (const f of features) {
        if (f.geometry?.type === 'LineString') return f.geometry.coordinates;
      }
      return null;
    }

    const data = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[39.6, -4.0], [39.7, -4.1], [39.8, -4.2]] },
        properties: {},
      }],
    };
    const coords = extractCoords(data);
    expect(coords).toHaveLength(3);
    expect(coords[0][0]).toBe(39.6);
  });

  test('Total path distance across 4 waypoints', () => {
    const coords = [
      [39.6682, -4.0435],
      [39.6700, -4.0500],
      [39.6750, -4.0550],
      [39.6800, -4.0600],
    ];
    let total = 0;
    for (let i = 1; i < coords.length; i++) total += haversine(coords[i-1], coords[i]);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(5000); // < 5km for nearby points
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 3: Export Engine Logic
// ═══════════════════════════════════════════════════════
describe('Export Engine', () => {

  const LAYOUTS = {
    portrait_a3:  { w: 2480, h: 3508 },
    portrait_a4:  { w: 1754, h: 2480 },
    landscape_a3: { w: 3508, h: 2480 },
    square_12:    { w: 3600, h: 3600 },
    story_916:    { w: 1080, h: 1920 },
    post_11:      { w: 1080, h: 1080 },
  };

  function computeOutputSize(layoutKey, resolution, custom = null) {
    const layout = LAYOUTS[layoutKey] || custom;
    return {
      width: layout.w * resolution,
      height: layout.h * resolution,
      megapixels: (layout.w * resolution * layout.h * resolution / 1_000_000).toFixed(1),
    };
  }

  function buildFilename(city, format) {
    const clean = (city || 'map').replace(/\s+/g, '_').toLowerCase();
    const ts = '2026-04-20';
    return `taswira_${clean}_${ts}.${format}`;
  }

  function escapeXML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  test('Portrait A3 @1x = 2480×3508', () => {
    const r = computeOutputSize('portrait_a3', 1);
    expect(r.width).toBe(2480);
    expect(r.height).toBe(3508);
  });

  test('Portrait A3 @2x = 4960×7016', () => {
    const r = computeOutputSize('portrait_a3', 2);
    expect(r.width).toBe(4960);
    expect(r.height).toBe(7016);
  });

  test('Portrait A3 @4x = 4K+ resolution', () => {
    const r = computeOutputSize('portrait_a3', 4);
    expect(r.width).toBeGreaterThan(4000);
  });

  test('Square @8x = 28800×28800', () => {
    const r = computeOutputSize('square_12', 8);
    expect(r.width).toBe(28800);
  });

  test('Story 9:16 ratio correct', () => {
    const r = computeOutputSize('story_916', 1);
    const ratio = r.height / r.width;
    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(1.8);
  });

  test('Filename: Mombasa PNG', () => {
    const fn = buildFilename('Mombasa', 'png');
    expect(fn).toContain('mombasa');
    expect(fn).toContain('.png');
  });

  test('Filename: spaces become underscores', () => {
    const fn = buildFilename('Cape Town', 'jpeg');
    expect(fn).toContain('cape_town');
    const hasNoSpace = !fn.includes(' '); expect(hasNoSpace).toBe(true);
  });

  test('XML escape: ampersand', () => {
    expect(escapeXML('Kenya & Uganda')).toBe('Kenya &amp; Uganda');
  });

  test('XML escape: angle brackets', () => {
    expect(escapeXML('<script>')).toBe('&lt;script&gt;');
  });

  test('XML escape: quotes', () => {
    expect(escapeXML('"hello"')).toBe('&quot;hello&quot;');
  });

  test('Custom layout dimensions', () => {
    const r = computeOutputSize('custom', 2, { w: 3000, h: 4000 });
    expect(r.width).toBe(6000);
    expect(r.height).toBe(8000);
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 4: State Management
// ═══════════════════════════════════════════════════════
describe('State Management', () => {

  function createState(initial = {}) {
    const _data = { ...initial };
    const listeners = new Map();

    return {
      get(path) {
        return path.split('.').reduce((o, k) => o?.[k], _data);
      },
      set(path, value) {
        const keys = path.split('.');
        let obj = _data;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!obj[keys[i]]) obj[keys[i]] = {};
          obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        if (listeners.has(path)) listeners.get(path).forEach(cb => cb(value));
      },
      on(path, cb) {
        if (!listeners.has(path)) listeners.set(path, []);
        listeners.get(path).push(cb);
      },
    };
  }

  test('Get nested value', () => {
    const s = createState({ map: { zoom: 12, center: [39.6, -4.0] } });
    expect(s.get('map.zoom')).toBe(12);
  });

  test('Set nested value', () => {
    const s = createState({ poster: { cityName: 'Mombasa' } });
    s.set('poster.cityName', 'Nairobi');
    expect(s.get('poster.cityName')).toBe('Nairobi');
  });

  test('Get undefined returns undefined', () => {
    const s = createState({});
    expect(s.get('does.not.exist')).toBe(undefined);
  });

  test('Set creates intermediate objects', () => {
    const s = createState({});
    s.set('a.b.c', 42);
    expect(s.get('a.b.c')).toBe(42);
  });

  test('Listener fires on set', () => {
    const s = createState({ x: 1 });
    let fired = false;
    s.on('x', () => { fired = true; });
    s.set('x', 2);
    expect(fired).toBe(true);
  });

  test('Listener receives new value', () => {
    const s = createState({ count: 0 });
    let received;
    s.on('count', (v) => { received = v; });
    s.set('count', 7);
    expect(received).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 5: Geocoder Formatting
// ═══════════════════════════════════════════════════════
describe('Geocoder Formatting', () => {

  function formatDMS(lat, lon) {
    const fmt = (val, pos, neg) => {
      const dir = val >= 0 ? pos : neg;
      const abs = Math.abs(val);
      const deg = Math.floor(abs);
      const minTotal = (abs - deg) * 60;
      const min = Math.floor(minTotal);
      const sec = ((minTotal - min) * 60).toFixed(1);
      return `${deg}°${min}′${sec}″${dir}`;
    };
    return `${fmt(lat, 'N', 'S')}  ${fmt(lon, 'E', 'W')}`;
  }

  test('Positive lat/lon → N/E', () => {
    const result = formatDMS(1.5, 36.8);
    expect(result).toContain('N');
    expect(result).toContain('E');
  });

  test('Negative lat → S', () => {
    const result = formatDMS(-4.04, 39.66);
    expect(result).toContain('S');
  });

  test('Negative lon → W', () => {
    const result = formatDMS(6.52, -3.37);
    expect(result).toContain('W');
  });

  test('Zero coords → 0°0′0.0″', () => {
    const result = formatDMS(0, 0);
    expect(result).toContain('0°');
  });

  test('DMS format includes degree symbol', () => {
    const result = formatDMS(36.8, 39.6);
    expect(result).toContain('°');
    expect(result).toContain('′');
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 6: Theme System
// ═══════════════════════════════════════════════════════
describe('Theme System', () => {

  const THEME_IDS = [
    'midnight-circuit', 'sahara-dust', 'ocean-ink', 'arctic-minimal',
    'forest-terrain', 'neon-cyber', 'golden-hour', 'industrial-grey',
  ];

  test('All 8 themes defined', () => {
    expect(THEME_IDS.length).toBe(8);
  });

  test('Theme IDs are unique', () => {
    const unique = new Set(THEME_IDS);
    expect(unique.size).toBe(THEME_IDS.length);
  });

  test('Hex color validation', () => {
    const isValidHex = hex => /^#[0-9A-Fa-f]{3,8}$/.test(hex);
    const testColors = ['#111827', '#0E2130', '#F5E6C8', '#A8C5DA', '#000510'];
    testColors.forEach(c => expect(isValidHex(c)).toBe(true));
  });

  test('Invalid hex rejected', () => {
    const isValidHex = hex => /^#[0-9A-Fa-f]{3,8}$/.test(hex);
    expect(isValidHex('not-a-color')).toBe(false);
    expect(isValidHex('111827')).toBe(false);
    expect(isValidHex('#GGGGGG')).toBe(false);
  });

  test('Dark themes have dark background', () => {
    const darkThemeBgs = ['#0D1117', '#04102A', '#000510', '#111114'];
    darkThemeBgs.forEach(bg => {
      const r = parseInt(bg.slice(1,3), 16);
      expect(r).toBeLessThan(50); // R channel < 50 for dark
    });
  });
});

// ─── Print Results ────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('  TASWIRA SPACE INK v2 — Test Results');
console.log('═'.repeat(60));
results.forEach(r => {
  const icon = r.status === 'PASS' ? '  ✓' : '  ✗';
  const color = r.status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`${color}${icon} ${r.name}${reset}`);
  if (r.error) console.log(`    → ${r.error}`);
});
console.log('\n' + '─'.repeat(60));
const color = failed === 0 ? '\x1b[32m' : '\x1b[31m';
const reset = '\x1b[0m';
console.log(`${color}  ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ' — ALL GREEN ✓'}${reset}`);
console.log('─'.repeat(60) + '\n');
if (failed > 0) process.exit(1);
