const sessionStore = {
  store: null, 
  map: new Map(), 

  setStore(s) {
    this.store = s;
  },

  registerSession(discordId, sessionId) {
    if (!discordId || !sessionId) return;
    let set = this.map.get(discordId);
    if (!set) {
      set = new Set();
      this.map.set(discordId, set);
    }
    set.add(sessionId);
  },

  unregisterSession(sessionId) {
    if (!sessionId) return;
    for (const [discordId, set] of this.map.entries()) {
      if (set.has(sessionId)) {
        set.delete(sessionId);
        if (set.size === 0) this.map.delete(discordId);
        break;
      }
    }
  },

  destroySessionsForDiscordId(discordId) {
    if (!discordId) return;
    const set = this.map.get(discordId);
    if (!set || set.size === 0) return;
    if (!this.store || typeof this.store.destroy !== 'function') {
      // remove mapping only
      this.map.delete(discordId);
      return;
    }

    for (const sid of set) {
      try {
        this.store.destroy(sid, (err) => {
          if (err) console.error('Erreur destruction session:', err);
        });
      } catch (e) {
        console.error('Erreur destruction session:', e);
      }
    }
    this.map.delete(discordId);
  }
};

module.exports = sessionStore;
