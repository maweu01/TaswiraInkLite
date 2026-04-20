/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Theme Engine
   8 curated cartographic themes with full style control
   ═══════════════════════════════════════════════════════ */

import State from '../state.js';
import EventBus from '../event-bus.js';
import MapEngine from './map-engine.js';

export const THEMES = {
  'midnight-circuit': {
    id: 'midnight-circuit',
    label: 'Midnight Circuit',
    base: 'dark',
    emoji: '🌑',
    colors: {
      bg: '#0D1117',
      water: '#0E2130',
      road: '#1C2635',
      park: '#0E1F14',
      building: '#1A2535',
      roadHighway: '#3B82F6',
    },
    layerPaint: {
      'background': { 'background-color': '#0D1117' },
      'water': { 'fill-color': '#0E2130' },
      'waterway': { 'line-color': '#0E2130' },
    },
    swatchColors: ['#0D1117', '#0E2130', '#1C2635', '#0E1F14', '#3B82F6'],
  },

  'sahara-dust': {
    id: 'sahara-dust',
    label: 'Sahara Dust',
    base: 'positron',
    emoji: '🏜',
    colors: {
      bg: '#F5E6C8',
      water: '#A8C5DA',
      road: '#C4A882',
      park: '#C8D8A0',
      building: '#D4B97A',
    },
    swatchColors: ['#F5E6C8', '#A8C5DA', '#C4A882', '#C8D8A0', '#D4B97A'],
  },

  'ocean-ink': {
    id: 'ocean-ink',
    label: 'Ocean Ink',
    base: 'dark',
    emoji: '🌊',
    colors: {
      bg: '#04102A',
      water: '#0A2040',
      road: '#102840',
      park: '#0A2020',
      building: '#152838',
    },
    swatchColors: ['#04102A', '#0A2040', '#102840', '#0A2020', '#2DD4BF'],
  },

  'arctic-minimal': {
    id: 'arctic-minimal',
    label: 'Arctic Minimal',
    base: 'positron',
    emoji: '❄',
    colors: {
      bg: '#F0F4F8',
      water: '#C8DCF0',
      road: '#CBD5E0',
      park: '#C8DDD0',
      building: '#A0AEC0',
    },
    swatchColors: ['#F0F4F8', '#C8DCF0', '#CBD5E0', '#C8DDD0', '#A0AEC0'],
  },

  'forest-terrain': {
    id: 'forest-terrain',
    label: 'Forest Terrain',
    base: 'liberty',
    emoji: '🌿',
    colors: {
      bg: '#1A2810',
      water: '#1A3A50',
      road: '#2D3A1A',
      park: '#1F3A15',
      building: '#2A3820',
    },
    swatchColors: ['#1A2810', '#1A3A50', '#2D3A1A', '#1F3A15', '#4CAF50'],
  },

  'neon-cyber': {
    id: 'neon-cyber',
    label: 'Neon Cyber',
    base: 'dark',
    emoji: '⚡',
    colors: {
      bg: '#000510',
      water: '#001020',
      road: '#0A0A1A',
      park: '#001810',
      building: '#0A0A0A',
      accent: '#00FFFF',
    },
    swatchColors: ['#000510', '#001020', '#00FFFF', '#FF0080', '#00FF80'],
  },

  'golden-hour': {
    id: 'golden-hour',
    label: 'Golden Hour',
    base: 'positron',
    emoji: '🌅',
    colors: {
      bg: '#FFF8E8',
      water: '#7BADE8',
      road: '#E8C87A',
      park: '#D4E8A0',
      building: '#D4A840',
    },
    swatchColors: ['#FFF8E8', '#7BADE8', '#E8C87A', '#D4E8A0', '#F59E0B'],
  },

  'industrial-grey': {
    id: 'industrial-grey',
    label: 'Industrial Grey',
    base: 'dark',
    emoji: '🏭',
    colors: {
      bg: '#111114',
      water: '#1A1A2A',
      road: '#2A2A2A',
      park: '#182018',
      building: '#252525',
      accent: '#6B7280',
    },
    swatchColors: ['#111114', '#1A1A2A', '#2A2A2A', '#252525', '#6B7280'],
  },
};

const ThemeEngine = {

  _currentTheme: null,

  // ─── Apply Theme ────────────────────────────────────────
  applyTheme(themeId) {
    const theme = THEMES[themeId];
    if (!theme) return;

    this._currentTheme = theme;
    State.set('theme.id', themeId);
    State.set('theme.customColors', theme.colors);

    // Switch base map style if needed
    MapEngine.setStyle(themeId);

    // Update UI color pickers
    this._syncColorPickers(theme.colors);

    EventBus.emit('theme:applied', theme);
    return theme;
  },

  // ─── Apply from Custom Colors ──────────────────────────
  applyCustomColors(colors) {
    const map = MapEngine.getInstance();
    if (!map || !map.isStyleLoaded()) return;

    try {
      // Apply background
      if (colors.bg) {
        const style = map.getStyle();
        style.layers.forEach(layer => {
          if (layer.type === 'background') {
            try { map.setPaintProperty(layer.id, 'background-color', colors.bg); } catch(_) {}
          }
        });
      }

      // Water
      if (colors.water) {
        map.getStyle().layers.forEach(layer => {
          const id = layer.id.toLowerCase();
          if (id.includes('water') && !id.includes('way')) {
            try {
              if (layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', colors.water);
              if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-color', colors.water);
            } catch(_) {}
          }
        });
      }

      // Roads
      if (colors.road) {
        map.getStyle().layers.forEach(layer => {
          const id = layer.id.toLowerCase();
          if ((id.includes('road') || id.includes('street') || id.includes('path')) && layer.type === 'line') {
            try { map.setPaintProperty(layer.id, 'line-color', colors.road); } catch(_) {}
          }
        });
      }

      // Parks
      if (colors.park) {
        map.getStyle().layers.forEach(layer => {
          const id = layer.id.toLowerCase();
          if ((id.includes('park') || id.includes('green') || id.includes('grass')) && layer.type === 'fill') {
            try { map.setPaintProperty(layer.id, 'fill-color', colors.park); } catch(_) {}
          }
        });
      }

      // Buildings
      if (colors.building) {
        map.getStyle().layers.forEach(layer => {
          const id = layer.id.toLowerCase();
          if (id.includes('building') && layer.type === 'fill') {
            try { map.setPaintProperty(layer.id, 'fill-color', colors.building); } catch(_) {}
          }
          if (id.includes('building') && layer.type === 'fill-extrusion') {
            try { map.setPaintProperty(layer.id, 'fill-extrusion-color', colors.building); } catch(_) {}
          }
        });
      }

      State.merge('theme.customColors', colors);
      EventBus.emit('theme:colors-updated', colors);
    } catch(e) {
      console.warn('[ThemeEngine] Custom color apply error:', e);
    }
  },

  // ─── Generate AI Theme ─────────────────────────────────
  async generateFromPrompt(prompt, apiCall) {
    try {
      const colors = await apiCall(prompt);
      if (!colors) return null;

      // Apply the AI-generated colors
      this.applyCustomColors(colors);

      // Create a temporary theme
      const tempTheme = {
        id: 'ai-generated',
        label: 'AI Generated',
        colors,
      };
      this._currentTheme = tempTheme;
      State.set('theme.id', 'ai-generated');
      this._syncColorPickers(colors);

      EventBus.emit('theme:ai-applied', { theme: tempTheme, prompt });
      return tempTheme;
    } catch(e) {
      console.error('[ThemeEngine] AI generation failed:', e);
      return null;
    }
  },

  // ─── Sync Color Picker UI ──────────────────────────────
  _syncColorPickers(colors) {
    const map = {
      bg: 'cc-bg',
      water: 'cc-water',
      road: 'cc-road',
      park: 'cc-park',
      building: 'cc-building',
    };
    Object.entries(map).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (el && colors[key]) el.value = colors[key];
    });
  },

  // ─── Build Theme Grid UI ───────────────────────────────
  buildThemeGrid() {
    const grid = document.getElementById('theme-grid');
    if (!grid) return;
    grid.innerHTML = '';

    Object.values(THEMES).forEach(theme => {
      const card = document.createElement('div');
      card.className = 'theme-card' + (theme.id === State.get('theme.id') ? ' active' : '');
      card.dataset.themeId = theme.id;

      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 80;
      this._drawThemeSwatch(canvas, theme.swatchColors);

      const label = document.createElement('div');
      label.className = 'theme-card-label';
      label.textContent = `${theme.emoji} ${theme.label}`;

      card.append(canvas, label);
      card.addEventListener('click', () => this.applyTheme(theme.id));
      grid.appendChild(card);
    });
  },

  // ─── Draw Theme Swatch on Canvas ──────────────────────
  _drawThemeSwatch(canvas, colors) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const [bg, water, road, park, accent] = colors;

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Water mass (bottom-right)
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h);
    ctx.bezierCurveTo(w * 0.6, h * 0.7, w * 0.8, h * 0.6, w, h * 0.55);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Park blob
    ctx.fillStyle = park;
    ctx.beginPath();
    ctx.arc(w * 0.22, h * 0.32, 12, 0, Math.PI * 2);
    ctx.fill();

    // Road grid
    ctx.strokeStyle = road;
    ctx.lineWidth = 1.5;
    const roads = [[0.1, 0, 0.1, 0.8], [0.4, 0, 0.4, 1], [0.7, 0.2, 0.7, 1],
                   [0, 0.2, 0.9, 0.2], [0, 0.5, 1, 0.5], [0.1, 0.75, 0.95, 0.75]];
    roads.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1*w, y1*h);
      ctx.lineTo(x2*w, y2*h);
      ctx.stroke();
    });

    // Building blocks
    ctx.fillStyle = accent || road;
    [[0.12, 0.08, 0.14, 0.10], [0.3, 0.06, 0.1, 0.12], [0.5, 0.08, 0.12, 0.10]].forEach(([x, y, bw, bh]) => {
      ctx.fillRect(x*w, y*h, bw*w, bh*h);
    });
  },

  // ─── Update Theme Card Active State ───────────────────
  updateActiveCard(themeId) {
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.themeId === themeId);
    });
  },

  // ─── Get Current Theme ─────────────────────────────────
  getCurrent() { return this._currentTheme; },
};

export default ThemeEngine;
