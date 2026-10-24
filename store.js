// 只存在訪客自己瀏覽器的小資料：收藏、上次造訪看過哪些項目。
// 無痕模式、封鎖網站資料時 localStorage 可能丟錯或是空的，所以每次讀寫都包 try/catch，失敗就當沒有。
const PREFIX = 'cwpi:';

export function read(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
export function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
function sessionFlag(key) {
  try {
    if (sessionStorage.getItem(PREFIX + key)) return true;
    sessionStorage.setItem(PREFIX + key, '1');
  } catch { /* 無法使用 sessionStorage 時，每次載入都視為新的一次造訪 */ }
  return false;
}

// ---------- 收藏：key 形如 "i:<施政項目 id>"、"p:<政見 id>" ----------
const listeners = new Set();
export const favs = {
  all: () => read('favs', []),
  has: (k) => read('favs', []).includes(k),
  toggle(k) {
    const list = read('favs', []);
    const i = list.indexOf(k);
    if (i >= 0) list.splice(i, 1); else list.unshift(k);
    write('favs', list);
    listeners.forEach((fn) => fn(list));
    return i < 0;
  },
  add(keys) {
    const list = read('favs', []);
    keys.forEach((k) => { if (!list.includes(k)) list.push(k); });
    write('favs', list);
    listeners.forEach((fn) => fn(list));
  },
  onChange: (fn) => listeners.add(fn),
};

// ---------- 上次造訪：比對「上一次造訪時看到的項目與狀態」，找出新增與狀態更新 ----------
// 同一次造訪內重新整理不會把比較基準洗掉：只有新的一次造訪（新分頁工作階段）才把基準往前推。
export function diffSinceLastVisit(snapshot, today) {
  const v = read('visit', null);
  if (!sessionFlag('visit')) {
    const next = { baseline: v?.seen || null, baselineDate: v?.seenDate || null, seen: snapshot, seenDate: today };
    write('visit', next);
    return compare(next.baseline, snapshot, next.baselineDate);
  }
  return compare(v?.baseline || null, snapshot, v?.baselineDate || null);
}
function compare(base, cur, date) {
  const fresh = new Map();
  if (!base) return { date: null, fresh };
  Object.entries(cur).forEach(([k, st]) => {
    if (!(k in base)) fresh.set(k, 'new');
    else if (base[k] !== st) fresh.set(k, 'updated');
  });
  return { date, fresh };
}
export function clearFresh() {
  const v = read('visit', null);
  if (v) write('visit', { ...v, baseline: v.seen, baselineDate: v.seenDate });
}
