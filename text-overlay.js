/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Text Overlay Module
   Draggable, resizable, styleable text elements on map
   ═══════════════════════════════════════════════════════ */

import State from '../state.js';
import EventBus from '../event-bus.js';

const TextOverlayModule = {

  _layer: null,
  _elements: new Map(),  // id → DOM element
  _isDragging: false,
  _isEditing: false,

  // ─── Initialize ────────────────────────────────────────
  init() {
    this._layer = document.getElementById('text-overlay-layer');
    if (!this._layer) return;

    // Listen to state events
    EventBus.on('text:added', (t) => this._createElement(t));
    EventBus.on('text:updated', (t) => this._updateElement(t));
    EventBus.on('text:deleted', (t) => this._removeElement(t.id));

    // Listen to "add text" button
    EventBus.on('text:start-add', () => this._enableAddMode());
  },

  // ─── Enable Add Mode ───────────────────────────────────
  _enableAddMode() {
    this._layer.classList.add('editing');
    this._layer.style.cursor = 'crosshair';

    const onClick = (e) => {
      if (e.target !== this._layer && !e.target.closest('#canvas-area')) return;
      const rect = this._layer.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;

      const overlay = State.addTextOverlay({
        text: 'City Name',
        x: xPct,
        y: yPct,
      });

      this._layer.classList.remove('editing');
      this._layer.style.cursor = '';
      this._layer.removeEventListener('click', onClick);

      // Select the newly created text
      State.set('ui.selectedTextId', overlay.id);
      EventBus.emit('text:select', { id: overlay.id });
    };

    this._layer.addEventListener('click', onClick, { once: false });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._layer.classList.remove('editing');
        this._layer.style.cursor = '';
        this._layer.removeEventListener('click', onClick);
      }
    }, { once: true });
  },

  // ─── Create DOM Element ────────────────────────────────
  _createElement(overlay) {
    const el = document.createElement('div');
    el.id = `textEl_${overlay.id}`;
    el.className = 'text-element';
    el.dataset.id = overlay.id;

    el.style.cssText = `
      position: absolute;
      left: ${overlay.x}%;
      top: ${overlay.y}%;
      transform: translateY(-50%) rotate(${overlay.rotation}deg);
      cursor: grab;
      user-select: none;
      pointer-events: all;
      z-index: 30;
      white-space: nowrap;
      will-change: transform;
    `;

    this._applyTextStyle(el, overlay);
    this._attachDragHandler(el, overlay);
    this._attachSelectHandler(el, overlay);
    this._attachDoubleClickEdit(el, overlay);

    this._layer.appendChild(el);
    this._elements.set(overlay.id, el);

    // Add to list panel
    this._addToPanel(overlay);

    // Auto-select
    State.set('ui.selectedTextId', overlay.id);
    EventBus.emit('text:select', { id: overlay.id });
  },

  // ─── Apply CSS Style from Overlay State ───────────────
  _applyTextStyle(el, overlay) {
    let shadow = [];
    if (overlay.shadow?.enabled) {
      shadow.push(`${overlay.shadow.offsetX}px ${overlay.shadow.offsetY}px ${overlay.shadow.blur}px ${overlay.shadow.color}`);
    }
    if (overlay.glow?.enabled) {
      for (let i = 0; i < (overlay.glow.spread || 1); i++) {
        shadow.push(`0 0 ${overlay.glow.blur * (i + 1)}px ${overlay.glow.color}`);
      }
    }

    let textColor = overlay.color;
    let bgGradient = '';

    if (overlay.gradient?.enabled) {
      // Use gradient via background-clip trick
      bgGradient = `
        background: linear-gradient(${overlay.gradient.angle}deg, ${overlay.gradient.from}, ${overlay.gradient.to});
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      `;
      textColor = 'transparent';
    }

    el.style.fontSize = overlay.fontSize + 'px';
    el.style.fontFamily = `"${overlay.fontFamily}", sans-serif`;
    el.style.fontWeight = overlay.bold ? '700' : '400';
    el.style.fontStyle = overlay.italic ? 'italic' : 'normal';
    el.style.color = textColor;
    el.style.opacity = overlay.opacity;
    el.style.textShadow = shadow.join(', ');
    el.style.left = overlay.x + '%';
    el.style.top = overlay.y + '%';
    el.style.transform = `translateY(-50%) rotate(${overlay.rotation}deg)`;

    if (overlay.stroke?.enabled) {
      el.style.webkitTextStroke = `${overlay.stroke.width}px ${overlay.stroke.color}`;
    } else {
      el.style.webkitTextStroke = '';
    }

    if (bgGradient) {
      el.style.cssText += bgGradient;
    } else {
      el.style.background = '';
      el.style.webkitBackgroundClip = '';
      el.style.webkitTextFillColor = '';
      el.style.backgroundClip = '';
    }

    el.textContent = overlay.text;
  },

  // ─── Drag Handler ─────────────────────────────────────
  _attachDragHandler(el, overlay) {
    let startX, startY, startXPct, startYPct;

    const onMouseDown = (e) => {
      if (e.button !== 0 || e.target.classList.contains('text-resize-handle')) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = this._layer.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startXPct = overlay.x;
      startYPct = overlay.y;

      el.classList.add('dragging');
      el.style.cursor = 'grabbing';
      this._isDragging = true;

      const onMouseMove = (e) => {
        const dx = ((e.clientX - startX) / rect.width) * 100;
        const dy = ((e.clientY - startY) / rect.height) * 100;

        overlay.x = Math.max(0, Math.min(100, startXPct + dx));
        overlay.y = Math.max(0, Math.min(100, startYPct + dy));

        el.style.left = overlay.x + '%';
        el.style.top = overlay.y + '%';
      };

      const onMouseUp = () => {
        el.classList.remove('dragging');
        el.style.cursor = 'grab';
        this._isDragging = false;
        State.updateTextOverlay(overlay.id, { x: overlay.x, y: overlay.y });
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    el.addEventListener('mousedown', onMouseDown);

    // Touch support
    el.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      onMouseDown({ button: 0, clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation() });
    }, { passive: false });
  },

  // ─── Select Handler ────────────────────────────────────
  _attachSelectHandler(el, overlay) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const prevId = State.get('ui.selectedTextId');

      // Deselect previous
      if (prevId && prevId !== overlay.id) {
        const prevEl = this._elements.get(prevId);
        prevEl?.classList.remove('selected');
      }

      State.set('ui.selectedTextId', overlay.id);
      el.classList.add('selected');
      el.style.outline = '1.5px dashed rgba(91,141,239,0.7)';
      el.style.outlineOffset = '4px';

      EventBus.emit('text:select', { id: overlay.id });
    });
  },

  // ─── Double-click to Edit ──────────────────────────────
  _attachDoubleClickEdit(el, overlay) {
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();

      const input = document.createElement('input');
      input.type = 'text';
      input.value = overlay.text;
      input.style.cssText = `
        position: absolute;
        left: ${overlay.x}%;
        top: ${overlay.y}%;
        transform: translateY(-50%);
        background: rgba(9,11,24,0.9);
        border: 1px solid var(--primary, #5B8DEF);
        border-radius: 4px;
        color: white;
        font-size: ${Math.min(overlay.fontSize, 24)}px;
        padding: 4px 8px;
        outline: none;
        z-index: 200;
        min-width: 120px;
        font-family: var(--font-ui, sans-serif);
      `;

      this._layer.appendChild(input);
      el.style.display = 'none';
      input.focus();
      input.select();

      const finish = () => {
        const newText = input.value.trim() || overlay.text;
        overlay.text = newText;
        State.updateTextOverlay(overlay.id, { text: newText });
        el.textContent = newText;
        el.style.display = '';
        input.remove();
      };

      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish();
        if (e.key === 'Escape') {
          el.style.display = '';
          input.remove();
        }
      });
    });
  },

  // ─── Update Element from State ─────────────────────────
  _updateElement(overlay) {
    const el = this._elements.get(overlay.id);
    if (!el) return;
    this._applyTextStyle(el, overlay);
    this._updatePanelItem(overlay);
  },

  // ─── Remove Element ────────────────────────────────────
  _removeElement(id) {
    const el = this._elements.get(id);
    if (el) {
      el.remove();
      this._elements.delete(id);
    }
    this._removePanelItem(id);
  },

  // ─── Deselect All ─────────────────────────────────────
  deselectAll() {
    this._elements.forEach((el) => {
      el.classList.remove('selected');
      el.style.outline = '';
      el.style.outlineOffset = '';
    });
    State.set('ui.selectedTextId', null);
  },

  // ─── Panel List Management ─────────────────────────────
  _addToPanel(overlay) {
    const list = document.getElementById('text-layer-list');
    if (!list) return;

    // Remove empty state
    const empty = list.querySelector('.empty-state');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'text-layer-item';
    item.id = `tli_${overlay.id}`;
    item.dataset.id = overlay.id;
    item.innerHTML = `
      <span class="tli-preview">Aa</span>
      <span class="tli-text">${overlay.text}</span>
      <button class="tli-del" data-id="${overlay.id}" title="Delete">✕</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('tli-del')) return;
      State.set('ui.selectedTextId', overlay.id);
      EventBus.emit('text:select', { id: overlay.id });
    });

    item.querySelector('.tli-del')?.addEventListener('click', () => {
      State.deleteTextOverlay(overlay.id);
    });

    list.appendChild(item);
  },

  _updatePanelItem(overlay) {
    const item = document.getElementById(`tli_${overlay.id}`);
    if (!item) return;
    const textEl = item.querySelector('.tli-text');
    if (textEl) textEl.textContent = overlay.text;
  },

  _removePanelItem(id) {
    const item = document.getElementById(`tli_${id}`);
    if (item) item.remove();

    // Show empty state if no items
    const list = document.getElementById('text-layer-list');
    if (list && !list.querySelector('.text-layer-item')) {
      list.innerHTML = `
        <div class="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>
          </svg>
          <p>No text overlays yet.<br/>Click "+ Add" or press T to add text.</p>
        </div>`;
    }
  },

  // ─── Keyboard Shortcuts ────────────────────────────────
  handleKeyboard(e) {
    const selectedId = State.get('ui.selectedTextId');
    if (!selectedId) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Only if not in an input field
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        State.deleteTextOverlay(selectedId);
        e.preventDefault();
      }
    }

    if (e.key === 'Escape') {
      this.deselectAll();
    }

    // Arrow key nudge
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      if (document.activeElement.tagName === 'INPUT') return;
      e.preventDefault();
      const overlay = State.getTextOverlay(selectedId);
      if (!overlay) return;
      const step = e.shiftKey ? 2 : 0.5;
      const updates = {};
      if (e.key === 'ArrowLeft')  updates.x = Math.max(0, overlay.x - step);
      if (e.key === 'ArrowRight') updates.x = Math.min(100, overlay.x + step);
      if (e.key === 'ArrowUp')    updates.y = Math.max(0, overlay.y - step);
      if (e.key === 'ArrowDown')  updates.y = Math.min(100, overlay.y + step);
      State.updateTextOverlay(selectedId, updates);
    }
  },
};

export default TextOverlayModule;
