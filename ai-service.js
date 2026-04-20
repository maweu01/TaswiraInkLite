/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — AI Theme Service
   Claude API integration for cartographic palette gen
   ═══════════════════════════════════════════════════════ */

const AIService = {

  _model: 'claude-sonnet-4-20250514',

  // ─── Generate Cartographic Palette ────────────────────
  async generatePalette(prompt) {
    const systemPrompt = `You are a world-class cartographic color designer specializing in map art and print design.
You understand color theory, geographic aesthetics, and the interplay between map elements.

Given a description of a map vibe or location, generate a cohesive cartographic color palette.

Your response MUST be a single JSON object with exactly these keys:
{
  "bg": "#hex",
  "water": "#hex",
  "road": "#hex",
  "park": "#hex",
  "building": "#hex",
  "text": "#hex",
  "mapStyle": "dark" | "light",
  "themeName": "string (3-4 word evocative name)"
}

Rules:
- Colors must be harmonious, print-quality, and map-appropriate
- bg = base land/background color
- water = rivers, lakes, ocean
- road = street/highway network
- park = vegetation, green space
- building = building footprints
- text = labels, overlays
- mapStyle: use "dark" for night/moody themes, "light" for day/airy themes
- themeName: a poetic, place-evocative name (e.g. "Coral Harbour Dusk")
- Return ONLY the JSON object, no explanation, no markdown`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this._model,
          max_tokens: 512,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Cartographic vibe: "${prompt}"\n\nGenerate the color palette JSON.`,
          }],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text?.trim() || '';

      // Strip any accidental markdown fences
      const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const palette = JSON.parse(clean);

      this._validatePalette(palette);
      return palette;

    } catch(e) {
      if (e.message.includes('JSON')) {
        throw new Error('AI returned invalid color data. Try a more specific description.');
      }
      throw e;
    }
  },

  // ─── Generate Map Style Description ───────────────────
  async generateStyleDescription(lat, lon, cityName) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this._model,
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `In 1-2 evocative sentences, describe the cartographic aesthetic for a poster map of ${cityName} (${lat.toFixed(2)}, ${lon.toFixed(2)}). Focus on light, color mood, and geographic character. Be poetic but brief.`,
          }],
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.content?.[0]?.text?.trim() || null;
    } catch(e) {
      return null;
    }
  },

  // ─── Validate Palette Structure ────────────────────────
  _validatePalette(palette) {
    const required = ['bg', 'water', 'road', 'park', 'building'];
    for (const key of required) {
      if (!palette[key]) throw new Error(`Missing palette key: ${key}`);
      if (!/^#[0-9A-Fa-f]{3,8}$/.test(palette[key])) {
        throw new Error(`Invalid hex color for ${key}: ${palette[key]}`);
      }
    }
  },

  // ─── Check if API Key is configured ───────────────────
  isConfigured() {
    // In browser environment, API calls are proxied or key is embedded
    // For production, use a backend proxy to protect the key
    return true; // Optimistic — real auth check happens at call time
  },
};

export default AIService;
