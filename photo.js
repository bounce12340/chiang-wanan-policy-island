// 拍照模式＋明信片：收起介面、自己轉好視角，按下快門把 3D 畫面合成一張「臺北施政島」明信片，可下載或分享。
// 圖片完全在瀏覽器裡產生，不上傳任何伺服器。
const $ = (sel, root = document) => root.querySelector(sel);

const LINES = [
  '一座島，一個政策領域。',
  '每一項施政，都附上來源。',
  '我在臺北施政島，看見城市的樣子。',
  '從捷運到社宅，一島一島看。',
];

export function initPhoto(ctx) {
  const { world, toast, getTheme, stamp, setView, view } = ctx;
  const ui = $('#photo-ui');
  const dlg = $('#photo-card');
  const img = $('#photo-img');
  const capIn = $('#photo-caption');
  const chips = $('#photo-lines');
  let blob = null, url = '';

  const themeLine = () => { const t = getTheme(); return t ? `${t.name}：${t.summary || ''}`.slice(0, 30) : ''; };
  function drawChips() {
    const opts = [themeLine(), ...LINES].filter(Boolean);
    chips.innerHTML = opts.map((t, i) => `<button type="button" data-line="${i}" aria-pressed="${capIn.value === t}">${t.replace(/[<>&"]/g, '')}</button>`).join('');
    chips.onclick = (e) => {
      const b = e.target.closest('[data-line]');
      if (!b) return;
      capIn.value = opts[+b.dataset.line];
      chips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    };
  }
  function enter() {
    if (!world) { toast('這台裝置無法顯示 3D 畫面，沒辦法拍照'); return; }
    if (view() !== 'island') setView('island');
    if (!capIn.value) capIn.value = themeLine() || LINES[0];
    drawChips();
    document.body.classList.add('photo-mode');
    ui.hidden = false;
    $('[data-ph="shoot"]', ui).focus();
  }
  function leave() {
    document.body.classList.remove('photo-mode');
    ui.hidden = true;
    setTimeout(() => world?.refreshLayout(), 50);
  }

  const taipeiDate = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '.');
  // 依螢幕方向決定明信片尺寸：手機直式 4:5、桌機橫式 3:2
  async function compose(src) {
    const portrait = innerHeight > innerWidth;
    const W = portrait ? 1080 : 1500, H = portrait ? 1350 : 1000;
    const pad = portrait ? 44 : 48, foot = portrait ? 250 : 200;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    try { await Promise.all(['900 60px "Noto Serif TC"', '500 30px "Noto Sans TC"', '700 22px "Space Grotesk"'].map((f) => document.fonts.load(f, '臺北施政島'))); } catch { /* 字型載不到就用系統字 */ }
    g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, W, H);
    // 照片：等比裁切填滿
    const pw = W - pad * 2, ph = H - pad - foot;
    const s = Math.max(pw / src.width, ph / src.height);
    const sw = pw / s, sh = ph / s;
    g.save();
    g.beginPath(); g.roundRect ? g.roundRect(pad, pad, pw, ph, 18) : g.rect(pad, pad, pw, ph); g.clip();
    g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, pad, pad, pw, ph);
    g.restore();
    // 郵戳
    const cx = W - pad - 92, cy = pad + 92;
    g.save();
    g.translate(cx, cy); g.rotate(-0.18);
    g.strokeStyle = 'rgba(208,69,122,.9)'; g.fillStyle = 'rgba(208,69,122,.9)'; g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.lineWidth = 2; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 24px "Noto Serif TC", serif'; g.fillText('臺北施政島', 0, -10);
    g.font = '700 17px "Space Grotesk", sans-serif'; g.fillText(taipeiDate(), 0, 20);
    g.restore();
    // 文字區
    const ty = pad + ph;
    g.fillStyle = '#14213d';
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = `900 ${portrait ? 64 : 56}px "Noto Serif TC", serif`;
    g.fillText('臺北施政島', pad, ty + (portrait ? 92 : 80));
    const cap = (capIn.value || '').trim().slice(0, 40);
    g.font = `500 ${portrait ? 32 : 30}px "Noto Sans TC", sans-serif`;
    g.fillStyle = '#3d4a66';
    // 依寬度斷行，最多兩行
    const lines = [];
    let line = '';
    for (const ch of cap) { if (g.measureText(line + ch).width > pw) { lines.push(line); line = ch; } else line += ch; }
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((l, i) => g.fillText(l, pad, ty + (portrait ? 146 : 128) + i * 42));
    g.font = '700 20px "Space Grotesk", sans-serif';
    g.fillStyle = '#d0457a';
    g.textAlign = 'right';
    g.fillText(`${location.host}${location.pathname}`.replace(/\/$/, ''), W - pad, H - (portrait ? 34 : 28));
    g.textAlign = 'left';
    g.fillStyle = '#3d4a66';
    g.font = '500 18px "Noto Sans TC", sans-serif';
    g.fillText('非官方整理・資料附公開來源', pad, H - (portrait ? 34 : 28));
    return c;
  }

  async function shoot() {
    // 快門閃光；在同一個工作階段內取得 3D 畫面像素
    const frame = document.createElement('canvas');
    const src = world.snapshot();
    frame.width = src.width; frame.height = src.height;
    frame.getContext('2d').drawImage(src, 0, 0);
    document.body.classList.add('photo-flash');
    setTimeout(() => document.body.classList.remove('photo-flash'), 350);
    const card = await compose(frame);
    blob = await new Promise((r) => card.toBlob(r, 'image/jpeg', 0.9));
    url = card.toDataURL('image/jpeg', 0.9);
    img.src = url;
    leave();
    dlg.showModal();
    stamp?.('game:photo');
  }
  const fileName = () => `taipei-policy-island-${taipeiDate().replace(/\./g, '')}.jpg`;
  function download() {
    const a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.append(a); a.click(); a.remove();
  }
  async function share() {
    const file = blob && new File([blob], fileName(), { type: 'image/jpeg' });
    const text = `我在「臺北施政島」拍的明信片，每一項施政都附來源：${location.origin}${location.pathname}`;
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; } catch (err) { if (err.name === 'AbortError') return; }
    }
    download();
    toast('這個瀏覽器不支援直接分享圖片，已改為下載');
  }

  ui.addEventListener('click', (e) => {
    const k = e.target.closest('[data-ph]')?.dataset.ph;
    if (k === 'shoot') shoot();
    if (k === 'cancel') leave();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ui.hidden) leave(); });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) { dlg.close(); return; }
    const k = e.target.closest('[data-pc]')?.dataset.pc;
    if (k === 'download') download();
    if (k === 'share') share();
    if (k === 'again') { dlg.close(); enter(); }
  });
  $('#btn-photo').addEventListener('click', enter);
  return { enter, leave };
}
