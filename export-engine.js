/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Export Engine
   High-resolution PNG/JPEG/SVG/PDF export pipeline
   with text overlay compositing
   ═══════════════════════════════════════════════════════ */

import State from '../state.js';
import EventBus from '../event-bus.js';
import MapEngine from './map-engine.js';

const LAYOUTS = {
  portrait_a3:   { w: 2480, h: 3508, dpi: 300, label: 'A3 Portrait' },
  portrait_a4:   { w: 1754, h: 2480, dpi: 300, label: 'A4 Portrait' },
  landscape_a3:  { w: 3508, h: 2480, dpi: 300, label: 'A3 Landscape' },
  square_12:     { w: 3600, h: 3600, dpi: 300, label: '12×12 in' },
  story_916:     { w: 1080, h: 1920, dpi: 96,  label: '9:16 Story' },
  post_11:       { w: 1080, h: 1080, dpi: 96,  label: '1:1 Post' },
  ultrawide:     { w: 3440, h: 1440, dpi: 96,  label: '21:9 Ultrawide' },
  custom:        { w: 2480, h: 3508, dpi: 300, label: 'Custom' },
};

const ExportEngine = {

  // ─── Main Export Entry Point ───────────────────────────
  async export() {
    const poster = State.get('poster');
    const format = poster.format;
    const layout = LAYOUTS[poster.layout] || LAYOUTS.portrait_a3;
    const resolution = poster.resolution;

    const finalW = (poster.layout === 'custom' ? poster.width : layout.w) * resolution;
    const finalH = (poster.layout === 'custom' ? poster.height : layout.h) * resolution;

    this._showOverlay('Initializing render pipeline…', 0);

    try {
      await this._delay(100);

      if (format === 'pdf') {
        await this._exportPDF(finalW, finalH, layout, resolution);
      } else if (format === 'svg') {
        await this._exportSVG(finalW, finalH, layout, resolution);
      } else {
        await this._exportRaster(format, finalW, finalH, layout, resolution);
      }

    } catch(e) {
      console.error('[ExportEngine] Export failed:', e);
      EventBus.emit('ui:toast', { msg: '⚠ Export failed: ' + e.message, type: 'error' });
    } finally {
      this._hideOverlay();
    }
  },

  // ─── Raster Export (PNG / JPEG) ─────────────────────────
  async _exportRaster(format, finalW, finalH, layout, resolution) {
    this._updateOverlay('Capturing map canvas…', 15);
    await this._delay(200);

    // Step 1: Capture the map canvas
    const mapCanvas = MapEngine.getCanvas();
    if (!mapCanvas) throw new Error('Map canvas not available');

    this._updateOverlay('Compositing poster elements…', 35);
    await this._delay(150);

    // Step 2: Build output canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = finalW;
    outCanvas.height = finalH;
    const ctx = outCanvas.getContext('2d');

    // Background fill
    const bg = State.get('theme.customColors.bg') || '#111827';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, finalW, finalH);

    // Draw map (scaled to fill output canvas)
    ctx.drawImage(mapCanvas, 0, 0, finalW, finalH);

    this._updateOverlay('Rendering text overlays…', 55);
    await this._delay(100);

    // Step 3: Composite text overlays
    const overlayEl = document.getElementById('text-overlay-layer');
    const mapWrapper = document.getElementById('canvas-area');
    if (overlayEl && mapWrapper) {
      const scaleX = finalW / mapWrapper.clientWidth;
      const scaleY = finalH / mapWrapper.clientHeight;
      await this._compositeTextOverlays(ctx, scaleX, scaleY);
    }

    this._updateOverlay('Adding poster typography…', 72);
    await this._delay(100);

    // Step 4: Poster typography
    await this._renderPosterTypography(ctx, finalW, finalH, resolution);

    this._updateOverlay('Encoding & downloading…', 90);
    await this._delay(200);

    // Step 5: Download
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpeg' ? State.get('poster.jpegQuality') : undefined;
    const dataURL = outCanvas.toDataURL(mime, quality);

    this._download(dataURL, this._buildFilename(format));
    this._updateOverlay('Done!', 100);
    EventBus.emit('ui:toast', { msg: '✓ Poster exported successfully', type: 'success' });
  },

  // ─── SVG Export ────────────────────────────────────────
  async _exportSVG(finalW, finalH, layout, resolution) {
    this._updateOverlay('Building SVG document…', 20);

    const mapCanvas = MapEngine.getCanvas();
    if (!mapCanvas) throw new Error('Map canvas not available');

    // Embed map as base64 PNG in SVG
    const mapDataURL = mapCanvas.toDataURL('image/png', 0.95);

    this._updateOverlay('Compositing SVG layers…', 50);
    await this._delay(100);

    const poster = State.get('poster');
    const textOverlays = State.get('textOverlays');
    const mapWrapper = document.getElementById('canvas-area');
    const scaleX = finalW / (mapWrapper?.clientWidth || 1);
    const scaleY = finalH / (mapWrapper?.clientHeight || 1);

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${finalW}" height="${finalH}" viewBox="0 0 ${finalW} ${finalH}"
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <title>${poster.cityName || 'Map Poster'} — Taswira Space Ink</title>
  <desc>Generated by Taswira Space Ink v2</desc>

  <!-- Map background -->
  <rect width="${finalW}" height="${finalH}" fill="${State.get('theme.customColors.bg') || '#111827'}"/>

  <!-- Map raster layer -->
  <image xlink:href="${mapDataURL}" x="0" y="0" width="${finalW}" height="${finalH}" preserveAspectRatio="xMidYMid slice"/>

  <!-- Text Overlays -->
`;

    // Add text elements
    textOverlays.forEach(t => {
      const x = (t.x / 100) * finalW;
      const y = (t.y / 100) * finalH;
      const fontSize = t.fontSize * Math.min(scaleX, scaleY);

      let filters = '';
      let filterId = `filter_${t.id}`;
      let filterDef = '';

      if (t.glow.enabled || t.shadow.enabled) {
        filterDef = `<filter id="${filterId}">`;
        if (t.shadow.enabled) {
          filterDef += `<feDropShadow dx="${t.shadow.offsetX}" dy="${t.shadow.offsetY}" stdDeviation="${t.shadow.blur / 2}" flood-color="${t.shadow.color}" flood-opacity="0.8"/>`;
        }
        filterDef += `</filter>`;
        filters = `filter="url(#${filterId})"`;
      }

      let fillAttr = '';
      if (t.gradient.enabled) {
        const gradId = `grad_${t.id}`;
        const angleRad = (t.gradient.angle * Math.PI) / 180;
        const x1 = 50 - Math.cos(angleRad) * 50;
        const y1 = 50 - Math.sin(angleRad) * 50;
        const x2 = 50 + Math.cos(angleRad) * 50;
        const y2 = 50 + Math.sin(angleRad) * 50;
        svgContent += `  <linearGradient id="${gradId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
    <stop offset="0%" stop-color="${t.gradient.from}"/>
    <stop offset="100%" stop-color="${t.gradient.to}"/>
  </linearGradient>\n`;
        fillAttr = `fill="url(#${gradId})"`;
      } else {
        fillAttr = `fill="${t.color}"`;
      }

      if (filterDef) svgContent += `  <defs>${filterDef}</defs>\n`;

      const fontStyle = [t.bold ? 'font-weight="700"' : '', t.italic ? 'font-style="italic"' : ''].filter(Boolean).join(' ');
      const strokeAttr = t.stroke.enabled ? `stroke="${t.stroke.color}" stroke-width="${t.stroke.width}"` : '';

      svgContent += `  <text
    x="${x.toFixed(1)}" y="${y.toFixed(1)}"
    font-family="${t.fontFamily}, sans-serif"
    font-size="${fontSize.toFixed(1)}"
    ${fontStyle}
    ${fillAttr}
    ${strokeAttr}
    opacity="${t.opacity}"
    transform="rotate(${t.rotation}, ${x.toFixed(1)}, ${y.toFixed(1)})"
    ${filters}
  >${this._escapeXML(t.text)}</text>\n`;
    });

    // Poster typography
    if (poster.cityName) {
      const posY = finalH - 80 * Math.min(scaleX, scaleY);
      svgContent += `  <text x="${finalW/2}" y="${posY}" text-anchor="middle" font-family="Syne, sans-serif" font-size="${48 * Math.min(scaleX, scaleY)}" font-weight="700" fill="white" opacity="0.95">${this._escapeXML(poster.cityName)}</text>\n`;
      if (poster.subtitle) {
        svgContent += `  <text x="${finalW/2}" y="${posY + 28 * Math.min(scaleX, scaleY)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${12 * Math.min(scaleX, scaleY)}" fill="rgba(255,255,255,0.6)" letter-spacing="3">${this._escapeXML(poster.subtitle.toUpperCase())}</text>\n`;
      }
    }

    svgContent += `</svg>`;

    this._updateOverlay('Downloading SVG…', 92);
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    this._download(url, this._buildFilename('svg'));
    URL.revokeObjectURL(url);

    EventBus.emit('ui:toast', { msg: '✓ SVG exported', type: 'success' });
  },

  // ─── PDF Export ────────────────────────────────────────
  async _exportPDF(finalW, finalH, layout, resolution) {
    if (!window.jspdf) throw new Error('jsPDF not loaded');
    this._updateOverlay('Building PDF document…', 20);

    const { jsPDF } = window.jspdf;
    const isLandscape = finalW > finalH;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a3',
      compress: true,
    });

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    this._updateOverlay('Rendering map to PDF…', 40);

    // Capture map
    const mapCanvas = MapEngine.getCanvas();
    if (!mapCanvas) throw new Error('Map not available');

    // Create a composite canvas
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = mapCanvas.width * 2;
    tmpCanvas.height = mapCanvas.height * 2;
    const tCtx = tmpCanvas.getContext('2d');
    tCtx.drawImage(mapCanvas, 0, 0, tmpCanvas.width, tmpCanvas.height);

    this._updateOverlay('Compositing PDF layers…', 60);
    await this._renderPosterTypography(tCtx, tmpCanvas.width, tmpCanvas.height, 2);

    const imgData = tmpCanvas.toDataURL('image/jpeg', 0.92);

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);

    this._updateOverlay('Saving PDF…', 90);
    pdf.save(this._buildFilename('pdf'));

    EventBus.emit('ui:toast', { msg: '✓ PDF exported', type: 'success' });
  },

  // ─── Composite Text Overlays to Canvas ────────────────
  async _compositeTextOverlays(ctx, scaleX, scaleY) {
    const overlays = State.get('textOverlays');
    if (!overlays || !overlays.length) return;

    const containerW = document.getElementById('canvas-area')?.clientWidth || 800;
    const containerH = document.getElementById('canvas-area')?.clientHeight || 600;

    overlays.forEach(t => {
      if (!t.text) return;
      ctx.save();

      const px = (t.x / 100) * containerW * scaleX;
      const py = (t.y / 100) * containerH * scaleY;
      const fs = t.fontSize * Math.min(scaleX, scaleY);

      ctx.translate(px, py);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.globalAlpha = t.opacity;

      const fontStr = `${t.italic ? 'italic ' : ''}${t.bold ? '700' : '400'} ${fs}px "${t.fontFamily}", sans-serif`;
      ctx.font = fontStr;

      // Shadow
      if (t.shadow.enabled) {
        ctx.shadowColor = t.shadow.color;
        ctx.shadowBlur = t.shadow.blur * Math.min(scaleX, scaleY);
        ctx.shadowOffsetX = t.shadow.offsetX * scaleX;
        ctx.shadowOffsetY = t.shadow.offsetY * scaleY;
      }

      // Multiple glow passes
      if (t.glow.enabled) {
        for (let i = 0; i < t.glow.spread; i++) {
          ctx.save();
          ctx.shadowColor = t.glow.color;
          ctx.shadowBlur = t.glow.blur * (i + 1) * Math.min(scaleX, scaleY);
          ctx.fillStyle = t.color;
          ctx.fillText(t.text, 0, 0);
          ctx.restore();
        }
      }

      // Stroke
      if (t.stroke.enabled) {
        ctx.strokeStyle = t.stroke.color;
        ctx.lineWidth = t.stroke.width * Math.min(scaleX, scaleY);
        ctx.lineJoin = 'round';
        ctx.strokeText(t.text, 0, 0);
      }

      // Fill
      if (t.gradient.enabled) {
        const metrics = ctx.measureText(t.text);
        const tw = metrics.width;
        const angleRad = (t.gradient.angle * Math.PI) / 180;
        const cx = tw / 2, cy = -fs / 2;
        const r = Math.sqrt(cx*cx + cy*cy) * 1.2;
        const gx1 = cx - Math.cos(angleRad) * r;
        const gy1 = cy - Math.sin(angleRad) * r;
        const gx2 = cx + Math.cos(angleRad) * r;
        const gy2 = cy + Math.sin(angleRad) * r;
        const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
        grad.addColorStop(0, t.gradient.from);
        grad.addColorStop(1, t.gradient.to);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = t.color;
      }

      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    });
  },

  // ─── Render Poster Typography ──────────────────────────
  async _renderPosterTypography(ctx, w, h, scale) {
    const poster = State.get('poster');
    if (!poster.cityName) return;

    const scaleFactor = scale;
    const yBase = h - 80 * scaleFactor;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 30 * scaleFactor;
    ctx.textAlign = 'center';

    // City name
    ctx.font = `700 ${48 * scaleFactor}px "Syne", serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillText(poster.cityName, w / 2, yBase);

    // Subtitle
    if (poster.subtitle) {
      ctx.font = `400 ${12 * scaleFactor}px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.58)';
      ctx.letterSpacing = `${3 * scaleFactor}px`;
      ctx.fillText(poster.subtitle.toUpperCase(), w / 2, yBase + 24 * scaleFactor);
    }

    // Coordinates
    if (poster.showCoords) {
      const center = MapEngine.getCenter();
      if (center) {
        const lat = center.lat, lon = center.lng;
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';
        const coordStr = `${Math.abs(lat).toFixed(4)}°${latDir}  ${Math.abs(lon).toFixed(4)}°${lonDir}`;
        ctx.font = `300 ${10 * scaleFactor}px "JetBrains Mono", monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        ctx.letterSpacing = `${1 * scaleFactor}px`;
        ctx.fillText(coordStr, w / 2, yBase + 44 * scaleFactor);
      }
    }

    // Scale bar
    if (poster.showScale) {
      const zoom = MapEngine.getZoom() || 12;
      const metersPerPixel = (156543.03392 * Math.cos((MapEngine.getCenter()?.lat || 0) * Math.PI / 180)) / Math.pow(2, zoom);
      const barPixels = 100 * scaleFactor;
      const barMeters = Math.round(metersPerPixel * barPixels);
      const barLabel = barMeters >= 1000 ? `${(barMeters/1000).toFixed(1)} km` : `${barMeters} m`;

      const barX = 20 * scaleFactor;
      const barY = h - 24 * scaleFactor;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(barX, barY, barPixels, 2 * scaleFactor);
      ctx.fillRect(barX, barY - 4 * scaleFactor, 2 * scaleFactor, 8 * scaleFactor);
      ctx.fillRect(barX + barPixels - 2 * scaleFactor, barY - 4 * scaleFactor, 2 * scaleFactor, 8 * scaleFactor);
      ctx.font = `300 ${9 * scaleFactor}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(barLabel, barX + barPixels + 6 * scaleFactor, barY + 4 * scaleFactor);
    }

    ctx.restore();
  },

  // ─── Update Poster Frame Preview ──────────────────────
  updatePosterFrame() {
    const frame = document.getElementById('poster-frame');
    const container = document.getElementById('canvas-area');
    if (!frame || !container) return;

    const poster = State.get('poster');
    const layout = LAYOUTS[poster.layout] || LAYOUTS.portrait_a3;
    const w = poster.layout === 'custom' ? poster.width : layout.w;
    const h = poster.layout === 'custom' ? poster.height : layout.h;
    const ratio = w / h;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const pad = 48;

    let fw, fh;
    if (cw / ch > ratio) {
      fh = ch - pad;
      fw = fh * ratio;
    } else {
      fw = cw - pad;
      fh = fw / ratio;
    }

    frame.style.width = fw + 'px';
    frame.style.height = fh + 'px';

    // Update size note
    const sizeNote = document.getElementById('exp-size-note');
    if (sizeNote) {
      const res = poster.resolution;
      const finalW = w * res;
      const finalH = h * res;
      sizeNote.textContent = `~${this._fmtNum(finalW)}×${this._fmtNum(finalH)} px`;
    }
  },

  // ─── File Download ─────────────────────────────────────
  _download(dataURL, filename) {
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  // ─── Filename Generator ────────────────────────────────
  _buildFilename(ext) {
    const city = (State.get('poster.cityName') || 'map').replace(/\s+/g, '_').toLowerCase();
    const ts = new Date().toISOString().split('T')[0];
    return `taswira_${city}_${ts}.${ext}`;
  },

  // ─── Overlay Helpers ───────────────────────────────────
  _showOverlay(status, progress) {
    State.set('export.loading', true);
    const overlay = document.getElementById('export-overlay');
    overlay?.classList.add('visible');
    this._updateOverlay(status, progress);
  },

  _updateOverlay(status, progress) {
    const statusEl = document.getElementById('eo-status');
    const progressEl = document.getElementById('eo-progress');
    if (statusEl) statusEl.textContent = status;
    if (progressEl) progressEl.style.width = progress + '%';
  },

  _hideOverlay() {
    State.set('export.loading', false);
    const overlay = document.getElementById('export-overlay');
    overlay?.classList.remove('visible');
  },

  // ─── Utilities ─────────────────────────────────────────
  _delay(ms) { return new Promise(r => setTimeout(r, ms)); },

  _fmtNum(n) {
    if (n >= 1000) return (n/1000).toFixed(1) + 'K';
    return n.toString();
  },

  _escapeXML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },
};

export { LAYOUTS };
export default ExportEngine;
