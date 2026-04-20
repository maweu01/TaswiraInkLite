# Taswira Space Ink v2 🗺
### The Cartographic Artistry Engine

> **Taswira** (Swahili) *— image, portrait, picture*

A production-grade, open-source web platform for designing, annotating, and exporting high-resolution cartographic map posters. Built for designers, GIS analysts, and UAV survey professionals.

```
✦ Real-time MapLibre GL rendering       ✦ GeoJSON layer imports
✦ Draggable text overlays with effects  ✦ UAV flight path animation
✦ AI-powered theme generation           ✦ 4K/8K PNG/JPEG/SVG/PDF export
✦ 8 curated Africa-first themes         ✦ Zero build step — open & run
```

---

## ✦ Live Demo

```
https://taswira-space-ink.vercel.app
```

---

## ✦ Features

### 🗺 Map Engine
- **MapLibre GL JS 4.x** — WebGL rendering, zero-lag interaction
- **Zoom / Pan / Pitch / Bearing** — full 3D camera control
- **OpenFreeMap tiles** — free OSM vector tiles, no API key needed
- **City search** — Nominatim geocoding for any location on Earth
- **6 preset cities**: Mombasa, Nairobi, Lagos, Cairo, Cape Town, Zanzibar

### 🎨 Theme Engine
- **8 curated themes** — Midnight Circuit, Sahara Dust, Ocean Ink, Arctic Minimal, Forest Terrain, Neon Cyber, Golden Hour, Industrial Grey
- **Custom color editor** — per-layer hex control (background, water, roads, parks, buildings)
- **AI Theme Generator** — describe a vibe → Claude API generates a cohesive palette

### 🖊 Text Overlay System
- **Drag + drop** text elements directly on the map
- **Double-click** to edit text inline
- **Arrow key** nudge (Shift = 2× step)
- **Effects**: Color gradient, Glow, Stroke outline, Drop shadow
- **Controls**: Font family, size, bold, italic, rotation, opacity

### 📐 Export Pipeline
- **Formats**: PNG, JPEG, SVG, PDF
- **Layouts**: A3/A4 Portrait, A3 Landscape, 12×12in, 9:16 Story, 1:1 Post, Ultrawide, Custom
- **Resolution**: 1× (HD) → 2× (FHD) → 4× (4K) → 8× (8K)
- **Poster typography**: City name, subtitle, coordinates, scale bar composited onto canvas
- **SVG export**: Full vector output with embedded map + text elements

### 🗂 GeoJSON Layers
- Drag & drop or paste GeoJSON files
- Renders Points, Lines, Polygons with per-layer color
- Toggle visibility per layer
- Auto-fits map bounds to layer extent

### ✈ UAV / Flight Path Module
- Load GeoJSON LineString as flight path
- **Animated playback** with drone marker
- **Telemetry overlay**: altitude, speed, heading, progress
- Variable playback speed (1× – 20×)
- Sample Mombasa coastal survey path included
- Path style: color, line width

---

## ✦ Architecture

```
taswira-space-ink/
│
├── index.html                   ← App shell (zero dependencies to install)
│
├── styles/
│   ├── main.css                 ← Design system, layout, glass morphism
│   ├── panels.css               ← Panel, form, toggle, UAV components
│   └── animations.css           ← Stagger reveals, micro-interactions
│
├── src/
│   ├── app.js                   ← Boot sequence + module wiring
│   ├── state.js                 ← Centralized reactive state
│   ├── event-bus.js             ← Pub/sub inter-module communication
│   │
│   ├── core/
│   │   ├── map-engine.js        ← MapLibre wrapper (init, style, layers)
│   │   ├── theme-engine.js      ← 8 themes + AI generation + swatch canvas
│   │   └── export-engine.js     ← PNG/JPEG/SVG/PDF pipeline
│   │
│   ├── modules/
│   │   ├── text-overlay.js      ← Draggable text with effects
│   │   ├── geojson-module.js    ← Import, validate, render GeoJSON
│   │   └── uav-module.js        ← Flight path animation + telemetry
│   │
│   ├── services/
│   │   ├── geocoder.js          ← Nominatim search with cache
│   │   └── ai-service.js        ← Claude API theme generation
│   │
│   └── ui/
│       └── ui-controller.js     ← All DOM event wiring
│
├── data/presets/
│   └── cities.js                ← 6 African city presets
│
├── tests/
│   └── tests.js                 ← 42 unit tests (zero dependencies)
│
├── Dockerfile                   ← Nginx Alpine production container
├── docker-compose.yml
├── nginx.conf                   ← Hardened production config
├── package.json
├── .env.example
└── README.md
```

---

## ✦ Quick Start

### Option 1: Open directly (30 seconds)
```bash
# Just open index.html in any modern browser
open index.html
# or double-click it in your file manager
```
> **Note**: Text/UAV/GeoJSON features require ES modules → serve via HTTP

### Option 2: Local dev server (1 minute)
```bash
git clone https://github.com/YOUR_USERNAME/taswira-space-ink.git
cd taswira-space-ink

# Using Python (built into every OS)
python3 -m http.server 7200

# OR using npx
npx serve . -p 7200

# OR using Bun
bunx serve .
```
Open `http://localhost:7200`

### Option 3: Docker (2 minutes)
```bash
docker compose up -d --build
# → http://localhost:7200
```

---

## ✦ Environment Variables

```bash
# .env (optional — only required for AI theme generation)
# The app runs fully featured without this.
ANTHROPIC_API_KEY=sk-ant-...

# Docker port override
APP_PORT=7200
```

---

## ✦ Deployment

### Vercel (Recommended — 3 minutes)
```bash
npm i -g vercel
vercel --prod
```
Zero config needed. Vercel detects static site automatically.

### Netlify
```bash
# Drag the project folder to netlify.com/drop
# OR via CLI:
npm i -g netlify-cli
netlify deploy --prod --dir .
```

### GitHub Pages
```bash
git init && git add .
git commit -m "feat: initial Taswira Space Ink v2"
git remote add origin https://github.com/YOU/taswira-space-ink.git
git push -u origin main
# Settings → Pages → Source: main branch, / (root)
```

### Docker Self-Hosting
```bash
# Start
docker compose up -d --build

# Stop
docker compose down

# Logs
docker compose logs -f

# Custom port
APP_PORT=80 docker compose up -d --build
```

---

## ✦ Running Tests

```bash
node tests/tests.js
```
42 unit tests covering: GeoJSON parsing, UAV math, export engine, state management, geocoder formatting, theme validation.

---

## ✦ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `T` | Add text overlay |
| `+` / `-` | Zoom in / out |
| `Shift+N` | Reset map north |
| `Delete` | Delete selected text |
| `Esc` | Deselect / close modal |
| `↑↓←→` | Nudge selected text |
| `Shift+↑↓←→` | Large nudge |
| `Double-click text` | Edit inline |

---

## ✦ API Stack

| Service | Purpose | License |
|---------|---------|---------|
| MapLibre GL JS 4.1 | WebGL map renderer | BSD-3-Clause |
| OpenFreeMap | Free OSM vector tiles | CC-BY |
| Nominatim | Geocoding (city search) | ODbL |
| Claude claude-sonnet-4-20250514 | AI theme generation | Commercial |
| jsPDF 2.5 | PDF export | MIT |
| OpenStreetMap | Map data | ODbL |
| Google Fonts | Syne + JetBrains Mono | OFL |

---

## ✦ UAV Integration

The UAV module accepts any GeoJSON file with `LineString` features.

**GeoCart Survey workflow:**
1. Export flight plan as GeoJSON from your mission planning software
2. Click **UAV** button in toolbar → Load file
3. Path renders on map with waypoint dots
4. Hit **▶** to animate drone flight
5. Telemetry overlay shows altitude, speed, heading, progress

**Sample path**: Click "Load Sample Mombasa Survey Path" to see a synthetic coastal grid survey.

**Supported sources**: DJI Terra, QGroundControl, Mission Planner, Pix4D (export as GeoJSON)

---

## ✦ AI Theme Engine

The AI engine sends a natural language description to Claude claude-sonnet-4-20250514 and receives a harmonious 6-color cartographic palette.

**Example prompts:**
- `"Mombasa at twilight, coral reef blues, warm amber port lights"`
- `"Nairobi CBD night, dark glass towers, electric grid glow"`
- `"Cairo ancient city, Nile gold and desert ochre"`
- `"Lagos island megacity, vivid neon energy, Atlantic coastline"`
- `"Zanzibar spice island, turquoise reef, dhow sails at sunset"`

---

## ✦ Comparison

| Feature | TerraInk v0.4 | **Taswira Space Ink v2** |
|---------|--------------|--------------------------|
| Text overlays | ✗ | ✓ Drag + effects |
| GeoJSON layers | ✗ | ✓ Multi-layer |
| UAV flight paths | ✗ | ✓ With telemetry |
| AI theme generation | ✗ | ✓ Claude API |
| SVG export | ✗ | ✓ Full vector |
| PDF export | ✓ | ✓ |
| Shareable URLs | ✗ | ✓ |
| Build required | ✓ (Bun+Vite) | ✗ Zero build |
| Test suite | ✗ | ✓ 42 tests |
| Africa presets | ✗ | ✓ 6 cities |

---

## ✦ Roadmap

- [ ] Offline PWA (service worker tile caching)
- [ ] Annotation layer (draw shapes, markers)
- [ ] Batch export (multiple cities)
- [ ] Community gallery (Supabase)
- [ ] Print-on-demand API (Printful/Gelato)
- [ ] Android APK (Capacitor wrapper)
- [ ] Custom tile server support

---

## ✦ Contributing

1. Fork → `git checkout -b feat/your-feature`
2. Code → `git commit -m "feat: description"`
3. Test → `node tests/tests.js`
4. Push → Pull Request

---

## ✦ License

MIT License — see [LICENSE](LICENSE)

Map data © OpenStreetMap contributors, ODbL.
Tiles © OpenFreeMap, CC-BY.

---

*Taswira Space Ink — Print the world. One poster at a time.*
