/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Mobile Drawer Module
   Touch-driven bottom drawer for mobile UX
   ═══════════════════════════════════════════════════════ */

import State from '../state.js';
import EventBus from '../event-bus.js';

const MobileDrawer = {

  _drawer: null,
  _startY: 0,
  _startTranslate: 0,
  _isDragging: false,
  _COLLAPSED_OFFSET: null,
  _activeTab: 'location',

  // ─── Initialize ────────────────────────────────────────
  init() {
    if (window.innerWidth > 640) return; // desktop — skip

    this._inject();
    this._drawer = document.getElementById('mobile-drawer');
    if (!this._drawer) return;

    this._COLLAPSED_OFFSET = this._drawer.offsetHeight - 60;
    this._bindDrag();
    this._bindTabs();
    this._bindMapTap();

    EventBus.on('text:start-add', () => this.collapse());
    EventBus.on('map:click', () => {
      if (!State.get('ui.isAddingText')) this.toggle();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 640) {
        this._drawer?.remove();
        this._drawer = null;
      }
    });
  },

  // ─── Inject drawer HTML ────────────────────────────────
  _inject() {
    const existing = document.getElementById('mobile-drawer');
    if (existing) return;

    const drawer = document.createElement('div');
    drawer.id = 'mobile-drawer';
    drawer.innerHTML = `
      <div id="drawer-handle">
        <div class="drawer-handle-bar"></div>
      </div>
      <nav id="drawer-tabs">
        <button class="drawer-tab active" data-tab="location">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span>Map</span>
        </button>
        <button class="drawer-tab" data-tab="theme">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
          </svg>
          <span>Theme</span>
        </button>
        <button class="drawer-tab" data-tab="text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>
          </svg>
          <span>Text</span>
        </button>
        <button class="drawer-tab" data-tab="layers">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          <span>Layers</span>
        </button>
        <button class="drawer-tab" data-tab="export">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          <span>Export</span>
        </button>
      </nav>
      <div id="drawer-content">
        <!-- Content cloned from panel sections -->
      </div>
    `;
    document.body.appendChild(drawer);

    // Clone panel content into drawer
    this._syncTabContent('location');
  },

  // ─── Sync desktop panel content into mobile drawer ────
  _syncTabContent(tabId) {
    const content = document.getElementById('drawer-content');
    if (!content) return;

    const sourcePanel = document.getElementById(`panel-${tabId}`);
    if (!sourcePanel) return;

    content.innerHTML = sourcePanel.innerHTML;
    content.querySelectorAll('[id]').forEach(el => {
      el.id = `mob_${el.id}`;
    });
  },

  // ─── Bind tab switching ────────────────────────────────
  _bindTabs() {
    document.getElementById('drawer-tabs')?.querySelectorAll('.drawer-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._activeTab = tab.dataset.tab;
        this._syncTabContent(tab.dataset.tab);

        // Also activate the corresponding desktop panel (for state sync)
        EventBus.emit('ui:panel-activate', { panelId: tab.dataset.tab });
        this.expand();
      });
    });
  },

  // ─── Touch drag handler ────────────────────────────────
  _bindDrag() {
    const handle = document.getElementById('drawer-handle');
    if (!handle) return;

    const getTranslate = () => {
      const style = window.getComputedStyle(this._drawer);
      const mat = new WebKitCSSMatrix(style.transform);
      return mat.m42;
    };

    handle.addEventListener('touchstart', (e) => {
      this._isDragging = true;
      this._startY = e.touches[0].clientY;
      this._startTranslate = getTranslate();
      this._drawer.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!this._isDragging) return;
      const dy = e.touches[0].clientY - this._startY;
      let newTranslate = this._startTranslate + dy;
      newTranslate = Math.max(0, Math.min(this._COLLAPSED_OFFSET || 400, newTranslate));
      this._drawer.style.transform = `translateY(${newTranslate}px)`;
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!this._isDragging) return;
      this._isDragging = false;
      this._drawer.style.transition = '';

      const translate = getTranslate();
      const threshold = (this._COLLAPSED_OFFSET || 400) / 2;
      if (translate < threshold) this.expand();
      else this.collapse();
    });
  },

  // ─── Tap on map collapses drawer ──────────────────────
  _bindMapTap() {
    document.getElementById('map')?.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1 && !this._isDragging) {
        this.collapse();
      }
    }, { passive: true });
  },

  expand()   { this._drawer?.classList.add('expanded'); },
  collapse() { this._drawer?.classList.remove('expanded'); },
  toggle()   { this._drawer?.classList.toggle('expanded'); },
  isExpanded() { return this._drawer?.classList.contains('expanded'); },
};

export default MobileDrawer;
