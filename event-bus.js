/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Event Bus
   Lightweight pub/sub for inter-module communication
   ═══════════════════════════════════════════════════════ */

const EventBus = {
  _listeners: new Map(),

  /**
   * Subscribe to an event
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  },

  /**
   * Subscribe once
   */
  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  },

  /**
   * Unsubscribe
   */
  off(event, callback) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
    }
  },

  /**
   * Emit an event with optional data
   */
  emit(event, data = null) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).forEach(cb => {
        try { cb(data); }
        catch (e) { console.error(`[EventBus] Error in handler for "${event}":`, e); }
      });
    }
  },

  /**
   * Clear all listeners for an event
   */
  clear(event) {
    if (event) { this._listeners.delete(event); }
    else { this._listeners.clear(); }
  },

  /**
   * Debug: list all registered events
   */
  debug() {
    const events = {};
    this._listeners.forEach((listeners, event) => {
      events[event] = listeners.size;
    });
    console.table(events);
  },
};

export default EventBus;
