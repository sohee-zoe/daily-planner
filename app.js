'use strict';

/* ================= constants ================= */
const STORE_KEY = 'planner.v1';
const COLORS = ['#e8655a', '#f29a4a', '#f2c84b', '#6cc070', '#4bb3c8', '#5b8def', '#9a7bea', '#e57bb5', '#8a8780'];
const EMOJIS = ['✅','☀️','🌙','☕','🍳','🥗','🍽️','💼','💻','📧','📞','📚','✏️','🧠','🏃','🏋️','🧘','🚶','🚴','🛒','🧹','🧺','🚿','🛏️','💊','🦷','🚗','🚌','✈️','🎯','📝','🎨','🎸','🎮','📺','👨‍👩‍👧','🐶','🌱','💰','🎉','❤️','⭐'];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DONE_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/* ================= date helpers ================= */
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const todayKey = () => keyOf(new Date());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const fmtTime = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const parseTime = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
function fmtDur(m) {
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r}분`;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
}
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
const isDateKey = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));
const normalizeAll = list => (Array.isArray(list) ? list.filter(isObj).map(normalize) : []);

/* ================= state & storage ================= */
let loadFailed = false;
let db = load();
let sel = todayKey();
let view = 'dayView';

function load() {
  loadFailed = false;
  const fallback = { tasks: [], settings: { theme: 'system', weekStart: 1, notify: false, customIcons: [], customColors: [] } };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return seed(fallback);
    const data = JSON.parse(raw);
    const settings = { ...fallback.settings, ...data.settings };
    settings.customIcons = Array.isArray(settings.customIcons) ? settings.customIcons.filter(x => typeof x === 'string') : [];
    settings.customColors = Array.isArray(settings.customColors) ? settings.customColors.filter(isColor) : [];
    return { tasks: normalizeAll(data.tasks), settings };
  } catch {
    loadFailed = true;
    try { localStorage.setItem(STORE_KEY + '.bak', localStorage.getItem(STORE_KEY)); } catch { /* storage unavailable */ }
    return fallback;
  }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch { toast('저장 공간에 쓸 수 없어요 (비공개 모드?)'); }
}
function normalize(t) {
  return {
    id: String(t.id || uid()), title: String(t.title || '할 일'), icon: String(t.icon || '✅'), color: isColor(t.color) ? t.color : COLORS[0],
    date: isDateKey(t.date) ? t.date : null, start: Number.isFinite(t.start) ? clampInt(t.start, 0, 1439) : null,
    duration: Number.isFinite(t.duration) ? clampInt(t.duration, 0, 1440) : 30,
    repeat: ['none', 'daily', 'weekdays', 'weekly', 'days', 'monthly'].includes(t.repeat) ? t.repeat : 'none',
    repeatDays: Array.isArray(t.repeatDays) ? [...new Set(t.repeatDays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [],
    exceptions: Array.isArray(t.exceptions) ? t.exceptions.filter(isDateKey) : [],
    done: isObj(t.done) ? t.done : {},
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.filter(isObj).map(x => ({ id: String(x.id || uid()), title: String(x.title || ''), done: !!x.done })) : [],
    notes: String(t.notes || ''), createdAt: Number.isFinite(t.createdAt) ? t.createdAt : Date.now(),
    seriesId: t.seriesId ? String(t.seriesId) : null, seriesDate: isDateKey(t.seriesDate) ? t.seriesDate : null,
  };
}
function seed(base) {
  const k = todayKey();
  base.tasks = [
    { title: '기상', icon: '☀️', color: COLORS[2], date: k, start: 7 * 60, duration: 0, repeat: 'daily' },
    { title: '집중 업무', icon: '💻', color: COLORS[5], date: k, start: 9 * 60, duration: 120 },
    { title: '점심', icon: '🍽️', color: COLORS[1], date: k, start: 12 * 60 + 30, duration: 60 },
    { title: '운동', icon: '🏃', color: COLORS[3], date: k, start: 18 * 60 + 30, duration: 45 },
    { title: '취침', icon: '🌙', color: COLORS[6], date: k, start: 23 * 60, duration: 0, repeat: 'daily' },
    { title: '장보기 목록 정리', icon: '🛒', color: COLORS[7], date: null, start: null, duration: 15 },
  ].map(normalize);
  return base;
}

/* ================= recurrence ================= */
function occursOn(t, k) {
  if (!t.date || k < t.date || t.exceptions.includes(k)) return false;
  if (t.repeat === 'none') return k === t.date;
  const d = parseKey(k), s = parseKey(t.date);
  switch (t.repeat) {
    case 'daily': return true;
    case 'weekdays': return d.getDay() >= 1 && d.getDay() <= 5;
    case 'weekly': return d.getDay() === s.getDay();
    case 'days': return t.repeatDays.includes(d.getDay());
    case 'monthly': return d.getDate() === Math.min(s.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
  }
  return false;
}
const doneKey = (t, k) => (t.date ? k : 'inbox');
const isDone = (t, k) => !!t.done[doneKey(t, k)];
const tasksOn = k => db.tasks.filter(t => occursOn(t, k));
const liveTask = t => t && db.tasks.find(x => x.id === t.id);
const seriesOf = t => t.seriesId && db.tasks.find(x => x.id === t.seriesId && x.exceptions.includes(t.seriesDate));
const isRecurringEdit = () => editing && editing.repeat !== 'none' && editingFromDate;

/* ================= tiny DOM helper ================= */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [a, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (a === 'class') el.className = v;
    else if (a === 'style') el.style.cssText = v;
    else if (a === 'html') el.innerHTML = v;
    else if (a.startsWith('on')) el.addEventListener(a.slice(2), v);
    else el.setAttribute(a, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k);
  return el;
}
const $ = id => document.getElementById(id);

function checkBtn(on, color, onclick, label) {
  return h('button', {
    class: 'check' + (on ? ' on' : ''), style: `--c:${color}`, html: DONE_SVG,
    'aria-label': label, 'aria-pressed': String(on), onclick,
  });
}

/* ================= rendering ================= */
function render() {
  applyTheme();
  renderHeader();
  renderWeek();
  renderDay();
  renderInbox();
  scheduleNotifications();
}

function renderHeader() {
  const d = parseKey(sel);
  $('monthLabel').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  $('todayBtn').hidden = sel === todayKey() && view === 'dayView';
}

function renderWeek() {
  const wk = $('week');
  wk.replaceChildren();
  const d = parseKey(sel);
  const offset = (d.getDay() - db.settings.weekStart + 7) % 7;
  const start = addDays(sel, -offset);
  const tk = todayKey();
  for (let i = 0; i < 7; i++) {
    const k = addDays(start, i);
    const dd = parseKey(k);
    const colors = tasksOn(k).sort((a, b) => (a.start ?? -1) - (b.start ?? -1)).slice(0, 3).map(t => t.color);
    wk.append(h('button', {
      class: 'day' + (k === sel ? ' sel' : '') + (k === tk ? ' today' : ''),
      'aria-label': `${dd.getMonth() + 1}월 ${dd.getDate()}일`,
      onclick: () => { sel = k; showView('dayView'); },
    },
      WEEKDAYS[dd.getDay()],
      h('b', {}, String(dd.getDate())),
      h('span', { class: 'dots' }, colors.map(c => h('i', { style: `background:${c}` }))),
    ));
  }
}

function pillHeight(dur) { return Math.min(46 + Math.max(0, dur - 15) * 0.9, 240); }

function renderDay() {
  const list = tasksOn(sel);
  const allDay = list.filter(t => t.start == null);
  const timed = list.filter(t => t.start != null).sort((a, b) => a.start - b.start || a.duration - b.duration);

  // progress
  const total = list.length, done = list.filter(t => isDone(t, sel)).length;
  $('progress').replaceChildren(...(total ? [
    h('span', {}, `${done}/${total} 완료`),
    h('span', { class: 'bar' }, h('i', { style: `width:${(done / total) * 100}%` })),
  ] : []));

  // all-day chips
  $('allDay').replaceChildren(...allDay.map(t => h('div', { class: 'ad-item' + (isDone(t, sel) ? ' done' : ''), style: `--c:${t.color}` },
    checkBtn(isDone(t, sel), t.color, () => toggleDone(t), '완료 표시'),
    h('span', { class: 't', onclick: () => openEditor(t), role: 'button', tabindex: '0' }, `${t.icon} ${t.title}`),
  )));

  const tl = $('timeline');
  tl.replaceChildren();
  if (!timed.length) {
    tl.append(h('li', { class: 'empty' },
      h('div', { class: 'big' }, '🗓️'),
      h('p', {}, allDay.length ? '시간이 정해진 일정이 없어요.' : '아직 계획이 없어요.'),
      h('button', { class: 'chip', onclick: () => openEditor(null, { date: sel, start: suggestStart() }) }, '+ 일정 추가'),
    ));
    return;
  }

  const isToday = sel === todayKey();
  const now = nowMin();
  let nowPlaced = !isToday;
  const nowRow = () => h('li', { class: 'now', 'aria-label': '현재 시각' },
    h('span', { class: 'time' }, fmtTime(now)), h('span', { class: 'dot' }), h('span', { class: 'ln' }));

  let prevEnd = null;
  timed.forEach((t, i) => {
    const end = t.start + t.duration;
    if (prevEnd != null) {
      const gap = t.start - prevEnd;
      if (!nowPlaced && now < t.start) { tl.append(nowRow()); nowPlaced = true; }
      if (gap >= 15) {
        const gs = prevEnd;
        tl.append(h('li', { class: 'gap' }, h('span'), h('span', { class: 'rail' }),
          h('span', { class: 'txt' }, `${fmtDur(gap)} 여유`,
            h('button', { onclick: () => openEditor(null, { date: sel, start: gs, duration: Math.min(gap, 60) }) }, '+ 추가'))));
      }
    } else if (!nowPlaced && now < t.start) { tl.append(nowRow()); nowPlaced = true; }

    const overlap = prevEnd != null && t.start < prevEnd;
    const dn = isDone(t, sel);
    const subDone = t.subtasks.filter(s => s.done).length;
    tl.append(h('li', {
      class: 'ti' + (dn ? ' done' : '') + (i === 0 ? ' first' : '') + (i === timed.length - 1 ? ' last' : ''),
      style: `--c:${t.color}`,
    },
      h('span', { class: 'time' }, fmtTime(t.start)),
      h('span', { class: 'rail' }, h('span', { class: 'pill', style: `height:${pillHeight(t.duration)}px` }, t.icon)),
      h('div', { class: 'body', role: 'button', tabindex: '0', onclick: () => openEditor(t), onkeydown: e => e.key === 'Enter' && openEditor(t) },
        h('div', { class: 'range' }, t.duration ? `${fmtTime(t.start)} – ${fmtTime(end)} (${fmtDur(t.duration)})` : fmtTime(t.start)),
        h('div', { class: 'title' }, t.title),
        h('div', { class: 'meta' },
          t.repeat !== 'none' && h('span', {}, '🔁 ' + repeatLabel(t)),
          seriesOf(t) && h('span', {}, '🔁 변경됨'),
          t.subtasks.length > 0 && h('span', {}, `☑︎ ${subDone}/${t.subtasks.length}`),
          t.notes && h('span', {}, '📝'),
          overlap && h('span', { class: 'warn' }, '⚠︎ 겹침'),
        ),
      ),
      checkBtn(dn, t.color, () => toggleDone(t), `${t.title} 완료 표시`),
    ));
    prevEnd = Math.max(prevEnd ?? 0, end);
  });
  if (!nowPlaced) tl.append(nowRow());
}

function renderInbox() {
  const items = db.tasks.filter(t => !t.date).sort((a, b) => isDone(a) - isDone(b) || b.createdAt - a.createdAt);
  const open = items.filter(t => !isDone(t)).length;
  $('inboxCount').hidden = !open;
  $('inboxCount').textContent = open;
  const ul = $('inboxList');
  if (!items.length) {
    ul.replaceChildren(h('li', { class: 'empty' }, h('div', { class: 'big' }, '📥'), h('p', {}, '인박스가 비어 있어요.')));
    return;
  }
  ul.replaceChildren(...items.map(t => h('li', { class: 'inbox-item' + (isDone(t) ? ' done' : ''), style: `--c:${t.color}` },
    h('span', { class: 'ic' }, t.icon),
    h('div', { class: 't', role: 'button', tabindex: '0', onclick: () => openEditor(t) },
      h('div', {}, t.title),
      h('div', { class: 'muted small' }, fmtDur(t.duration) + (t.subtasks.length ? ` · ☑︎ ${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}` : '')),
    ),
    checkBtn(isDone(t), t.color, () => toggleDone(t), `${t.title} 완료 표시`),
  )));
}

const weekOrder = () => [0, 1, 2, 3, 4, 5, 6].map(i => (i + db.settings.weekStart) % 7);
const repeatLabel = t => t.repeat === 'days'
  ? '매주 ' + weekOrder().filter(d => t.repeatDays.includes(d)).map(d => WEEKDAYS[d]).join('·')
  : ({ daily: '매일', weekdays: '평일', weekly: '매주', monthly: '매월' }[t.repeat] || '');
const defaultRepeatDays = () => [parseKey($('fDate').value || sel).getDay()];

function suggestStart() {
  // first 30-minute free slot from now (today) or 09:00 (other days)
  const timed = tasksOn(sel).filter(t => t.start != null).sort((a, b) => a.start - b.start);
  let base = sel === todayKey() ? Math.ceil(nowMin() / 15) * 15 : 9 * 60;
  for (const t of timed) {
    if (t.start < base + 30 && t.start + t.duration > base) base = t.start + t.duration;
  }
  return Math.min(base, 23 * 60 + 45);
}

/* ================= actions ================= */
function toggleDone(t) {
  const k = doneKey(t, sel);
  if (t.done[k]) delete t.done[k]; else t.done[k] = true;
  if (t.done[k] && navigator.vibrate) navigator.vibrate(10);
  save(); render();
}

function showView(v) {
  view = v;
  for (const s of document.querySelectorAll('.view')) s.hidden = s.id !== v;
  for (const b of document.querySelectorAll('.tab')) b.classList.toggle('active', b.dataset.view === v);
  render();
  window.scrollTo({ top: 0 });
}

let toastTimer;
function toast(msg, actionLabel, action) {
  const el = $('toast');
  el.replaceChildren(h('span', {}, msg), ...(actionLabel ? [h('button', { onclick: () => { action(); el.classList.remove('show'); } }, actionLabel)] : []));
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

function ask(msg, buttons) {
  return new Promise(resolve => {
    const dlg = $('confirm');
    $('confirmMsg').textContent = msg;
    $('confirmActions').replaceChildren(...buttons.map(b =>
      h('button', { class: b.danger ? 'danger-txt' : '', value: b.value }, b.label)),
      h('button', { value: 'cancel' }, '취소'));
    dlg.onclose = () => resolve(dlg.returnValue || 'cancel');
    dlg.returnValue = '';
    dlg.showModal();
  });
}

/* ================= editor ================= */
let draft = null, editing = null, editingFromDate = null;

function openEditor(task, preset = {}) {
  editing = task;
  editingFromDate = task && task.date ? sel : null;
  draft = task ? clone(task) : normalize({
    title: '', icon: '✅', color: COLORS[0], date: sel, start: suggestStart(), duration: 30, ...preset,
  });
  draft.when = !draft.date ? 'inbox' : draft.start == null ? 'allday' : 'timed';
  if (draft.start == null) draft._start = suggestStart();

  $('editorTitle').textContent = task ? '할 일 편집' : '새 할 일';
  $('fTitle').value = draft.title;
  $('fDate').value = isRecurringEdit() ? sel : draft.date || sel;
  $('fStart').value = fmtTime(draft.start ?? draft._start);
  $('fRepeat').value = draft.repeat;
  $('fNotes').value = draft.notes;
  $('emojiGrid').hidden = true;
  $('deleteBtn').hidden = !task;
  paintEditor();
  $('editor').showModal();
  if (!task) setTimeout(() => $('fTitle').focus(), 50);
}

function paintEditor() {
  const ip = $('iconPickBtn');
  ip.textContent = draft.icon;
  ip.style.setProperty('--c', draft.color);

  const { customIcons, customColors } = db.settings;
  $('emojiGrid').replaceChildren(
    ...[...customIcons, ...EMOJIS.filter(e => !customIcons.includes(e))].map(e => h('button', {
      type: 'button', class: e === draft.icon ? 'on' : '', onclick: () => { draft.icon = e; $('emojiGrid').hidden = true; paintEditor(); },
    }, e)),
    h('input', {
      class: 'emoji-add', placeholder: '+ 직접', maxlength: '16', 'aria-label': '아이콘 직접 입력 (이모지 또는 글자)',
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } },
      onchange: e => addCustomIcon(e.target.value),
    }),
  );

  $('colorRow').replaceChildren(
    ...[...COLORS, ...customColors].map(c => h('button', {
      type: 'button', class: c === draft.color ? 'on' : '', style: `--c:${c}`, 'aria-label': `색상 ${c}`,
      onclick: () => { draft.color = c; paintEditor(); },
    })),
    h('label', { class: 'color-add', 'aria-label': '색상 추가' }, '+',
      h('input', { type: 'color', value: draft.color, onchange: e => addCustomColor(e.target.value) })),
  );

  for (const b of $('whenSeg').children) b.classList.toggle('on', b.dataset.when === draft.when);
  $('dateField').hidden = draft.when === 'inbox';
  $('timeField').hidden = draft.when !== 'timed';
  $('repeatField').hidden = draft.when === 'inbox';
  $('daysField').hidden = draft.when === 'inbox' || draft.repeat !== 'days';
  $('dayChips').replaceChildren(...weekOrder().map(d => h('button', {
    type: 'button', class: draft.repeatDays.includes(d) ? 'on' : '', 'aria-pressed': String(draft.repeatDays.includes(d)),
    onclick: () => {
      const on = draft.repeatDays.includes(d);
      if (on && draft.repeatDays.length === 1) return;
      draft.repeatDays = on ? draft.repeatDays.filter(x => x !== d) : [...draft.repeatDays, d].sort();
      paintEditor();
    },
  }, WEEKDAYS[d])));
  $('durField').hidden = draft.when === 'allday';

  const custom = !DURATIONS.includes(draft.duration);
  $('durLabel').textContent = draft.duration ? fmtDur(draft.duration) : '시점만 표시';
  $('durChips').replaceChildren(
    h('button', { type: 'button', class: draft.duration === 0 ? 'on' : '', onclick: () => { draft.duration = 0; paintEditor(); } }, '없음'),
    ...DURATIONS.map(m => h('button', { type: 'button', class: draft.duration === m ? 'on' : '', onclick: () => { draft.duration = m; paintEditor(); } }, fmtDur(m))),
    h('input', {
      type: 'number', min: '0', max: '1440', step: '5', inputmode: 'numeric', placeholder: '분',
      value: custom && draft.duration ? String(draft.duration) : '', 'aria-label': '직접 입력 (분)',
      onchange: e => { const v = Math.max(0, Math.min(1440, Math.round(+e.target.value || 0))); draft.duration = v; paintEditor(); },
    }),
  );

  $('subList').replaceChildren(...draft.subtasks.map(s => h('li', { class: s.done ? 'done' : '' },
    checkBtn(s.done, draft.color, () => { s.done = !s.done; paintEditor(); }, '하위 작업 완료'),
    h('span', {}, s.title),
    h('button', { type: 'button', class: 'x', 'aria-label': '하위 작업 삭제', onclick: () => { draft.subtasks = draft.subtasks.filter(x => x !== s); paintEditor(); } }, '×'),
  )));
}

function addCustomIcon(v) {
  const icon = [...new Intl.Segmenter().segment(v.trim())][0]?.segment;
  if (!icon) return;
  const list = db.settings.customIcons;
  if (!EMOJIS.includes(icon)) db.settings.customIcons = [icon, ...list.filter(x => x !== icon)].slice(0, 30);
  save();
  draft.icon = icon;
  $('emojiGrid').hidden = true;
  paintEditor();
}

function addCustomColor(c) {
  c = c.toLowerCase();
  if (!COLORS.includes(c) && !db.settings.customColors.includes(c)) db.settings.customColors.push(c);
  save();
  draft.color = c;
  paintEditor();
}

function addSubtask() {
  const v = $('subInput').value.trim();
  if (!v) return;
  draft.subtasks.push({ id: uid(), title: v, done: false });
  $('subInput').value = '';
  paintEditor();
}

async function commitEditor() {
  const title = $('fTitle').value.trim();
  if (!title) { $('fTitle').focus(); return false; }
  const sameRepeat = $('fRepeat').value === editing?.repeat
    && (editing.repeat !== 'days' || String(draft.repeatDays) === String(editing.repeatDays));
  let scope = 'all';
  if (isRecurringEdit() && draft.when !== 'inbox' && sameRepeat) {
    scope = await ask('반복 일정입니다. 어디에 적용할까요?', [
      { label: '이 날만', value: 'one' },
      { label: '모든 반복', value: 'all' },
    ]);
    if (scope === 'cancel') return false;
  }
  if (editing) {
    editing = liveTask(editing) || editing;
    if (!db.tasks.includes(editing)) db.tasks.push(editing);
  }
  draft.title = title;
  draft.notes = $('fNotes').value.trim();
  if (draft.when === 'inbox') {
    // completion state belongs to a date once scheduled; keep only the inbox flag
    if (editing?.date) draft.done = {};
    draft.date = null; draft.start = null; draft.repeat = 'none'; draft.repeatDays = [];
  } else {
    if (!editing?.date && editing) draft.done = {}; // moving out of inbox
    const keepSeriesDate = isRecurringEdit() && scope === 'all' && $('fRepeat').value !== 'none';
    draft.date = keepSeriesDate ? editing.date : $('fDate').value || sel;
    draft.start = draft.when === 'timed' ? parseTime($('fStart').value || '09:00') : null;
    draft.repeat = $('fRepeat').value;
    draft.repeatDays = draft.repeat === 'days' ? (draft.repeatDays.length ? draft.repeatDays : defaultRepeatDays()) : [];
    if (draft.when === 'allday') draft.duration = draft.duration || 0;
  }
  const { when, _start, ...clean } = draft;
  if (scope === 'one') {
    const from = editingFromDate;
    const t = normalize({
      ...clean, id: uid(), repeat: 'none', repeatDays: [], exceptions: [], createdAt: Date.now(),
      done: editing.done[from] ? { [clean.date]: true } : {},
      subtasks: clean.subtasks.map(x => ({ ...x, id: uid() })),
      seriesId: editing.id, seriesDate: from,
    });
    if (!editing.exceptions.includes(from)) editing.exceptions.push(from);
    delete editing.done[from];
    db.tasks.push(t);
    sel = t.date;
    save();
    return true;
  }
  const t = normalize(clean);
  if (editing) Object.assign(editing, t); else db.tasks.push(t);
  if (t.date && t.repeat === 'none') sel = t.date;
  save();
  return true;
}

async function deleteCurrent() {
  let t = editing;
  if (!t) return;
  const from = editingFromDate;
  let choice = 'all';
  if (t.repeat !== 'none' && editingFromDate) {
    $('editor').close();
    choice = await ask('반복 일정입니다. 어떻게 삭제할까요?', [
      { label: '이 날만 삭제', value: 'one', danger: true },
      { label: '모든 반복 삭제', value: 'all', danger: true },
    ]);
    if (choice === 'cancel') return;
  } else if (seriesOf(t)) {
    $('editor').close();
    choice = await ask('반복 일정에서 바꾼 날입니다.', [
      { label: '반복 일정으로 되돌리기', value: 'restore' },
      { label: '이 날 삭제', value: 'all', danger: true },
    ]);
    if (choice === 'cancel') return;
  } else {
    $('editor').close();
  }
  t = liveTask(t);
  if (!t) { render(); return; }
  const idx = db.tasks.indexOf(t);
  const series = choice === 'restore' && seriesOf(t);
  if (choice === 'one') { if (!t.exceptions.includes(from)) t.exceptions.push(from); }
  else {
    if (series) series.exceptions = series.exceptions.filter(k => k !== t.seriesDate);
    db.tasks.splice(idx, 1);
  }
  save(); render();
  const undo = () => {
    if (choice === 'one') {
      const x = liveTask(t);
      if (x) x.exceptions = x.exceptions.filter(k => k !== from);
    } else {
      if (!liveTask(t)) db.tasks.splice(Math.min(idx, db.tasks.length), 0, t);
      const s = series && liveTask(series);
      if (s && !s.exceptions.includes(t.seriesDate)) s.exceptions.push(t.seriesDate);
    }
    save(); render();
  };
  toast(choice === 'restore' ? '반복 일정으로 되돌렸어요' : '삭제했어요', '되돌리기', undo);
}

/* ================= notifications (while open) ================= */
let notifTimers = [];
function scheduleNotifications() {
  notifTimers.forEach(clearTimeout);
  notifTimers = [];
  if (!db.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const k = todayKey(), now = new Date();
  for (const t of tasksOn(k)) {
    if (t.start == null || isDone(t, k)) continue;
    const at = parseKey(k); at.setMinutes(t.start);
    const ms = at - now;
    if (ms <= 0 || ms > 864e5) continue;
    notifTimers.push(setTimeout(() => notify(`${t.icon} ${t.title}`, `${fmtTime(t.start)} 시작${t.duration ? ` · ${fmtDur(t.duration)}` : ''}`), ms));
  }
}
async function notify(title, body) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: title });
    else new Notification(title, { body });
  } catch { /* notification unsupported here */ }
}

/* ================= settings ================= */
function applyTheme() {
  const t = db.settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

function openSettings() {
  $('sTheme').value = db.settings.theme;
  $('sWeekStart').value = String(db.settings.weekStart);
  $('sNotify').checked = !!db.settings.notify;
  paintCustom();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $('installHint').textContent = standalone ? '홈 화면 앱으로 실행 중입니다.'
    : ios ? '설치: Safari 하단 공유 버튼 → "홈 화면에 추가"'
    : deferredInstall ? '' : '설치: 브라우저 메뉴 → "앱 설치" 또는 "홈 화면에 추가"';
  if (deferredInstall && !standalone) {
    $('installHint').replaceChildren(h('button', { type: 'button', class: 'chip', onclick: async () => {
      deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('settings').close();
    } }, '📲 앱으로 설치'));
  }
  $('settings').showModal();
}

function paintCustom() {
  const { customIcons, customColors } = db.settings;
  $('customField').hidden = !customIcons.length && !customColors.length;
  const remove = (key, v) => { db.settings[key] = db.settings[key].filter(x => x !== v); save(); paintCustom(); };
  $('customList').replaceChildren(
    ...customIcons.map(e => h('button', { type: 'button', class: 'custom-item', 'aria-label': `${e} 삭제`, onclick: () => remove('customIcons', e) }, e, h('b', {}, '×'))),
    ...customColors.map(c => h('button', { type: 'button', class: 'custom-item', 'aria-label': `색상 ${c} 삭제`, onclick: () => remove('customColors', c) },
      h('i', { style: `background:${c}` }), h('b', {}, '×'))),
  );
}

function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `planner-${todayKey()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.tasks)) throw new Error('형식 오류');
    const choice = await ask(`할 일 ${data.tasks.length}개를 가져옵니다.`, [
      { label: '기존 데이터에 합치기', value: 'merge' },
      { label: '기존 데이터 교체', value: 'replace', danger: true },
    ]);
    if (choice === 'cancel') return;
    const incoming = normalizeAll(data.tasks);
    if (choice === 'replace') db.tasks = incoming;
    else {
      const ids = new Set(db.tasks.map(t => t.id));
      db.tasks.push(...incoming.filter(t => !ids.has(t.id)));
    }
    save(); render(); toast('가져오기 완료');
  } catch { toast('가져올 수 없는 파일이에요'); }
}

/* ================= swipe ================= */
function swipe(el, onLeft, onRight) {
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onLeft : onRight)();
  }, { passive: true });
}

/* ================= wiring ================= */
let deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });

$('todayBtn').onclick = () => { sel = todayKey(); showView('dayView'); };
$('monthLabel').onclick = () => {
  const inp = $('jumpDate');
  inp.value = sel;
  try { inp.showPicker(); } catch { inp.focus(); inp.click(); }
};
$('jumpDate').onchange = e => { if (e.target.value) { sel = e.target.value; showView('dayView'); } };
$('addBtn').onclick = () => openEditor(null, view === 'inboxView' ? { date: null, start: null } : {});
$('settingsBtn').onclick = openSettings;
for (const b of document.querySelectorAll('.tab')) b.onclick = () => showView(b.dataset.view);

$('iconPickBtn').onclick = () => { $('emojiGrid').hidden = !$('emojiGrid').hidden; };
$('whenSeg').onclick = e => {
  const w = e.target.closest('button')?.dataset.when;
  if (!w) return;
  draft.when = w;
  paintEditor();
};
$('fRepeat').onchange = e => {
  draft.repeat = e.target.value;
  if (draft.repeat === 'days' && !draft.repeatDays.length) draft.repeatDays = defaultRepeatDays();
  paintEditor();
};
$('subAddBtn').onclick = addSubtask;
$('subInput').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } };
$('cancelEdit').onclick = () => $('editor').close();
$('editorForm').onsubmit = async e => {
  e.preventDefault();
  if (await commitEditor()) { $('editor').close(); render(); }
};
$('deleteBtn').onclick = deleteCurrent;

$('sTheme').onchange = e => { db.settings.theme = e.target.value; save(); applyTheme(); };
$('sWeekStart').onchange = e => { db.settings.weekStart = +e.target.value; save(); render(); };
$('sNotify').onchange = async e => {
  if (e.target.checked) {
    if (!('Notification' in window)) { e.target.checked = false; toast('이 브라우저는 알림을 지원하지 않아요'); return; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { e.target.checked = false; toast('알림 권한이 거부되었어요'); return; }
  }
  db.settings.notify = e.target.checked; save(); scheduleNotifications();
};
$('exportBtn').onclick = exportData;
$('importFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) { $('settings').close(); importData(f); } };

// close sheets by tapping the backdrop
for (const d of document.querySelectorAll('dialog.sheet')) {
  let downOnBackdrop = false;
  d.addEventListener('pointerdown', e => { downOnBackdrop = e.target === d; });
  d.addEventListener('click', e => { if (e.target === d && downOnBackdrop) d.close(); });
}

swipe($('week'), () => { sel = addDays(sel, 7); render(); }, () => { sel = addDays(sel, -7); render(); });
swipe($('dayView'), () => { sel = addDays(sel, 1); render(); }, () => { sel = addDays(sel, -1); render(); });

// keep "now" line and day rollover fresh
let lastToday = todayKey();
setInterval(() => {
  const tk = todayKey();
  if (tk !== lastToday) { if (sel === lastToday) sel = tk; lastToday = tk; render(); }
  else if (sel === tk && view === 'dayView' && !document.querySelector('dialog[open]')) renderDay();
}, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('dialog[open]')) render(); });

// sync between tabs
addEventListener('storage', e => {
  if (e.key !== STORE_KEY) return;
  const next = load();
  if (!loadFailed) { db = next; render(); }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (loadFailed) toast('저장된 데이터를 읽지 못해 백업해 두었어요 (planner.v1.bak)');
else save();
render();
