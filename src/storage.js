const KEY = 'dune-arcanum-v2';
export const DEFAULT_SETTINGS = Object.freeze({ sfx: .65, music: .18, reducedMotion: false, highContrast: false, tapAim: false, assist: false, orb: 'ivory' });
export function freshProfile() { return { version: 2, records: {}, daily: {}, endlessBest: 0, settings: { ...DEFAULT_SETTINGS }, session: null, achievements: [] }; }
export function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 2) throw new Error('This is not a Dune Arcanum save from this version.');
  const clean = freshProfile();
  for (const [id, record] of Object.entries(raw.records ?? {}).slice(0, 100)) {
    if (!/^chapter-[1-4]-[1-6]$/.test(id) || !record || typeof record !== 'object') continue;
    clean.records[id] = {
      stars: Array.from({ length: 3 }, (_, i) => record.stars?.[i] === true),
      score: Math.max(0, Math.min(1e8, Number(record.score) || 0)),
      shots: Math.max(0, Math.min(9999, Number(record.shots) || 0)),
      completed: record.completed === true, assisted: record.assisted === true,
    };
  }
  for (const [id, record] of Object.entries(raw.daily ?? {}).slice(-90)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(id) && record && typeof record === 'object') clean.daily[id] = { score: Math.max(0, Math.min(1e8, Number(record.score) || 0)), stars: Array.from({ length: 3 }, (_, i) => record.stars?.[i] === true) };
  }
  clean.endlessBest = Math.max(0, Math.min(1e8, Number(raw.endlessBest) || 0));
  for (const key of ['reducedMotion', 'highContrast', 'tapAim', 'assist']) clean.settings[key] = raw.settings?.[key] === true;
  for (const key of ['sfx', 'music']) clean.settings[key] = Math.max(0, Math.min(1, Number.isFinite(raw.settings?.[key]) ? raw.settings[key] : DEFAULT_SETTINGS[key]));
  if (['ivory', 'lapis', 'copper', 'starlight'].includes(raw.settings?.orb)) clean.settings.orb = raw.settings.orb;
  clean.achievements = Array.isArray(raw.achievements) ? raw.achievements.filter(x => ['first-light', 'cartographer', 'constellation', 'master-craft', 'wanderer'].includes(x)) : [];
  return clean;
}
export class SaveStore {
  constructor(storage) {
    this.storage = storage; this.available = true; this.profile = freshProfile();
    try {
      this.storage ??= globalThis.localStorage;
      const data = this.storage?.getItem(KEY);
      if (data) { const raw = JSON.parse(data); this.profile = sanitizeProfile(raw); this.profile.session = this.validSession(raw.session); }
    } catch { this.available = false; }
  }
  validSession(session) {
    if (!session || session.version !== 2 || session.phase !== 'aiming' || !session.level || !Array.isArray(session.tiles) || session.tiles.length > 200) return null;
    const finite = v => Number.isFinite(v) && Math.abs(v) < 100000;
    const types = ['ceramic','reinforced','linked','seal','prism','core'];
    if (!finite(session.launcher?.x) || !finite(session.launcher?.y) || !finite(session.turn) || !finite(session.shots) || !finite(session.score) || !finite(session.angle) || session.angle < 12 || session.angle > 168) return null;
    if (typeof session.level.id !== 'string' || session.level.id.length > 100) return null;
    if (!session.tiles.every(t => finite(t.x) && finite(t.y) && Number.isInteger(t.hp) && t.hp >= 0 && t.hp <= 3 && types.includes(t.type) && typeof t.id === 'string' && t.w === 54 && t.h === 40)) return null;
    if (!Array.isArray(session.fixtures) || !Array.isArray(session.waves) || !session.charges || !session.stats || !session.shotStats) return null;
    if (session.fixtures.length > 40 || !session.fixtures.every(f => finite(f.x) && finite(f.y) && ['horizontal','vertical','slash','backslash'].includes(f.orientation))) return null;
    if (session.waves.length > 20 || !session.waves.every(w => Number.isInteger(w.turn) && Array.isArray(w.tiles) && w.tiles.length <= 100 && w.tiles.every(t => Number.isInteger(t.col) && t.col >= 0 && t.col < 8 && Number.isInteger(t.row) && t.row >= 0 && t.row <= 8 && types.includes(t.type) && Number.isInteger(t.hp) && t.hp > 0 && t.hp <= 3))) return null;
    if (!['pierce','echo','lift'].every(k => Number.isInteger(session.charges[k]) && session.charges[k] >= 0 && session.charges[k] < 100)) return null;
    if (![null,'pierce','echo','lift'].includes(session.armed) || (session.armed && !session.charges[session.armed])) return null;
    if (!['restored','hits','bankHits','maxChain','abilities','recalls','totalTargets'].every(k => finite(session.stats[k]) && session.stats[k] >= 0)) return null;
    if (!Number.isInteger(session.rewinds) || session.rewinds < 0 || session.rewinds > 1) return null;
    session.events = []; session.balls = []; session.snapshot = null;
    return session;
  }
  save() {
    try { this.storage?.setItem(KEY, JSON.stringify(this.profile)); this.available = !!this.storage; return this.available; }
    catch { this.available = false; return false; }
  }
  export() { const data = structuredClone(this.profile); data.session = null; return JSON.stringify(data, null, 2); }
  import(text) {
    if (text.length > 256000) throw new Error('That save is too large. Choose a Dune Arcanum JSON export.');
    const candidate = sanitizeProfile(JSON.parse(text));
    // Import merges accomplishments; importing a backup never erases better local records.
    for (const [id, record] of Object.entries(candidate.records)) {
      const existing = this.profile.records[id];
      if (existing) {
        record.stars = record.stars.map((s, i) => s || existing.stars[i]); record.completed ||= existing.completed;
        record.score = Math.max(record.score, existing.score); record.shots = existing.shots && record.shots ? Math.min(existing.shots, record.shots) : existing.shots || record.shots;
      }
      this.profile.records[id] = record;
    }
    for (const [date, record] of Object.entries(candidate.daily)) {
      const existing = this.profile.daily[date];
      this.profile.daily[date] = { score: Math.max(record.score, existing?.score ?? 0), stars: record.stars.map((s, i) => s || existing?.stars?.[i] === true) };
    }
    this.profile.endlessBest = Math.max(this.profile.endlessBest, candidate.endlessBest);
    this.profile.achievements = [...new Set([...this.profile.achievements, ...candidate.achievements])];
    this.profile.settings = candidate.settings; this.save(); return this.profile;
  }
}
