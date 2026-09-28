/* Storage adapters.
   - LocalStore: browser localStorage. Works with zero setup, one browser only.
   - SupabaseStore: shared, live-syncing store for the whole team. Enabled by
     filling in js/config.js and running supabase/schema.sql.
   Both expose the same interface: load, saveCard, deleteCard, saveSettings, subscribe. */

window.JawdaStorage = (function () {
  'use strict';
  const LS_KEY = 'jawda-ads-board-v1';

  function LocalStore() {
    this.kind = 'local';
    this.label = 'Saved in this browser';
  }
  LocalStore.prototype.load = function () {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return Promise.resolve(null);
      return Promise.resolve(JSON.parse(raw));
    } catch (e) { return Promise.resolve(null); }
  };
  LocalStore.prototype._write = function (state) {
    localStorage.setItem(LS_KEY, JSON.stringify({ cards: state.cards, settings: state.settings }));
    return Promise.resolve();
  };
  LocalStore.prototype.saveCard = function (card, state) { return this._write(state); };
  LocalStore.prototype.deleteCard = function (id, state) { return this._write(state); };
  LocalStore.prototype.saveSettings = function (settings, state) { return this._write(state); };
  LocalStore.prototype.saveAll = function (state) { return this._write(state); };
  LocalStore.prototype.subscribe = function () { /* nothing to listen to */ };

  function SupabaseStore(cfg) {
    this.kind = 'supabase';
    this.label = 'Shared with the team';
    this.client = window.supabase.createClient(cfg.url, cfg.anonKey);
    this.table = cfg.table || 'cards';
    this.settingsTable = cfg.settingsTable || 'board_settings';
    this.boardKey = cfg.boardKey || 'default';
  }
  SupabaseStore.prototype.load = async function () {
    const cards = await this.client.from(this.table).select('id,data').eq('board', this.boardKey);
    if (cards.error) throw cards.error;
    const settings = await this.client.from(this.settingsTable).select('data').eq('board', this.boardKey).maybeSingle();
    if (settings.error) throw settings.error;
    return {
      cards: (cards.data || []).map(function (r) { return r.data; }),
      settings: settings.data ? settings.data.data : null
    };
  };
  SupabaseStore.prototype.saveCard = async function (card) {
    const res = await this.client.from(this.table).upsert(
      { id: card.id, board: this.boardKey, data: card, updated_at: new Date().toISOString() },
      { onConflict: 'board,id' });
    if (res.error) throw res.error;
  };
  SupabaseStore.prototype.deleteCard = async function (id) {
    const res = await this.client.from(this.table).delete().eq('board', this.boardKey).eq('id', id);
    if (res.error) throw res.error;
  };
  SupabaseStore.prototype.saveSettings = async function (settings) {
    const res = await this.client.from(this.settingsTable).upsert(
      { board: this.boardKey, data: settings, updated_at: new Date().toISOString() }, { onConflict: 'board' });
    if (res.error) throw res.error;
  };
  SupabaseStore.prototype.saveAll = async function (state) {
    const self = this;
    const rows = state.cards.map(function (c) { return { id: c.id, board: self.boardKey, data: c, updated_at: new Date().toISOString() }; });
    for (let i = 0; i < rows.length; i += 200) {
      const res = await this.client.from(this.table).upsert(rows.slice(i, i + 200), { onConflict: 'board,id' });
      if (res.error) throw res.error;
    }
    await this.saveSettings(state.settings);
  };
  SupabaseStore.prototype.subscribe = function (onChange) {
    const self = this;
    this.client.channel('board-' + this.boardKey)
      .on('postgres_changes', { event: '*', schema: 'public', table: this.table }, function (payload) {
        onChange({ type: 'card', payload: payload });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: this.settingsTable }, function (payload) {
        onChange({ type: 'settings', payload: payload });
      })
      .subscribe();
  };

  function create() {
    const cfg = window.JAWDA_CONFIG || {};
    if (cfg.supabase && cfg.supabase.url && cfg.supabase.anonKey && window.supabase) {
      try { return new SupabaseStore(cfg.supabase); } catch (e) { console.warn('Supabase unavailable, using local storage', e); }
    }
    return new LocalStore();
  }

  return { create: create };
})();
