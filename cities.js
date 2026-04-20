/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — City Presets Data
   Africa-first preset locations with theme pairing
   ═══════════════════════════════════════════════════════ */

export const CITY_PRESETS = {
  mombasa: {
    id: 'mombasa',
    name: 'Mombasa',
    subtitle: 'Kenya · East Africa',
    countryCode: 'KE',
    lat: -4.0435,
    lon: 39.6682,
    zoom: 13,
    bearing: 0,
    pitch: 0,
    theme: 'midnight-circuit',
    description: 'Historic coastal city and Kenya\'s second largest city',
    mapStyle: 'dark',
    aiPrompt: 'Mombasa at twilight, Indian Ocean coral blues, amber port lights, warm humid night',
  },

  nairobi: {
    id: 'nairobi',
    name: 'Nairobi',
    subtitle: 'Kenya · East Africa',
    countryCode: 'KE',
    lat: -1.2921,
    lon: 36.8219,
    zoom: 13,
    bearing: 15,
    pitch: 0,
    theme: 'industrial-grey',
    description: 'East Africa\'s technology and finance capital',
    mapStyle: 'dark',
    aiPrompt: 'Nairobi CBD at midnight, dark glass towers, amber streetlights, digital city grid',
  },

  lagos: {
    id: 'lagos',
    name: 'Lagos',
    subtitle: 'Nigeria · West Africa',
    countryCode: 'NG',
    lat: 6.5244,
    lon: 3.3792,
    zoom: 12,
    bearing: 0,
    pitch: 0,
    theme: 'neon-cyber',
    description: 'Africa\'s largest city and economic powerhouse',
    mapStyle: 'dark',
    aiPrompt: 'Lagos island megacity, vivid neon energy, Atlantic coastline, electric night density',
  },

  cairo: {
    id: 'cairo',
    name: 'Cairo',
    subtitle: 'Egypt · North Africa',
    countryCode: 'EG',
    lat: 30.0444,
    lon: 31.2357,
    zoom: 12,
    bearing: 0,
    pitch: 0,
    theme: 'sahara-dust',
    description: 'Ancient capital city on the Nile River',
    mapStyle: 'light',
    aiPrompt: 'Cairo ancient city, Nile gold and desert ochre, sand dust, warm pharaonic amber',
  },

  'cape-town': {
    id: 'cape-town',
    name: 'Cape Town',
    subtitle: 'South Africa · Southern Africa',
    countryCode: 'ZA',
    lat: -33.9249,
    lon: 18.4241,
    zoom: 12,
    bearing: 0,
    pitch: 10,
    theme: 'ocean-ink',
    description: 'Cape Peninsula — where two oceans meet',
    mapStyle: 'dark',
    aiPrompt: 'Cape Town harbour dusk, Atlantic ocean deep blue, Table Mountain granite, cold clean air',
  },

  zanzibar: {
    id: 'zanzibar',
    name: 'Zanzibar',
    subtitle: 'Tanzania · Indian Ocean',
    countryCode: 'TZ',
    lat: -6.1659,
    lon: 39.2026,
    zoom: 12,
    bearing: 0,
    pitch: 0,
    theme: 'golden-hour',
    description: 'Spice Island of the Indian Ocean',
    mapStyle: 'light',
    aiPrompt: 'Zanzibar spice island, turquoise reef waters, ivory sand, golden dhow sails at sunset',
  },
};

export const CITY_PRESET_IDS = Object.keys(CITY_PRESETS);

export default CITY_PRESETS;
