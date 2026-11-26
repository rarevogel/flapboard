// Flapboard: a split-flap departure board for trains and flights, in 15 countries and 10 writing systems.
(() => {
  'use strict';
  // ------------------------------------------------------------------ settings
  const DEF = { kind: 'train', dir: 'dep', country: 'nl', lang: 'local', theme: 'classic', speed: 'normal', rows: 0, sound: true, colour: true, caps: true, altSec: 20, orient: 'auto', roll: 0, rollS: -1, random: 'off', nsKey: '', nsStation: 'ASD', wear: 'off', frame: 'none' };
  const S = (() => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem('flapboard') || '{}')); } catch (e) { return Object.assign({}, DEF); } })();
  if (S.rollS < 0) S.rollS = (S.roll || 0) * 60;   // older versions counted minutes
  const save = () => { try { localStorage.setItem('flapboard', JSON.stringify(S)); } catch (e) { } };

  const SCRIPTS = {
    latin: { aspect: .62, size: .82, mode: 'char', font: 'FlapLatin', caps: true, alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
    cyrillic: { aspect: .64, size: .82, mode: 'char', font: 'FlapLatin', caps: true, alpha: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ' },
    greek: { aspect: .64, size: .82, mode: 'char', font: 'FlapLatin', caps: true, alpha: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ' },
    hebrew: { aspect: .66, size: .74, mode: 'char', font: 'FlapHe', rtl: true, alpha: 'אבגדהוזחטיכךלמםנןסעפףצץקרשת' },
    'han-jp': { aspect: .96, size: .78, mode: 'char', font: 'FlapJP', wide: true },
    'han-sc': { aspect: .96, size: .78, mode: 'char', font: 'FlapSC', wide: true },
    hangul: { aspect: .96, size: .76, mode: 'char', font: 'FlapKR', wide: true },
    arabic: { mode: 'word', font: 'FlapAr', rtl: true, size: .56 },
    devanagari: { mode: 'word', font: 'FlapDeva', size: .52 },
    thai: { mode: 'word', font: 'FlapThai', size: .52 },
  };
  const THEMES = {
    classic: { bg: '#141414', top: '#2a2a2a', bot: '#222', gap: '#050505', text: '#f2f0e8', label: '#c9c4b4', title: '#ffffff', warn: '#ffc53d', bad: '#ff6b5b', good: '#7ee081' },
    amber: { bg: '#0b0b0b', top: '#1f1f1f', bot: '#191919', gap: '#000', text: '#ffcf33', label: '#d9a91c', title: '#ffcf33', warn: '#ffffff', bad: '#ff6b5b', good: '#9ef08a' },
    blue: { bg: '#071a3a', top: '#123064', bot: '#0e2853', gap: '#03102a', text: '#ffffff', label: '#a9c3f0', title: '#ffffff', warn: '#ffd24a', bad: '#ff8a7a', good: '#8ff0a4' },
    white: { bg: '#d9d6cc', top: '#fbfaf5', bot: '#efede6', gap: '#8f8b80', text: '#151515', label: '#3a3a3a', title: '#111', warn: '#b86e00', bad: '#c42b1c', good: '#1f7a35' },
    green: { bg: '#06231a', top: '#0f3d2e', bot: '#0b3326', gap: '#021510', text: '#f4f1df', label: '#a8d5bf', title: '#ffffff', warn: '#ffd24a', bad: '#ff8a7a', good: '#b6ffa8' },
  };
  const SPEED = { slow: 120, normal: 72, fast: 42 };
  const WS = .58;   // text size in word flaps, as a share of the flap height

  // ------------------------------------------------------------------ random numbers that repeat for the same day/hour
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pickR = (r, a) => a[Math.floor(r() * a.length)];

  // ------------------------------------------------------------------ the timetable: generated, the same for everyone on the same day
  const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const dname = d => typeof d === 'string' ? [d, d] : [d[0], d[1] || d[0]];
  function hourServices(cc, kind, dir, day, h) {
    const C = COUNTRIES[cc], r = rng(hash([cc, kind, dir, dayKey(day), h].join('|')));
    const night = h >= 1 && h < 5, late = h === 0 || h === 5 || h === 23;
    const base = kind === 'train' ? (night ? 0 : late ? 4 : 9 + Math.floor(r() * 5)) : (night ? 1 + Math.floor(r() * 2) : late ? 5 : 11 + Math.floor(r() * 6));
    const out = [];
    for (let i = 0; i < base; i++) {
      const min = Math.floor(r() * 60), at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min).getTime();
      const s = { at, key: `${h}-${i}` };
      if (kind === 'train') {
        const T = C.train, d = pickR(r, T.dest), allowed = (typeof d !== 'string' && d[2]) ? d[2].split('|') : T.types.map(t => t[0]);
        const ty = T.types.find(t => t[0] === pickR(r, allowed)) || T.types[0];
        s.place = dname(d); s.type = ty; s.no = ty[3] ? ty[2] + Math.floor(r() * (ty[3] - ty[2] + 1)) : 0;
        const [p0, p1, sfx] = T.plat; s.plat = String(p0 + Math.floor(r() * (p1 - p0 + 1))) + (sfx && r() < .3 ? sfx[Math.floor(r() * sfx.length)] : '');
        s.plat2 = String(p0 + Math.floor(r() * (p1 - p0 + 1)));
      } else {
        const A = C.air, al = r() < .62 ? pickR(r, A.home) : pickR(r, A.other);
        s.place = dname(pickR(r, A.dest)); s.air = al; s.no = A.home.includes(al) ? (r() < .5 ? 100 + Math.floor(r() * 900) : 1000 + Math.floor(r() * 8999)) : 10 + Math.floor(r() * 990);
        const [let_, g0, g1] = A.gate; s.gate = (let_ ? let_[Math.floor(r() * let_.length)] : '') + (g0 + Math.floor(r() * (g1 - g0 + 1)));
      }
      const p = r();
      s.cancel = p < .03; s.delay = 0; s.change = false;
      if (!s.cancel) { if (p < .22) s.delay = 2 + Math.floor(r() * 24); else if (p < .26) s.delay = 30 + Math.floor(r() * 66); else if (kind === 'train' && p < .3) s.change = true; }
      if (kind === 'air' && s.delay && s.delay < 10) s.delay += 10;
      out.push(s);
    }
    return out;
  }
  function services(now) {
    const out = [], base = new Date(now);
    for (const off of [-1, 0, 1]) {
      const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + off);
      for (let h = 0; h < 24; h++) {
        const start = day.getTime() + h * 3600e3;
        if (start + 5400e3 < now - 3600e3 || start > now + 8 * 3600e3) continue;
        out.push(...hourServices(S.country, S.kind, S.dir, day, h));
      }
    }
    return out.sort((a, b) => a.at - b.at || (a.no - b.no));
  }
  const pad = n => String(n).padStart(2, '0');
  const hhmm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  // ------------------------------------------------------------------ language
  let lang = 'local';                 // what the board shows right now ('local' or 'latin')
  const C = () => COUNTRIES[S.country];
  const SC = () => SCRIPTS[C().script];
  const isLatinCountry = () => C().script === 'latin';
  const sets = () => lang === 'local' ? C() : EN;
  const ARAB = '٠١٢٣٤٥٦٧٨٩';
  function digits(s) { return lang === 'local' && C().digits === 'arab' ? String(s).replace(/[0-9]/g, d => ARAB[d]) : String(s); }
  function caps(s) {
    if (!S.caps) return s;
    const sc = lang === 'local' ? C().script : 'latin';
    if (!SCRIPTS[sc].caps) return s;
    let u = s.toUpperCase();
    if (sc === 'greek') u = u.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
    return u.replace('ß'.toUpperCase(), 'SS');
  }
  function ui(key) {
    const u = lang === 'local' ? C().ui : EN.ui;
    if (lang === 'local') {
      if (S.kind === 'air' && (key === 'dep' || key === 'arr' || key === 'to' || key === 'from' || key === 'time') && u['f' + key]) return u['f' + key];
      if (S.dir === 'arr' && key === 'time' && u.atime) return u.atime;
    }
    return u[key];
  }
  const fmt = (tpl, m, t) => tpl.replace('{m}', m).replace('{t}', t);

  function rowFields(s, now) {
    const st = S.kind !== 'air' ? sets().ts : sets().fs, T = s.at + s.delay * 60e3, L = lang === 'local' ? 0 : 1;
    let rem = '', kind = 'ok', plat = '';
    const num = S.kind !== 'air' ? (s.type[3] ? s.type[L] + (s.type[4] ?? ' ') + s.no : s.type[L]) : s.air + ' ' + s.no;
    if (S.kind !== 'air') {
      plat = s.change ? s.plat2 : s.plat;
      if (s.cancel) { rem = st.cancel; kind = 'bad'; plat = ''; }
      else if (S.dir === 'dep') {
        if (now >= T) { rem = st.dep; kind = 'info'; }
        else if (st.board && now >= T - 15 * 60e3) { rem = now >= T - 3 * 60e3 ? st.close : st.board; kind = 'good'; }
        else if (s.delay) { rem = fmt(st.delay, s.delay, hhmm(T)); kind = 'warn'; }
        else if (s.change) { rem = st.plat; kind = 'warn'; }
        else rem = st.on;
      } else {
        if (now >= T) { rem = st.arr; kind = 'info'; }
        else if (s.delay) { rem = fmt(st.delay, s.delay, hhmm(T)); kind = 'warn'; }
        else if (s.change) { rem = st.plat; kind = 'warn'; }
        else rem = st.on;
      }
    } else {
      plat = T - now < 110 * 60e3 ? s.gate : '';
      if (s.cancel) { rem = st.cancel; kind = 'bad'; plat = ''; }
      else if (S.dir === 'dep') {
        if (now >= T) { rem = st.dep; kind = 'info'; }
        else if (now >= T - 10 * 60e3) { rem = st.close; kind = 'bad'; }
        else if (now >= T - 20 * 60e3) { rem = st.final; kind = 'warn'; }
        else if (now >= T - 40 * 60e3) { rem = st.board; kind = 'good'; }
        else if (s.delay) { rem = fmt(st.delay, s.delay, hhmm(T)); kind = 'warn'; }
        else rem = st.sched;
      } else {
        plat = '';
        if (now >= T) { rem = st.landed; kind = 'good'; }
        else if (s.delay) { rem = fmt(st.exp, s.delay, hhmm(T)); kind = 'warn'; }
        else rem = st.sched;
      }
    }
    return { time: digits(hhmm(s.at)), num: caps(digits(num)), place: caps(s.place[L]), plat: caps(digits(plat)), rem: caps(digits(rem)), kind };
  }
  function boardRows(now, n) {
    const keep = S.kind !== 'air' ? (S.dir === 'dep' ? 60e3 : 120e3) : (S.dir === 'dep' ? 4 * 60e3 : 10 * 60e3);
    return services(now).filter(s => (s.cancel ? s.at + 120e3 : s.at + s.delay * 60e3 + keep) > now).slice(0, n);
  }

  // ------------------------------------------------------------------ live NS (Dutch railways): needs your own free key from apiportal.ns.nl
  const NS = { data: null, at: 0, err: '', loading: false };
  const NS_LOCAL = ['flapboard.local', '127.0.0.1', 'localhost'].includes(location.hostname);   // the app and the screensavers relay the request
  const NS_FALLBACK = [['ASD', 'Amsterdam Centraal'], ['ASDZ', 'Amsterdam Zuid'], ['ASS', 'Amsterdam Sloterdijk'], ['SHL', 'Schiphol Airport'], ['UT', 'Utrecht Centraal'], ['RTD', 'Rotterdam Centraal'],
    ['GVC', 'Den Haag Centraal'], ['EHV', 'Eindhoven Centraal'], ['AMF', 'Amersfoort Centraal'], ['ZL', 'Zwolle'], ['GN', 'Groningen'], ['LW', 'Leeuwarden'], ['AH', 'Arnhem Centraal'], ['NM', 'Nijmegen'],
    ['MT', 'Maastricht'], ['BD', 'Breda'], ['HT', "'s-Hertogenbosch"], ['TB', 'Tilburg'], ['LEDN', 'Leiden Centraal'], ['HLM', 'Haarlem'], ['ALM', 'Almere Centrum'], ['ES', 'Enschede'], ['DV', 'Deventer'],
    ['APD', 'Apeldoorn'], ['VL', 'Venlo'], ['AMR', 'Alkmaar'], ['DT', 'Delft'], ['GD', 'Gouda'], ['DDR', 'Dordrecht'], ['HVS', 'Hilversum']];
  function nsList() { try { const c = JSON.parse(localStorage.getItem('flapboard.nsStations') || 'null'); if (c && c.list && c.list.length) return c.list; } catch (e) { } return NS_FALLBACK; }
  const nsName = code => (nsList().find(x => x[0] === code) || [code, code])[1];
  const nsUrl = path => NS_LOCAL ? '/ns/' + path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(S.nsKey) : 'https://gateway.apiportal.ns.nl/' + path;
  async function nsGet(path) {
    const r = await fetch(nsUrl(path), NS_LOCAL ? { cache: 'no-store' } : { cache: 'no-store', headers: { 'Ocp-Apim-Subscription-Key': S.nsKey } });
    if (r.status === 401 || r.status === 403) throw new Error('key');
    if (!r.ok) throw new Error('net');
    return r.json();
  }
  async function nsStations(force) {
    let c = null; try { c = JSON.parse(localStorage.getItem('flapboard.nsStations') || 'null'); } catch (e) { }
    if (!S.nsKey || (!force && c && Date.now() - c.at < 30 * 864e5)) return;
    try {
      const j = await nsGet('reisinformatie-api/api/v2/stations');
      const list = (j.payload || []).filter(x => x.land === 'NL' && x.heeftVertrektijden !== false).map(x => [x.code, (x.namen && (x.namen.lang || x.namen.middel)) || x.code]).sort((a, b) => a[1].localeCompare(b[1], 'nl'));
      if (list.length) localStorage.setItem('flapboard.nsStations', JSON.stringify({ at: Date.now(), list }));
    } catch (e) { }
  }
  async function nsLoad(force) {
    if (S.kind !== 'ns' || !S.nsKey || NS.loading) return;
    if (!force && Date.now() - NS.at < (NS.err ? 60e3 : 30e3)) return;
    NS.loading = true;
    try {
      const what = S.dir === 'dep' ? 'departures' : 'arrivals';
      const j = await nsGet(`reisinformatie-api/api/v2/${what}?station=${encodeURIComponent(S.nsStation)}&maxJourneys=40&lang=${S.lang === 'latin' ? 'en' : 'nl'}`);
      NS.data = (j.payload && (j.payload.departures || j.payload.arrivals)) || []; NS.err = '';
    } catch (e) { NS.err = e.message === 'key' ? 'key' : e.message === 'net' ? 'net' : 'blocked'; }
    NS.at = Date.now(); NS.loading = false; lastSig = '';
  }
  function nsTime(t) {   // "2026-11-22T14:02:00+0100": the clock time as written, and the moment
    const m = /(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?([+-])(\d\d):?(\d\d)/.exec(t || '');
    if (!m) return null;
    const off = (m[7] === '-' ? -1 : 1) * (+m[8] * 60 + +m[9]);
    return { hm: m[4] + ':' + m[5], ms: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - off * 60e3 };
  }
  const NS_MSG = { nl: { key: ['NS-SLEUTEL NODIG', 'ZIE INSTELLINGEN'], bad: ['SLEUTEL GEWEIGERD', 'ZIE INSTELLINGEN'], net: ['GEEN VERBINDING', 'PROBEERT OPNIEUW'], blocked: ['LIVE NS: GEBRUIK DE APP', 'OF DE SCREENSAVER'], wait: ['GEGEVENS LADEN', ''] },
    en: { key: ['NS API KEY NEEDED', 'SEE SETTINGS'], bad: ['KEY NOT ACCEPTED', 'SEE SETTINGS'], net: ['NO CONNECTION', 'TRYING AGAIN'], blocked: ['LIVE NS: USE THE APP', 'OR THE SCREENSAVER'], wait: ['LOADING', ''] } };
  function nsPool(col, Lx, st) {
    const M = NS_MSG[Lx ? 'en' : 'nl'], out = [];
    if (col === 'num') ['IC 99999', 'SPR 99999', 'ICE 999', 'ICD 9999', 'EST 9999', 'NSI 999', 'RE 99999', 'ST 99999', 'S 99999'].forEach(t => out.push(t));
    if (col === 'place') { nsList().forEach(x => out.push(caps(x[1]))); Object.values(M).forEach(m => out.push(caps(m[0]))); ['Brussel-Zuid', 'Berlin Ostbahnhof', 'Frankfurt (Main) Hbf', 'London St Pancras', 'Paris Nord'].forEach(t => out.push(caps(t))); }
    if (col === 'plat') out.push('14B');
    if (col === 'rem') { Object.values(st).forEach(t => out.push(caps(fmt(t, 45, '00:00')))); Object.values(M).forEach(m => out.push(caps(m[1]))); }
    return out;
  }
  function nsRows(now, n) {
    const M = NS_MSG[lang === 'latin' ? 'en' : 'nl'], blank = { time: '', num: '', place: '', plat: '', rem: '', kind: 'ok' };
    const msg = m => [{ ...blank, place: caps(m[0]), rem: caps(m[1]), kind: 'warn' }];
    if (!S.nsKey) return msg(M.key);
    if (!NS.data) return NS.err ? msg(NS.err === 'key' ? M.bad : M[NS.err]) : msg(M.wait);
    const st = sets().ts, keep = S.dir === 'dep' ? 60e3 : 120e3, out = [];
    for (const t of NS.data) {
      const pl = nsTime(t.plannedDateTime), ac = nsTime(t.actualDateTime) || pl; if (!pl) continue;
      if (!t.cancelled && ac.ms + keep < now) continue;
      if (t.cancelled && pl.ms + 120e3 < now) continue;
      const p = t.product || {}, delay = Math.round((ac.ms - pl.ms) / 60e3), track = t.actualTrack || t.plannedTrack || '', moved = t.actualTrack && t.plannedTrack && t.actualTrack !== t.plannedTrack;
      let rem = st.on, kind = 'ok';
      if (t.cancelled) { rem = st.cancel; kind = 'bad'; }
      else if (ac.ms <= now) { rem = S.dir === 'dep' ? st.dep : st.arr; kind = 'info'; }
      else if (delay > 0) { rem = fmt(st.delay, delay, ac.hm); kind = 'warn'; }
      else if (moved) { rem = st.plat; kind = 'warn'; }
      out.push({ time: pl.hm, num: caps(`${p.shortCategoryName || p.categoryCode || ''} ${p.number || ''}`.trim()), place: caps(t.direction || t.origin || ''), plat: caps(t.cancelled ? '' : track), rem: caps(rem), kind });
      if (out.length >= n) break;
    }
    if (NS.err && Date.now() - NS.at < 5e3 && out.length < n) out.push({ ...blank, place: caps((NS.err === 'key' ? M.bad : M[NS.err])[0]), kind: 'warn' });
    return out;
  }

  // ------------------------------------------------------------------ layout
  const cv = document.getElementById('board'), g = cv.getContext('2d');
  let FR = 0, W = 0, H = 0, dpr = 1, L = null, cells = [], clockCells = [], tiles = new Map(), drums = {};
  const COLS = () => ['time', 'num', 'place', 'plat', 'rem'];
  function activeScripts() {
    if (S.lang === 'local') return [C().script];
    if (S.lang === 'latin') return ['latin'];
    return [...new Set([C().script, 'latin'])];
  }
  function boardMode() {
    const sc = activeScripts();
    if (sc.some(s => SCRIPTS[s].mode === 'word')) return 'word';
    if (sc.length > 1 && (sc.some(s => SCRIPTS[s].wide) || sc.some(s => SCRIPTS[s].rtl))) return 'word';
    return 'char';
  }
  function fontFor(sc) {
    const order = { 'han-jp': ['FlapJP', 'FlapSC'], 'han-sc': ['FlapSC', 'FlapJP'] }[sc] || ['FlapJP', 'FlapSC'];
    const list = ['FlapLatin', SCRIPTS[sc].font, ...order, 'FlapKR', 'FlapHe', 'FlapAr', 'FlapDeva', 'FlapThai'];
    return [...new Set(list)].map(f => `'${f}'`).join(',') + ', sans-serif';
  }
  const fontStack = () => fontFor(C().script);
  // every text a column can hold, in the languages on show: sizes the columns and fills the flap drums
  function pool(col) {
    const out = new Set(), keep = lang;
    for (const lg of (S.lang === 'alt' ? ['local', 'latin'] : [S.lang])) {
      lang = lg; const Lx = lg === 'local' ? 0 : 1, st = S.kind !== 'air' ? sets().ts : sets().fs;
      if (col === 'time') out.add(digits('00:00'));
      if (S.kind === 'ns') { nsPool(col, Lx, st).forEach(t => out.add(t)); if (col !== 'time' && col !== 'label') continue; }
      if (col === 'num') {
        if (S.kind !== 'air') C().train.types.forEach(t => out.add(caps(digits(t[3] ? t[Lx] + (t[4] ?? ' ') + t[3] : t[Lx]))));
        else [...C().air.home, ...C().air.other].forEach(a => out.add(caps(digits(a + ' ' + (C().air.home.includes(a) ? 9999 : 999)))));
      }
      if (col === 'place') (S.kind !== 'air' ? C().train.dest : C().air.dest).forEach(d => out.add(caps(dname(d)[Lx])));
      if (col === 'plat') { if (S.kind !== 'air') { const [, p1, sfx] = C().train.plat; out.add(caps(digits(p1 + (sfx ? 'b' : '')))); } else { const [l, , g1] = C().air.gate; out.add(digits((l ? l[0] : '') + g1)); } }
      if (col === 'rem') Object.values(st).forEach(t => out.add(caps(digits(fmt(t, 45, '00:00')))));
      if (col === 'label') ['dep', 'arr', 'time', S.kind !== 'air' ? 'train' : 'flight', S.dir === 'dep' ? 'to' : 'from', S.kind !== 'air' ? 'plat' : 'gate', 'rem'].forEach(k => out.add(ui(k)));
    }
    lang = keep; return [...out];
  }
  const glen = s => [...s].length;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth; H = window.innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    tiles.clear();
    FR = S.frame !== 'none' ? Math.round(Math.max(10, Math.min(W, H) * .03)) : 0;
    const mode = boardMode(), sc = SCRIPTS[activeScripts()[0]], aspect = mode === 'char' ? Math.max(...activeScripts().map(s => SCRIPTS[s].aspect || .62)) : .62;
    const wide = activeScripts().some(s => SCRIPTS[s].wide), rtl = lang === 'local' && SC().rtl;
    const caps_ = { num: wide ? 9 : 14, place: wide ? 9 : 22, rem: wide ? 8 : 17, plat: 4 };
    const font = fontStack(), mg = g;
    // column specs: char columns count cells; word columns are measured
    let cols = COLS().map(k => {
      const p = pool(k);
      if (k === 'time' || mode === 'char') return { k, type: 'char', n: k === 'time' ? 5 : Math.max(2, Math.min(caps_[k] || 20, Math.max(...p.map(glen)))) };
      mg.font = `700 100px ${font}`;
      return { k, type: 'word', wpx: Math.max(...p.map(t => mg.measureText(t).width)) / 100 };
    });
    const unitW = c => c.type === 'char' ? c.n * (c.k === 'time' ? .62 : aspect) + (c.n - 1) * .06 : c.wpx * WS + .5;
    const tryCols = list => { const K = list.reduce((a, c) => a + unitW(c), 0) + (list.length - 1) * .42; return (W - 24 - 2 * FR - (FR ? .7 * 30 : 0)) / K; };
    let hW = tryCols(cols);
    if (hW < 22 && cols.length > 4) { cols = cols.filter(c => c.k !== 'num'); hW = tryCols(cols); }
    if (hW < 18) { cols.forEach(c => { if (c.type === 'char' && c.k === 'place') c.n = Math.min(c.n, wide ? 5 : 12); if (c.type === 'char' && c.k === 'rem') c.n = Math.min(c.n, wide ? 5 : 11); }); hW = tryCols(cols); }
    const extra = S.wear !== 'off' ? .5 : 0, head = 2.3 + extra + (FR ? .35 : 0), rowU = 1.16, HA = H - 16 - 2 * FR;
    let h, rows;
    if (S.rows) { rows = S.rows; h = Math.min(hW, HA / (head + rows * rowU + (FR ? .35 : 0))); }
    else { h = Math.min(hW, HA / (head + 4 * rowU)); rows = Math.max(3, Math.min(30, Math.floor((HA / h - head - (FR ? .35 : 0)) / rowU))); }
    h = Math.floor(h);
    const total = cols.reduce((a, c) => a + unitW(c) * h, 0) + (cols.length - 1) * .42 * h, x0 = Math.round((W - total) / 2);
    const y0 = Math.round((H - (head + rows * rowU) * h) / 2) + Math.round(head * h);
    // place columns, mirrored for right-to-left languages
    let x = x0; const order = rtl ? [...cols].reverse() : cols;
    for (const c of order) { c.x = x; c.w = unitW(c) * h; x += c.w + .42 * h; }
    L = { h, rows, cols, x0, total, y0, mode, aspect, rtl, font, head, rowU, lampY: y0 - head * h + (FR ? .35 * h : 0), top: y0 - head * h + (extra + (FR ? .35 : 0)) * h, extra };
    // cells
    const old = cells; cells = [];
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * rowU * h;
      for (const c of cols) {
        if (c.type === 'char') { const cw = (c.k === 'time' ? .62 : aspect) * h; for (let i = 0; i < c.n; i++) cells.push(cell(c.x + i * (cw + .06 * h), y, cw, h, 'char', r, c.k, i)); }
        else cells.push(cell(c.x, y, c.w, h, 'word', r, c.k, 0));
      }
    }
    // the clock in the header, as flaps too
    clockCells = []; const ch = Math.round(h * 1.0), cw = .62 * ch, cx = rtl ? x0 : x0 + total - 5 * cw - 4 * .06 * ch, cy = L.top + .15 * h;
    for (let i = 0; i < 5; i++) clockCells.push(cell(cx + i * (cw + .06 * ch), cy, cw, ch, 'char', -1, 'clock', i));
    buildDrums();
    drawAll();
    lastSig = ''; update(true);
    void old;
  }
  function cell(x, y, w, h, type, row, col, idx) {
    const r = rng(hash(`${row}|${col}|${idx}|${S.country}`));   // each flap has its own little history
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), type, row, col, idx, cur: { t: ' ', c: 'text' }, tgt: { t: ' ', c: 'text' }, anim: null, wait: 0, left: 0,
      fade: r() < .14 ? .025 + r() * .05 : 0, sticky: r() < .05, dy: r() < .2 ? (r() - .5) * 1.4 : 0 };
  }

  // drums: the order of the characters on each flap wheel
  function buildDrums() {
    const chars = new Set();
    for (const k of COLS()) pool(k).forEach(t => [...t].forEach(ch => chars.add(ch)));
    const scs = activeScripts(), seq = [' '];
    for (const s of scs) { const a = SCRIPTS[s].alpha; if (a) seq.push(...a); }
    if (!S.caps) for (const s of scs) { const a = SCRIPTS[s].alpha; if (a) seq.push(...a.toLowerCase()); }
    seq.push(...'0123456789', ...ARAB, ...':.-+/\'()&');
    const extra = [...chars].filter(c => !seq.includes(c)).sort();
    const all = [...new Set([...seq.filter(c => chars.has(c) || c === ' ' || /[A-Z0-9]/.test(c) || SCRIPTS[scs[0]].alpha?.includes(c)), ...extra])];
    drums.main = all; drums.idx = new Map(all.map((c, i) => [c, i])); drums.seq = all.length <= 96;
    drums.clock = [...' 0123456789:']; drums.cidx = new Map(drums.clock.map((c, i) => [c, i]));
    drums.words = {}; for (const k of COLS()) drums.words[k] = pool(k);
  }

  // ------------------------------------------------------------------ tiles: one pre-drawn flap per text and colour
  function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function tile(c, v) {
    const key = c.type + c.w + 'x' + c.h + '|' + v.t + '|' + v.c + '|' + (c.col === 'clock' ? 'k' : c.col === 'time' ? 't' : '');
    let t = tiles.get(key); if (t) return t;
    const th = THEMES[S.theme], w = Math.max(1, Math.round(c.w * dpr)), h = Math.max(1, Math.round(c.h * dpr));
    t = document.createElement('canvas'); t.width = w; t.height = h;
    const x = t.getContext('2d'), r = Math.max(1, h * .07);
    const path = () => { x.beginPath(); x.moveTo(r, 0); x.arcTo(w, 0, w, h, r); x.arcTo(w, h, 0, h, r); x.arcTo(0, h, 0, 0, r); x.arcTo(0, 0, w, 0, r); x.closePath(); };
    path(); x.save(); x.clip();
    let gr = x.createLinearGradient(0, 0, 0, h / 2); gr.addColorStop(0, th.top); gr.addColorStop(1, shade(th.top, -6)); x.fillStyle = gr; x.fillRect(0, 0, w, h / 2);
    gr = x.createLinearGradient(0, h / 2, 0, h); gr.addColorStop(0, th.bot); gr.addColorStop(1, shade(th.bot, -10)); x.fillStyle = gr; x.fillRect(0, h / 2, w, h / 2);
    if (v.t && v.t !== ' ') {
      x.fillStyle = th[v.c] || th.text; x.textBaseline = 'middle';
      const isClock = c.col === 'clock' || c.col === 'time' || /^[0-9٠-٩:]$/.test(v.t);
      const sc = SCRIPTS[lang === 'local' ? C().script : 'latin'];
      if (c.type === 'char') {
        const wideCh = /[　-鿿가-힯＀-￯]/.test(v.t);
        const size = h * (isClock ? .84 : wideCh ? .76 : (sc.size || .82));
        x.font = `700 ${size}px ${L.font}`; x.textAlign = 'center';
        const m = x.measureText(v.t); const sx = Math.min(1, (w * .94) / Math.max(1, m.width));
        x.save(); x.translate(w / 2, h * .53); x.scale(sx, 1); x.fillText(v.t, 0, 0); x.restore();
      } else {
        const rtlText = /[֐-ࣿ]/.test(v.t);
        const size = h * WS;
        x.font = `700 ${size}px ${L.font}`; x.direction = rtlText ? 'rtl' : 'ltr'; x.textAlign = rtlText ? 'right' : 'left';
        const m = x.measureText(v.t), avail = w - h * .5, sx = Math.min(1, avail / Math.max(1, m.width));
        x.save(); x.translate(rtlText ? w - h * .25 : h * .25, h * .54); x.scale(sx, 1); x.fillText(v.t, 0, 0); x.restore();
      }
    }
    x.restore();
    // a soft edge light on top
    x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = Math.max(1, dpr); path(); x.stroke();
    tiles.set(key, t); if (tiles.size > 6000) tiles.clear();
    return t;
  }
  function shade(hex, p) { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, v + p)); return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0'); }

  // ------------------------------------------------------------------ drawing
  function drawCell(c, now) {
    const th = THEMES[S.theme], worn = S.wear !== 'off', { x, w, h } = c, y = c.y + (worn ? c.dy : 0), hh = h / 2;
    g.fillStyle = th.bg; g.fillRect(x - 1, c.y - 2, w + 2, h + 4);
    if (!c.anim) { g.drawImage(tile(c, c.cur), x, y, w, h); }
    else {
      const p = Math.min(1, (now - c.anim.t0) / c.anim.dur), A = tile(c, c.anim.from), B = tile(c, c.anim.to), tw = A.width, tH = A.height;
      g.drawImage(B, 0, 0, tw, tH / 2, x, y, w, hh);                 // the new top, uncovered
      g.drawImage(A, 0, tH / 2, tw, tH / 2, x, y + hh, w, hh);       // the old bottom, still showing
      if (p < .5) {
        const k = Math.cos(p * Math.PI);                              // the old top falls forward
        g.drawImage(A, 0, 0, tw, tH / 2, x, y + hh * (1 - k), w, hh * k);
        g.fillStyle = `rgba(0,0,0,${(1 - k) * .45})`; g.fillRect(x, y + hh * (1 - k), w, hh * k);
      } else {
        const k = -Math.cos(p * Math.PI);                             // and lands as the new bottom
        g.drawImage(B, 0, tH / 2, tw, tH / 2, x, y + hh, w, hh * k);
        g.fillStyle = `rgba(0,0,0,${(1 - k) * .35})`; g.fillRect(x, y + hh, w, hh * k);
      }
    }
    g.fillStyle = th.gap; g.fillRect(x, y + hh - Math.max(.6, h * .018), w, Math.max(1.2, h * .036));
    // hinge pins
    g.fillStyle = 'rgba(0,0,0,.55)'; const pw = Math.max(1, w * .035); g.fillRect(x, y + hh - h * .06, pw, h * .12); g.fillRect(x + w - pw, y + hh - h * .06, pw, h * .12);
    if (worn) {
      if (c.fade) { g.fillStyle = `rgba(255,255,240,${c.fade})`; g.fillRect(x, y, w, h); }          // sun-faded flaps
      const lx = W / 2, ly = (L ? L.lampY : 0) - H * .25, d = Math.hypot(x + w / 2 - lx, y + h / 2 - ly) / Math.hypot(W, H);
      g.fillStyle = `rgba(0,0,0,${Math.min(.32, Math.max(0, d - .25) * .55)})`; g.fillRect(x, y, w, h); // the light falls from above
    }
  }
  function drawFrame(th) {
    const h = L.h, p = .35 * h, bx = L.x0 - p, by = L.lampY - p * .6 - (FR ? 0 : 0), bw = L.total + 2 * p, bh = L.y0 + L.rows * L.rowU * h - by + p * .4;
    g.fillStyle = S.theme === 'white' ? '#6e6b62' : '#050505'; g.fillRect(0, 0, W, H);      // the wall
    const f = FR, ox = bx - f, oy = by - f, ow = bw + 2 * f, oh = bh + 2 * f;
    if (S.frame === 'alu') {
      let gr = g.createLinearGradient(0, oy, 0, oy + oh); gr.addColorStop(0, '#d9dde2'); gr.addColorStop(.45, '#9aa1a8'); gr.addColorStop(.55, '#b6bcc2'); gr.addColorStop(1, '#6f767d');
      g.fillStyle = gr; g.fillRect(ox, oy, ow, oh);
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.strokeRect(ox + .5, oy + .5, ow - 1, oh - 1);
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(bx - .5, by - .5, bw + 1, bh + 1);
      g.fillStyle = '#5b6168'; for (const [sx, sy] of [[ox + f / 2, oy + f / 2], [ox + ow - f / 2, oy + f / 2], [ox + f / 2, oy + oh - f / 2], [ox + ow - f / 2, oy + oh - f / 2]]) { g.beginPath(); g.arc(sx, sy, f * .18, 0, 7); g.fill(); g.strokeStyle = '#2c3034'; g.beginPath(); g.moveTo(sx - f * .12, sy); g.lineTo(sx + f * .12, sy); g.stroke(); }
    } else if (S.frame === 'wood') {
      g.fillStyle = '#6b3f22'; g.fillRect(ox, oy, ow, oh);
      const r = rng(7); g.lineWidth = 1;
      for (let i = 0; i < 70; i++) { const yy = oy + r() * oh; g.strokeStyle = `rgba(${r() < .5 ? '40,20,8' : '150,95,50'},${.25 + r() * .3})`; g.beginPath(); g.moveTo(ox, yy); g.bezierCurveTo(ox + ow * .3, yy + (r() - .5) * 10, ox + ow * .7, yy + (r() - .5) * 10, ox + ow, yy + (r() - .5) * 6); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
    }
    g.fillStyle = th.bg; g.fillRect(bx, by, bw, bh);
  }
  let lampAt = 0;
  function drawLamps(now) {   // the light strip over the header: one lamp is dead, one flickers
    if (S.wear === 'off' || !L) return;
    const th = THEMES[S.theme], h = L.h, y = L.lampY, n = Math.max(4, Math.round(L.total / (h * 4))), r = rng(hash(S.country + S.theme)), dead = Math.floor(r() * n), flick = (dead + 1 + Math.floor(r() * (n - 1))) % n;
    g.fillStyle = th.bg; g.fillRect(L.x0 - 2, y - 2, L.total + 4, h * .42 + 4);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(L.x0, y + h * .05, L.total, h * .26);
    for (let i = 0; i < n; i++) {
      const cx = L.x0 + (i + .5) * L.total / n, on = i === dead ? 0 : i === flick ? (Math.sin(now / 37) + Math.sin(now / 113) > -.4 ? .55 + Math.random() * .45 : .06) : 1;
      const gr = g.createRadialGradient(cx, y + h * .18, 0, cx, y + h * .18, h * 1.2);
      gr.addColorStop(0, `rgba(255,236,190,${.22 * on})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
      g.fillStyle = gr; g.fillRect(cx - h * 1.2, y, h * 2.4, h * .42);
      g.fillStyle = on ? `rgba(255,${230 + 20 * on},${180 + 60 * on},${.35 + .65 * on})` : '#3a3a36';
      g.fillRect(cx - h * .45, y + h * .12, h * .9, h * .12);
    }
  }
  function drawStatic() {
    const th = THEMES[S.theme], h = L.h;
    g.fillStyle = th.bg; g.fillRect(0, 0, W, H);
    if (FR) drawFrame(th);
    drawLamps(performance.now());
    // header: title, place, and the column labels
    const rtl = L.rtl, tx = rtl ? L.x0 + L.total : L.x0, top = L.top;
    g.fillStyle = th.title; g.textBaseline = 'alphabetic'; g.direction = rtl ? 'rtl' : 'ltr'; g.textAlign = rtl ? 'right' : 'left';
    const icon = S.kind === 'ns' ? '🇳🇱' : S.kind !== 'air' ? '🚆' : (S.dir === 'dep' ? '🛫' : '🛬');
    const title = ui(S.dir === 'dep' ? 'dep' : 'arr'), hub = S.kind === 'ns' ? nsName(S.nsStation) : dname(C()[S.kind].hub)[lang === 'local' ? 0 : 1];
    g.font = `700 ${h * .95}px ${L.font}`; const tw = g.measureText(caps(title)).width;
    g.fillText(caps(title), tx, top + h * .95);
    g.font = `600 ${h * .5}px ${L.font}`; g.fillStyle = th.label;
    g.fillText(`${icon} ${hub}`, rtl ? tx - tw - h * .5 : tx + tw + h * .5, top + h * .9);
    g.font = `600 ${Math.max(9, h * .36)}px ${L.font}`; g.fillStyle = th.label;
    for (const c of L.cols) {
      const key = { time: 'time', num: S.kind !== 'air' ? 'train' : 'flight', place: S.dir === 'dep' ? 'to' : 'from', plat: S.kind !== 'air' ? 'plat' : 'gate', rem: 'rem' }[c.k];
      g.textAlign = rtl ? 'right' : 'left'; g.fillText(ui(key), rtl ? c.x + c.w : c.x, L.y0 - h * .22);
    }
    g.fillStyle = th.label; g.globalAlpha = .25; g.fillRect(L.x0, L.y0 - h * .12, L.total, Math.max(1, h * .03)); g.globalAlpha = 1;
  }
  function drawAll() { drawStatic(); const now = performance.now(); for (const c of cells) drawCell(c, now); for (const c of clockCells) drawCell(c, now); }

  // ------------------------------------------------------------------ setting texts and flipping
  const same = (a, b) => a.t === b.t && a.c === b.c;
  function visual(text, n, col) {
    // char cells: left aligned; Hebrew right aligned, with numbers kept left-to-right
    let a;
    if (L.rtl && lang === 'local' && SC().mode === 'char') {
      const toks = text.match(/[0-9A-Za-z:.+]+|[^0-9A-Za-z:.+]/g) || [];
      a = []; toks.reverse().forEach(t => a.push(...(/^[0-9A-Za-z:.+]+$/.test(t) ? [...t] : [t])));
      if (a.length > n) a = a.slice(a.length - n);
      while (a.length < n) a.unshift(' ');
    } else {
      a = [...text].slice(0, n); while (a.length < n) a.push(' ');
      if (col === 'plat' && text.length < n) { a = [...text]; while (a.length < n) a.unshift(' '); }   // numbers right aligned
    }
    return a;
  }
  function setRow(r, f, stagger) {
    const colourOf = k => !S.colour ? 'text' : f.kind === 'ok' ? 'text' : f.kind === 'info' ? 'label' : f.kind;
    for (const c of cells) {
      if (c.row !== r) continue;
      let v;
      if (c.type === 'char') { const col = L.cols.find(x => x.k === c.col); v = { t: visual(f[c.col] || '', col.n, c.col)[c.idx], c: c.col === 'rem' ? colourOf() : 'text' }; }
      else v = { t: f[c.col] || '', c: c.col === 'rem' ? colourOf() : 'text' };
      target(c, v, stagger ? (L.cols.findIndex(x => x.k === c.col) * 70 + c.idx * 25 + Math.random() * 220 + r * 40) : 0);
    }
  }
  function target(c, v, delay) {
    if (same(c.tgt, v)) return;
    c.tgt = v; c.wait = performance.now() + delay;
    c.left = c.type === 'word' ? 2 + Math.floor(Math.random() * 4) : (drums.seq && c.col !== 'clock' ? 0 : 3 + Math.floor(Math.random() * 7));
    active.add(c);
  }
  function nextValue(c) {
    if (c.force) {   // a full turn of the drum, back to the same text
      if (c.type === 'word' || (!drums.seq && c.col !== 'clock')) {
        if (c.left-- > 0) { const p = c.type === 'word' ? drums.words[c.col] : drums.main; return { t: p[Math.floor(Math.random() * p.length)], c: c.tgt.c }; }
        c.force = false; return c.tgt;
      }
      const d = c.col === 'clock' ? drums.clock : drums.main, ix = c.col === 'clock' ? drums.cidx : drums.idx;
      const nx = d[((ix.get(c.cur.t) ?? 0) + 1) % d.length];
      if (nx === c.tgt.t) { c.force = false; return c.tgt; }
      return { t: nx, c: c.tgt.c };
    }
    if (c.type === 'word') { if (c.left-- > 0) { const p = drums.words[c.col]; return { t: p[Math.floor(Math.random() * p.length)], c: c.tgt.c }; } return c.tgt; }
    if (c.col === 'clock') { const i = drums.cidx.get(c.cur.t) ?? 0, j = drums.cidx.get(c.tgt.t); if (j === undefined) return c.tgt; return { t: drums.clock[(i + 1) % drums.clock.length], c: c.tgt.c }; }
    if (c.cur.c !== c.tgt.c && c.cur.t === c.tgt.t) return c.tgt;
    if (drums.seq) {
      const i = drums.idx.get(c.cur.t), j = drums.idx.get(c.tgt.t);
      if (i === undefined || j === undefined) return c.tgt;
      const nx = drums.main[(i + 1) % drums.main.length];
      return { t: nx, c: nx === c.tgt.t ? c.tgt.c : c.cur.c === c.tgt.c ? c.cur.c : c.tgt.c };
    }
    if (c.left-- > 0) return { t: drums.main[1 + Math.floor(Math.random() * (drums.main.length - 1))], c: c.tgt.c };
    return c.tgt;
  }
  const active = new Set();
  // roll every flap once round, like a board resetting itself
  function rollAll() {
    const now = performance.now();
    for (const c of [...cells, ...clockCells]) {
      if (c.anim) continue;
      c.force = true; c.left = 3 + Math.floor(Math.random() * 5);
      c.wait = now + (c.row < 0 ? 0 : c.row * 60) + (c.type === 'char' ? c.x / W * 500 : Math.random() * 300);
      active.add(c);
    }
  }
  let lastRoll = Date.now();
  // "surprise me": another country (and, if chosen, another look or everything) at every refresh
  function randomize() {
    if (!S.random || S.random === 'off') return false;
    if (S.kind === 'ns') { const l = nsList().filter(x => x[0] !== S.nsStation); if (!l.length) return false; S.nsStation = l[Math.floor(Math.random() * l.length)][0]; NS.data = null; NS.at = 0; if (S.random !== 'country') S.theme = Object.keys(THEMES).filter(t => t !== S.theme)[Math.floor(Math.random() * 4)]; save(); active.clear(); layout(); nsLoad(true); if (panel.classList.contains('on')) fillPanel(); return true; }
    const other = (list, cur) => { const l = list.filter(x => x !== cur); return l[Math.floor(Math.random() * l.length)]; };
    S.country = other(COUNTRY_ORDER, S.country);
    if (S.random === 'look' || S.random === 'all') S.theme = other(Object.keys(THEMES), S.theme);
    if (S.random === 'all') {
      S.kind = Math.random() < .5 ? 'train' : 'air'; S.dir = Math.random() < .7 ? 'dep' : 'arr';
      S.lang = C().script === 'latin' ? (Math.random() < .75 ? 'local' : 'latin') : (Math.random() < .5 ? 'local' : Math.random() < .5 ? 'alt' : 'latin');
    }
    save(); lang = S.lang === 'latin' ? 'latin' : 'local'; altAt = Date.now();
    active.clear(); layout(); if (panel.classList.contains('on')) fillPanel();
    return true;
  }
  const refresh = () => { lastRoll = Date.now(); if (!randomize()) rollAll(); };
  let flipsThisFrame = 0;
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now(), dur = SPEED[S.speed];
    for (const c of active) {
      if (c.anim) {
        if (now - c.anim.t0 >= c.anim.dur) { c.cur = c.anim.to; c.anim = null; if (same(c.cur, c.tgt) && !c.force) { active.delete(c); drawCell(c, now); continue; } }
        else { drawCell(c, now); continue; }
      }
      if (now < c.wait) continue;
      if (S.wear !== 'off' && c.sticky && !c.hes && Math.random() < .2) { c.hes = true; c.wait = now + 250 + Math.random() * 800; continue; }   // a tired flap hesitates
      c.hes = false;
      if (same(c.cur, c.tgt) && !c.force) { active.delete(c); drawCell(c, now); continue; }
      c.anim = { from: c.cur, to: nextValue(c), t0: now, dur: dur * (c.type === 'word' ? 1.6 : 1) * (.85 + Math.random() * .3) };
      flipsThisFrame++; drawCell(c, now);
    }
    if (flipsThisFrame) { clack(flipsThisFrame); flipsThisFrame = 0; }
    if (S.wear !== 'off' && now - lampAt > 90) { lampAt = now; drawLamps(now); }
  }

  // ------------------------------------------------------------------ the sound of the flaps (synthesised)
  let actx = null, noise = null, lastClack = 0;
  function audio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return actx; }
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    noise = actx.createBuffer(1, actx.sampleRate * .05, actx.sampleRate); const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    return actx;
  }
  function clack(n) {
    if (!S.sound || !actx || actx.state !== 'running') return;
    const t = actx.currentTime; if (t - lastClack < .016) return; lastClack = t;
    const s = actx.createBufferSource(), f = actx.createBiquadFilter(), gn = actx.createGain();
    s.buffer = noise; s.playbackRate.value = .8 + Math.random() * .5; f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 1600; f.Q.value = 1.2;
    gn.gain.value = Math.min(.55, .06 + .05 * Math.sqrt(n));
    s.connect(f); f.connect(gn); gn.connect(actx.destination); s.start(t);
  }

  // ------------------------------------------------------------------ the clock and the timetable, every second
  let lastSig = '', altAt = 0;
  function update(force) {
    const now = Date.now(), d = new Date(now);
    if (S.rollS && now - lastRoll > S.rollS * 1e3) { refresh(); return; }
    const clk = digits(pad(d.getHours()) + ':' + pad(d.getMinutes()));
    clockCells.forEach((c, i) => target(c, { t: [...clk][i], c: 'title' }, i * 40));
    if (S.lang === 'alt' && now - altAt > S.altSec * 1000) {
      altAt = now; const was = lang; lang = lang === 'local' ? 'latin' : 'local';
      if ((lang === 'local' && SC().rtl) !== L.rtl || was === undefined) { layout(); return; }
      drawStatic(); for (const c of cells) if (!c.anim) drawCell(c, performance.now()); for (const c of clockCells) drawCell(c, performance.now());
      force = true;
    }
    const fields = S.kind === 'ns' ? nsRows(now, L.rows) : boardRows(now, L.rows).map(s => rowFields(s, now));
    if (S.kind === 'ns') nsLoad(false);
    const sig = JSON.stringify(fields) + lang;
    if (sig === lastSig && !force) return;
    const shifted = lastSig && JSON.parse(lastSig.slice(0, -lang.length) || '[]')[0]?.time !== fields[0]?.time;
    lastSig = sig;
    for (let r = 0; r < L.rows; r++) setRow(r, fields[r] || { time: '', num: '', place: '', plat: '', rem: '', kind: 'ok' }, true);
    void shifted;
  }

  // ------------------------------------------------------------------ fonts first, then start
  async function fontsReady() {
    if (!document.fonts) return;
    const sample = JSON.stringify(COUNTRIES) + JSON.stringify(EN);
    const fams = ['FlapLatin', 'FlapJP', 'FlapSC', 'FlapKR', 'FlapHe', 'FlapAr', 'FlapDeva', 'FlapThai'];
    await Promise.all(fams.map(f => document.fonts.load(`700 40px '${f}'`, sample).catch(() => { })));
  }

  // ------------------------------------------------------------------ the settings panel
  const $ = s => document.querySelector(s);
  const panel = $('#panel');
  function fillPanel() {
    $('#country').innerHTML = COUNTRY_ORDER.map(cc => { const c = COUNTRIES[cc]; return `<option value="${cc}">${c.flag} ${c.name}${c.native !== c.name ? ' · ' + c.native : ''}</option>`; }).join('');
    for (const k of ['kind', 'dir', 'country', 'lang', 'theme', 'speed', 'rows', 'altSec', 'orient', 'rollS', 'random', 'nsStation', 'wear', 'frame']) { const el = $('#' + k); if (el) el.value = String(S[k]); }
    for (const k of ['sound', 'colour', 'caps']) $('#' + k).checked = S[k];
    const scName = { latin: 'Latin', cyrillic: 'Cyrillic', greek: 'Greek', hebrew: 'Hebrew', arabic: 'Arabic', devanagari: 'Devanagari', thai: 'Thai', 'han-sc': 'Chinese characters', 'han-jp': 'Japanese (kanji and kana)', hangul: 'Hangul' }[C().script];
    $('#langLocal').textContent = isLatinCountry() ? `${C().native} (local language)` : `${scName} (${C().native})`;
    $('#langLatin').textContent = isLatinCountry() ? 'English' : 'Latin letters (English)';
    $('#altRow').hidden = S.lang !== 'alt';
    const ns = S.kind === 'ns'; $('#nsBox').hidden = !ns; $('#countryRow').hidden = ns;
    if (ns) {
      $('#langLocal').textContent = 'Nederlands'; $('#langLatin').textContent = 'English';
      const l = nsList(); $('#nsStation').innerHTML = l.map(([c, n]) => `<option value="${c}">${n}</option>`).join(''); $('#nsStation').value = S.nsStation;
      $('#nsKey').value = S.nsKey; $('#nsState').textContent = !S.nsKey ? 'No key yet.' : NS.err === 'key' ? 'NS did not accept this key.' : NS.err === 'blocked' ? (NS_LOCAL ? 'No connection to NS.' : 'This browser may not ask NS directly: live NS works in the Android app and the screensavers.') : NS.err ? 'No connection to NS.' : NS.data ? `Live: ${NS.data.length} trains, updated ${hhmm(NS.at)}.` : 'Loading…';
    }
    $('#orientRow').hidden = !window.FlapApp;
  }
  function apply(k, v) {
    S[k] = v; save();
    if (k === 'orient' && window.FlapApp) window.FlapApp.setOrientation(v);
    lang = S.lang === 'latin' ? 'latin' : 'local'; altAt = Date.now();
    for (const c of [...cells, ...clockCells]) { c.anim = null; }
    active.clear(); fillPanel(); layout();
  }
  document.addEventListener('change', e => {
    const el = e.target; if (!el.id || !(el.id in S)) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.id === 'nsKey') return;
    if (el.id === 'rows' || el.id === 'altSec' || el.id === 'rollS') v = +v;
    if (el.id === 'rollS' || el.id === 'random') { S[el.id] = v; save(); lastRoll = Date.now(); return; }
    if (el.id === 'kind' && v === 'ns') { S.country = 'nl'; NS.data = null; NS.err = ''; nsStations().then(fillPanel); }
    if (el.id === 'nsStation') { NS.data = null; NS.at = 0; }
    if (el.id === 'dir' || el.id === 'lang') NS.at = 0;
    apply(el.id, v);
  });
  $('#rollNow').onclick = () => { audio(); hidePanel(); refresh(); };
  $('#nsSave').onclick = () => { S.nsKey = $('#nsKey').value.trim(); save(); NS.err = ''; NS.data = null; NS.at = 0; nsStations(true).then(() => { fillPanel(); layout(); }); nsLoad(true).then(fillPanel); };
  let hideT = 0;
  function showPanel() { panel.classList.add('on'); fillPanel(); clearTimeout(hideT); }
  function hidePanel() { panel.classList.remove('on'); }
  const Q = new URLSearchParams(location.search), SAVER = Q.has('saver'), SETUP = Q.has('settings');
  if (SAVER) document.body.classList.add('saver');
  cv.addEventListener('click', () => { if (SAVER) return; audio(); panel.classList.contains('on') ? hidePanel() : showPanel(); $('#hint').classList.add('gone'); });
  $('#close').onclick = hidePanel;
  $('#full').onclick = () => { const d = document.documentElement; if (!document.fullscreenElement) (d.requestFullscreen || d.webkitRequestFullscreen || (() => { })).call(d); else document.exitFullscreen(); };
  if (window.FlapApp) $('#full').hidden = true;
  window.__terug = () => { if (panel.classList.contains('on')) { hidePanel(); return true; } return false; };
  let wake = null;
  async function keepAwake() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => wake = null); } } catch (e) { } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { keepAwake(); lastSig = ''; } });
  document.addEventListener('pointerdown', () => { audio(); keepAwake(); }, { once: true });
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 150); });

  (async () => {
    lang = S.lang === 'latin' ? 'latin' : 'local'; altAt = Date.now();
    await fontsReady();
    if (window.FlapApp && S.orient) window.FlapApp.setOrientation(S.orient);
    if (S.kind === 'ns') { S.country = 'nl'; await nsStations(); }
    layout(); fillPanel(); requestAnimationFrame(frame);
    if (SAVER) randomize();
    setInterval(() => update(false), 1000);
    setTimeout(() => $('#hint').classList.add('gone'), 6000);
    if (SAVER) { $('#hint').classList.add('gone'); audio(); lastRoll = Date.now(); }
    if (SETUP) showPanel();
  })();
  window.FLAP = { S, apply, rollAll, refresh, drums: () => drums, update: () => { lastSig = ''; update(true); }, get L() { return L; }, rowFields, boardRows, settle() { const now = performance.now(); for (const c of [...active]) { c.cur = c.tgt; c.anim = null; active.delete(c); } drawAll(); void now; } };
})();
