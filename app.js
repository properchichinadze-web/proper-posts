import { createStore } from './store.js?v=58';
import { BRAND } from './config.js?v=58';
document.title = BRAND.title;
// ბრენდის ფერები და ხატულა config.js-დან
(() => {
  const c = BRAND.colors || {}, r = document.documentElement.style;
  if (c.primary) r.setProperty('--blue', c.primary);
  if (c.dark) r.setProperty('--navy', c.dark);
  if (c.accent) r.setProperty('--orange', c.accent);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${c.primary || '#041E89'}'/><text x='16' y='22' font-family='Arial' font-size='18' font-weight='700' fill='#fff' text-anchor='middle'>${(BRAND.favLetter || 'M').slice(0, 1)}</text></svg>`;
  const l = document.querySelector('link[rel=icon]'); if (l) l.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
})();

const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTHS_GEN = ['იანვრის', 'თებერვლის', 'მარტის', 'აპრილის', 'მაისის', 'ივნისის', 'ივლისის', 'აგვისტოს', 'სექტემბრის', 'ოქტომბრის', 'ნოემბრის', 'დეკემბრის'];
const DOW = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
const DOW_FULL = { 1: 'ორშაბათი', 2: 'სამშაბათი', 3: 'ოთხშაბათი', 4: 'ხუთშაბათი', 5: 'პარასკევი', 6: 'შაბათი', 0: 'კვირა' };
const STATUS = { new: ['ბაზაში', 'b-new'], ready: ['თარიღი არ აქვს', 'b-new'], planned: ['დაგეგმილი', 'b-planned'], posted: ['დადებული', 'b-posted'] };
// მიმართულებები (config.js → BRAND.cats)
const CATS = BRAND.cats;
const catText = m => (m?.cats || []).join(', ');
// პოსტის სტილები: რა უნდა გამოგზავნოს ბრენდ მენეჯერმა
const STYLES = BRAND.styles;

const app = document.getElementById('app');
const S = { role: null, notes: [], showForm: false, ours: [], store: null, user: null, ready: false, hasAdmin: true, managers: [], products: [], settings: { postDays: BRAND.postDays || [2, 5] }, month: null, dpDraft: {}, mode: 'home', filter: 'all', draftImgs: [], gImgs: [[]], open: new Set(), style: null, unsub: [] };

// ───────── დამხმარე ─────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => iso(new Date());
const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const niceDate = s => { const d = fromIso(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${DOW_FULL[d.getDay()]}`; };
const fmtDT = ms => { const d = new Date(ms); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const shopOk = u => new RegExp('^https?://(www\\.)?' + BRAND.shopHost.replace(/\./g, '\\.') + '(/|$)', 'i').test(u || '');
const priceOk = v => /^\d+([.,]\d{1,2})?$/.test(String(v || '').trim());
const shortDate = s => { const d = fromIso(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}.`; };
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const mgr = id => S.managers.find(m => m.id === id) || (S.user?.uid === id ? S.user : null);
const isAdmin = () => S.user?.role === 'admin';
const isBrand = () => S.user?.role === 'brand';
const isSales = () => S.user?.role === 'sales';
const isLeader = () => S.user?.role === 'leader';
const ROLE_NAME = { brand: 'ბრენდ მენეჯერი', sales: 'გაყიდვები', leader: 'ხელმძღვანელი', admin: 'მარკეტინგი' };
const brandMgrs = () => S.managers.filter(m => m.role === 'brand');
const openNotes = key => S.notes.filter(n => n.postKey === key && !n.resolved && !n.withdrawn).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
const approved = m => m?.approved !== false;
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function errText(e) {
  const c = e?.code || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return 'მომხმარებელი ან პაროლი არასწორია.';
  if (c.includes('email-already-in-use')) return 'ეს მომხმარებლის სახელი უკვე დაკავებულია. აირჩიე სხვა.';
  if (c.includes('weak-password')) return 'პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს.';
  if (c.includes('too-many-requests')) return 'ბევრი მცდელობა. სცადე რამდენიმე წუთში.';
  if (c.includes('permission-denied')) return 'ამის უფლება არ გაქვს.';
  return 'შეცდომა: ' + (e?.message || e);
}
const byNew = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
const byOrder = (a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0);
const userOk = u => /^[a-z0-9._-]{3,30}$/i.test(u);

function shrink(file, max = 1000, q = 0.8) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('სურათი ვერ წავიკითხე')); };
    img.src = url;
  });
}

// ჩვენი გამზადებული პოსტები (Firestore: posts, ხედავს მხოლოდ დაშვებული): თარიღი გავიდა ან ლინკები აქვს = გამოქვეყნდა
const ours = () => S.ours.map(o => {
  const date = o.date || null, time = o.time || '';
  const posted = o.status === 'posted' || (o.links || []).length > 0;
  const status = posted ? 'posted' : date ? 'planned' : 'ready';
  return { id: 'our-' + o.id, our: true, key: o.id, productId: o.productId || null, name: o.title, date, time, where: o.where, style: o.style, images: o.images || [], links: o.links || [], videos: o.videos || [], postText: o.text || '', brand: BRAND.name, managerName: 'მარკეტინგი', status };
});
// გასული თვე: მხოლოდ ტექსტი და ლინკები რჩება (სურათები აღარ ჩანს)
const pastMonth = ds => !!ds && ds.slice(0, 7) < todayIso().slice(0, 7);
const linksHtml = p => (p.links || []).length ? `<div class="links">${p.links.map(l => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.network)} ↗</a>`).join('')}</div>` : '';
// ვიდეო: Drive-ის ფაილის id ან ლინკი, ჩანს Drive-ის ფლეერით (ფაილი Drive-ზე რჩება, ბაზაში ადგილს არ იკავებს).
// Drive-ის ფაილს „Anyone with the link: Viewer“ წვდომა უნდა ჰქონდეს.
const driveId = v => (String(v || '').match(/[-\w]{25,}/) || [''])[0];
const videosHtml = p => (p.videos || []).map(driveId).filter(Boolean).map(id => `<div class="vid ${STYLES[p.style]?.link === 'youtube' ? 'wide' : ''}"><iframe src="https://drive.google.com/file/d/${esc(id)}/preview" loading="lazy" allow="autoplay; fullscreen" allowfullscreen title="ვიდეო"></iframe></div>`).join('');
const findItem = id => S.products.find(x => x.id === id) || ours().find(x => x.id === id);

function dayInfo(ds) {
  const items = ours().filter(o => o.date === ds && o.status !== 'ready');
  const posted = items.filter(p => p.status === 'posted');
  const planned = items.filter(p => p.status === 'planned');
  const isPost = S.settings.postDays.includes(fromIso(ds).getDay());
  const past = ds < todayIso();
  let cls = '', tag = '';
  if (posted.length && !planned.length) { cls = 'posted'; tag = 'დადებულია'; }
  else if (planned.length) { cls = 'planned'; tag = 'დაგეგმილი'; }
  else if (isPost && !past) { cls = 'post'; tag = 'პოსტის დღე'; }
  return { items, posted, planned, isPost, cls, tag };
}

// ───────── ჩარჩო ─────────
function render() {
  if (!S.ready) return;
  const top = document.scrollingElement.scrollTop;
  const u = S.user;
  // საიტი დახურულია: შესვლის და დაშვების გარეშე მხოლოდ შესასვლელი გვერდი ჩანს
  if (!u || (!isAdmin() && !approved(u))) { app.innerHTML = landing(); document.body.classList.add('blue'); bind(); return; }
  document.body.classList.remove('blue');
  const tabs = isAdmin() ? [['home', 'მთავარი'], ['mkt', 'მარკეტინგი']]
    : isBrand() ? [['home', 'მთავარი'], ['brand', 'ჩემი კაბინეტი']]
    : isSales() ? [['home', 'მთავარი'], ['sales', 'გაყიდვები']]
    : [['home', 'მთავარი']];
  if (!tabs.some(t => t[0] === S.mode)) S.mode = 'home';
  app.innerHTML = `
  <header class="top"><div class="top-in">
    <img src="${BRAND.logo}" alt="${esc(BRAND.name)}">
    <div class="ttl">${esc(BRAND.title)}</div>
    <nav class="modes">
      ${tabs.map(([k, t]) => `<button data-mode="${k}" class="${S.mode === k ? 'on' : ''}">${t}</button>`).join('')}
      <a href="${BRAND.shopUrl}" target="_blank" rel="noopener">${esc(BRAND.shopLabel || "ონლაინ შოპი")}</a>
    </nav>
    <div class="who"><span class="av" title="${esc(u.fullName)} · ${esc(ROLE_NAME[u.role] || '')}">${esc(initials(u.fullName))}</span><button id="logout">გასვლა</button></div>
  </div></header>
  ${S.mode === 'sales' ? salesView(u) : S.mode === 'mkt' ? mktView() : S.mode === 'brand' ? roomView(u) : homeView()}`;
  document.scrollingElement.scrollTop = top;
  bind();
}

// ═════════ შესასვლელი გვერდი (ლურჯი, მინიმალისტური) ═════════
function landing() {
  const u = S.user;
  if (u) return `<div class="landing">
    <img src="${BRAND.logo}" alt="${esc(BRAND.name)}" class="l-logo">
    <div class="l-card stack" style="text-align:center">
      <div style="font-size:40px">⏳</div>
      <h2>რეგისტრაცია მიღებულია</h2>
      <p class="muted">${esc(u.fullName)} · ${esc(ROLE_NAME[u.role] || '')}. მარკეტინგის მენეჯერმა უნდა დაგიშვას, მერე აქ გაიხსნება საიტი.</p>
      <div><button class="btn ghost" id="logout">გასვლა</button></div>
    </div>
  </div>`;
  const roles = [['brand', 'ბრენდ მენეჯერი'], ['sales', 'გაყიდვების მენეჯერი'], ['leader', 'ხელმძღვანელი'], ['admin', 'მარკეტინგი']];
  const r = S.role;
  return `<div class="landing">
    <img src="${BRAND.logo}" alt="${esc(BRAND.name)}" class="l-logo">
    <h1 class="l-title">${esc(BRAND.title)}</h1>
    <p class="l-sub">${r === 'admin' ? 'შედი' : r ? 'შედი ან დარეგისტრირდი' : 'აირჩიე, ვინ ხარ'}</p>
    <div class="l-roles">${roles.map(([k, t]) => `<button class="l-role ${r === k ? 'on' : ''}" data-role="${k}">${t}</button>`).join('')}</div>
    ${r ? `<div class="l-forms">${r === 'admin' ? adminGate() : r === 'brand' ? brandEntry() : peopleEntry(r)}</div>` : ''}
  </div>`;
}
// გაყიდვები / ხელმძღვანელი: შესვლა + მარტივი რეგისტრაცია
function peopleEntry(role) {
  return `<div class="entry">
      <form class="pane stack" id="loginform">
        <h2>შესვლა</h2>
        <label class="f">მომხმარებელი<input type="text" name="username" required autocomplete="username"></label>
        <label class="f">პაროლი<input type="password" name="password" required autocomplete="current-password"></label>
        <div class="err" id="lerr"></div>
        <button class="btn big">შესვლა</button>
      </form>
      <form class="pane stack" id="peoplereg" data-prole="${role}">
        <h2>რეგისტრაცია</h2>
        <div class="muted small">პირველად ხარ? დაშვებას მარკეტინგი მოგცემს.</div>
        <label class="f">სახელი და გვარი *<input type="text" name="fullName" required></label>
        <div class="grid2">
          <label class="f">მომხმარებელი * (ლათინური ასოები)<input type="text" name="username" required autocomplete="username"></label>
          <label class="f">პაროლი * (მინ. 6 სიმბოლო)<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
        </div>
        <div class="err" id="serr"></div>
        <button class="btn big">რეგისტრაცია</button>
      </form>
    </div>`;
}

// ═════════ მთავარი: ყველასთვის სანახავი ═════════
function homeView() {
  return `<div class="wrap">
    <div class="intro"><h1>პოსტების გეგმა</h1><p>${esc(BRAND.nameGen)} პოსტების კალენდარი. დააჭირე დღეს და ნახე პოსტი.</p></div>
    <section class="pane">${calendar(true)}</section>
    <section class="pane">${planTable()}</section>
    <section class="pane">${uploadsPublic()}</section>
  </div>`;
}

// თვის გეგმა: ამ თვის პოსტები ცხრილად
function planTable(canNote) {
  const { y, m } = S.month;
  const key = `${y}-${pad(m + 1)}`;
  const list = ours().filter(o => (o.date || '').startsWith(key) && o.status !== 'ready').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = pastMonth(key + '-01');
  return `<div class="sec-title"><span class="num">2</span><div><h2>${MONTHS_GEN[m]} პოსტები</h2><div class="muted small">თვის გეგმა: თარიღი, პოსტი, სტატუსი${past ? ', ლინკები' : ''}</div></div></div>
    <div class="tscroll"><table class="table">
      <thead><tr><th>თარიღი</th>${past ? '' : '<th>ფოტო</th>'}<th>პოსტი</th><th>სად</th><th>სტატუსი</th><th>ლინკები</th><th>შენიშვნა</th></tr></thead>
      <tbody>${list.length ? list.map(p => {
        const [st, cls] = STATUS[p.status] || STATUS.planned; const img = p.images?.[0];
        return `<tr data-prod="${p.id}">
          <td class="strong">${esc(shortDate(p.date))}<small class="d">${esc(p.time || '')}</small></td>
          ${past ? '' : `<td><span class="thumb sm" style="${img ? `background-image:url('${img}')` : ''}"></span></td>`}
          <td class="strong">${esc(p.name)}</td>
          <td class="muted">${esc(p.where || '')}</td>
          <td><span class="badge ${cls}">${st}</span></td>
          <td>${(p.links || []).map(l => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener" class="lnk-s" data-stop>${esc(l.network)} ↗</a>`).join('<br>') || '-'}</td>
          <td data-stop>${openNotes(p.key).length ? `<span class="nflag">⚠ ${openNotes(p.key).length}</span>` : ''}${canNote ? `<button class="btn ghost sm" data-note="${p.key}">✎ დაწერა</button>` : ''}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="7" class="empty">ამ თვეში პოსტი ჯერ არ არის</td></tr>`}</tbody>
    </table></div>`;
}

// ყველასთვის: ბრენდ მენეჯერების ატვირთული (ერთმანეთისასაც ხედავენ), გაუქმებულებიც
function uploadsPublic(num = 3) {
  const list = S.products.slice().sort(byNew);
  return `<div class="sec-title"><span class="num">${num}</span><div><h2>ბრენდ მენეჯერების ატვირთული</h2><div class="muted small">ყველა გამოგზავნილი პროდუქტი და მისი ეტაპი. გაუქმებული წითლად ჩანს.</div></div></div>
    <div class="tscroll"><table class="table">
      <thead><tr><th>ფოტო</th><th>პროდუქტი</th><th>ბრენდი</th><th>მენეჯერი</th><th>სტილი</th><th>გამოგზავნა</th><th>დადასტურება</th><th>ეტაპი</th><th>შენიშვნა</th></tr></thead>
      <tbody>${list.length ? groupsOf(list).map(g => {
        const multi = g.length > 1, s0 = stageOf(g[0]);
        const head = !multi ? '' : groupHead(g, (c1, c2) => `<td>${c1}</td><td class="strong">${c2}</td><td>${esc(g[0].brand)}</td><td>${esc(g[0].managerName)}</td>
          <td><span class="sbadge s${esc(g[0].style)}">${esc(STYLES[g[0].style]?.name || '-')}</span></td>
          <td class="muted">${g[0].createdAt ? esc(shortDate(iso(new Date(g[0].createdAt)))) : ''}</td>
          <td>${confirmBadge(g.find(p => !p.confirmed && !p.cancelled) || g[0])}</td>
          <td><span class="badge ${s0.i === 4 ? 'b-posted' : s0.i === 3 ? 'b-planned' : 'b-new'}">${esc(STAGES[s0.i])}</span></td><td></td>`);
        return head + g.map(p => {
        const img = p.images?.[0]; const s = stageOf(p);
        return `<tr data-prod="${p.id}" class="${p.cancelled ? 'cancelled' : ''}${gsub(p, multi)}">
          <td><span class="thumb sm" style="${img ? `background-image:url('${img}')` : ''}"></span></td>
          <td class="strong">${esc(p.name)}</td>
          <td>${esc(p.brand)}</td>
          <td>${esc(p.managerName)}</td>
          <td><span class="sbadge s${esc(p.style)}">${esc(STYLES[p.style]?.name || '-')}</span></td>
          <td class="muted">${p.createdAt ? esc(shortDate(iso(new Date(p.createdAt)))) : ''}</td>
          <td>${confirmBadge(p)}</td>
          <td>${p.cancelled ? '<span class="badge b-missed">გაუქმებულია</span>' : `<span class="badge ${s.i === 4 ? 'b-posted' : s.i === 3 ? 'b-planned' : 'b-new'}">${esc(STAGES[s.i])}</span>`}${s.i === 4 ? linksHtml(s.post) : ''}</td>
          <td data-stop>${noteCell(pkey(p))}</td>
        </tr>`;
      }).join(''); }).join('') : '<tr><td colspan="9" class="empty">ჯერ არაფერი ატვირთულა</td></tr>'}</tbody>
    </table></div>`;
}

// შენიშვნები (გაყიდვების მენეჯერისგან): ყველას უჩანს, მარკეტინგი ნიშნავს „გასწორდა“
function notesHtml(p) {
  const list = openNotes(typeof p === 'string' ? p : p.key); if (!list.length) return '';
  return `<div class="notes">${list.map(n => `<div class="note-item">
    <b>⚠ ${esc(n.authorName || '')}</b> <span class="muted small">${esc(fmtDT(n.createdAt))}</span>
    <div>${esc(n.text)}</div>
    ${isAdmin() ? `<button class="btn ghost sm" data-nfix="${n.id}">✓ გასწორდა</button>` : ''}${S.user && n.authorId === S.user.uid ? `<button class="btn ghost sm" data-nundo="${n.id}">✕ შენიშვნის გაუქმება</button>` : ''}
  </div>`).join('')}</div>`;
}
function bindNotes(root) {
  $$('[data-note]', root).forEach(b => b.addEventListener('click', () => noteForm(b.dataset.note)));
  $$('[data-nfix]', root).forEach(b => b.addEventListener('click', async () => {
    try { await S.store.updateNote(b.dataset.nfix, { resolved: true, resolvedAt: Date.now() }); toast('მოინიშნა: გასწორდა'); b.closest('.note-item')?.remove(); } catch (e) { toast(errText(e)); }
  }));
  $$('[data-nundo]', root).forEach(b => b.addEventListener('click', async () => {
    if (!await ask('გავაუქმო ეს შენიშვნა?')) return;
    try { await S.store.updateNote(b.dataset.nundo, { withdrawn: true, withdrawnAt: Date.now() }); toast('შენიშვნა გაუქმდა'); b.closest('.note-item')?.remove(); } catch (e) { toast(errText(e)); }
  }));
}
const pkey = p => 'prod:' + p.id;
function noteTarget(key) {
  if (key.startsWith('prod:')) { const p = S.products.find(x => x.id === key.slice(5)); return p && { name: p.name + ' (' + p.brand + ')', date: null }; }
  return ours().find(o => o.key === key);
}
const canNote = () => isSales() && approved(S.user);
const noteCell = key => `${openNotes(key).length ? `<span class="nflag">⚠ ${openNotes(key).length}</span>` : ''}${canNote() ? `<button class="btn ghost sm" data-note="${key}">✎ დაწერა</button>` : ''}`;
function noteForm(key) {
  const p = noteTarget(key); if (!p) return;
  const box = modal(`<form class="stack" id="nform">
    <h2>⚠ შენიშვნა პოსტზე</h2>
    <div class="note small"><b>${esc(p.name)}</b>${p.date ? ' · ' + esc(niceDate(p.date)) : ''}</div>
    <label class="f">რა არ არის კარგად? (მაგ. ფასი არასწორია)<textarea name="text"></textarea></label>
    <div class="err" id="nerr"></div>
    <div><button class="btn danger">გაგზავნა</button></div>
  </form>`);
  $('#nform', box).addEventListener('submit', async ev => {
    ev.preventDefault(); const t = new FormData(ev.target).get('text').trim(); if (!t) return $('#nerr', box).textContent = 'დაწერე, რა არ არის კარგად.';
    try { await S.store.addNote({ postKey: key, postTitle: p.name, text: t, authorId: S.user.uid, authorName: S.user.fullName }); closeModal(); toast('შენიშვნა გაიგზავნა. ყველა დაინახავს.'); }
    catch (e) { $('#nerr', box).textContent = errText(e); }
  });
}

// ═════════ გაყიდვების მენეჯერი: კალენდარს აკვირდება, შენიშვნას წერს ═════════
function salesEntry() {
  return `<div class="wrap">
    <div class="intro"><h1>გაყიდვების მენეჯერი</h1><p>ხედავ, რა დაიდო, რა არის მზად და როდის გავა. თუ პოსტზე რამე არასწორია, წერ შენიშვნას.</p></div>
    ${S.user ? '<div class="note small">ახლა სხვა ანგარიშით ხარ შესული. აქ შესასვლელად ჯერ დააჭირე „გასვლა“.</div>' : ''}
    <div class="entry">
      <form class="pane stack" id="loginform">
        <div class="sec-title"><span class="num">→</span><div><h2>შესვლა</h2><div class="muted small">უკვე დარეგისტრირებული ხარ?</div></div></div>
        <label class="f">მომხმარებელი<input type="text" name="username" required autocomplete="username"></label>
        <label class="f">პაროლი<input type="password" name="password" required autocomplete="current-password"></label>
        <div class="err" id="lerr"></div>
        <button class="btn big">შესვლა</button>
      </form>
      <form class="pane stack" id="salesreg">
        <div class="sec-title"><span class="num">+</span><div><h2>რეგისტრაცია</h2><div class="muted small">პირველად ხარ? დაშვებას მარკეტინგი მოგცემს.</div></div></div>
        <label class="f">სახელი და გვარი *<input type="text" name="fullName" required></label>
        <div class="grid2">
          <label class="f">მომხმარებელი * (ლათინური ასოები)<input type="text" name="username" required autocomplete="username"></label>
          <label class="f">პაროლი * (მინ. 6 სიმბოლო)<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
        </div>
        <div class="err" id="serr"></div>
        <button class="btn big">რეგისტრაცია</button>
      </form>
    </div>
  </div>`;
}
function salesView(m) {
  if (!approved(m)) return `<div class="wrap narrow"><div class="pane stack" style="text-align:center;padding:40px 20px">
      <div style="font-size:40px">⏳</div><h2>რეგისტრაცია მიღებულია</h2>
      <p class="muted">მარკეტინგის მენეჯერმა უნდა დაგიშვას. დაშვების მერე აქ გაიხსნება კალენდარი.</p></div></div>`;
  return `<div class="wrap">
    <div class="intro"><h1>გაყიდვები</h1><p>${esc(m.fullName)} · თუ პოსტზე რამე არასწორია (მაგ. ფასი), დააჭირე „✎ დაწერა“. ყველა დაინახავს.</p></div>
    <section class="pane">${calendar(true)}</section>
    <section class="pane">${planTable(true)}</section>
    <section class="pane">${readyForSales()}</section>
    <section class="pane">${uploadsPublic(4)}</section>
  </div>`;
}

function readyForSales() {
  const list = ours().filter(p => p.status === 'ready');
  return `<div class="sec-title"><span class="num">3</span><div><h2>გამზადებული, კალენდარში ჯერ არ არის</h2><div class="muted small">მზა პოსტები, რომლებსაც თარიღი ჯერ არ აქვთ</div></div></div>
    <div class="ready">${list.length ? list.map(p => `<div class="rcard r-ready">
      <span class="thumb lg" style="${p.images?.[0] ? `background-image:url('${p.images[0]}')` : ''}"></span>
      <div class="grow"><b>${esc(p.name)}</b><div class="muted small">${esc(p.where || '')}</div>${notesHtml(p)}
      <div class="row" style="margin-top:6px"><button class="btn ghost sm" data-ourview="${p.id}">ტექსტის ნახვა</button>${noteCell(p.key)}</div></div>
    </div>`).join('') : '<div class="empty">ასეთი პოსტი ახლა არ არის</div>'}</div>`;
}

// ═════════ მარკეტინგი (მხოლოდ ადმინი) ═════════
function adminGate() {
  const setup = !S.hasAdmin;
  return `<div class="narrow-box">
    ${isBrand() ? '<div class="note small">ახლა ბრენდ მენეჯერით ხარ შესული. მარკეტინგში შესასვლელად ჯერ დააჭირე „გასვლა“.</div>' : `
    <form class="pane stack login" id="${setup ? 'setupform' : 'adminform'}">
      <h2>${setup ? 'მარკეტინგის ანგარიშის შექმნა' : 'შესვლა'}</h2>
      ${setup ? '<label class="f">სახელი და გვარი<input type="text" name="fullName" required></label>' : ''}
      <label class="f">მომხმარებელი<input type="text" name="username" required autocomplete="username"></label>
      <label class="f">პაროლი${setup ? ' (მინ. 6 სიმბოლო)' : ''}<input type="password" name="password" required ${setup ? 'minlength="6" autocomplete="new-password"' : 'autocomplete="current-password"'}></label>
      <div class="err" id="aerr"></div>
      <button class="btn big">${setup ? 'შექმნა' : 'შესვლა'}</button>
    </form>`}
  </div>`;
}

function mktView() {
  return `<div class="wrap">
    <div class="intro"><h1>მარკეტინგი</h1><p>შენი პანელი: განრიგი, კალენდარი, ბრენდ მენეჯერები და პროდუქტების ბაზა.</p></div>
    <section class="pane sched">
      <div><h2>📅 პოსტის განრიგი</h2><div class="muted small">მონიშნე, რომელ დღეებში დებ. კალენდარში ყოველ კვირას ეს დღეები გამოჩნდება.</div></div>
      <div class="filters">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="pill ${S.settings.postDays.includes(d) ? 'on' : ''}" data-sday="${d}">${DOW_FULL[d]}</button>`).join('')}</div>
    </section>
    <section class="pane">${bigTable()}</section>
    <section class="pane">${readyPosts()}</section>
    <section class="pane">${calendar()}</section>
    <section class="pane">${teamCards()}</section>
  </div>`;
}

function calendar(ro) {
  const { y, m } = S.month;
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
  const today = todayIso();
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (i >= 35 && d.getMonth() !== m) break;
    const ds = iso(d), inf = dayInfo(ds), out = d.getMonth() !== m;
    cells += `<div class="day ${inf.cls} ${out ? 'out' : ''} ${ds === today ? 'today' : ''}" data-day="${ds}">
      <div class="dtop"><span class="n">${d.getDate()}</span>${inf.items.some(p => openNotes(p.key).length) ? '<span class="nflag" title="შენიშვნა">⚠</span>' : ''}${inf.tag ? `<span class="tag">${inf.tag}</span>` : ''}</div>
      ${inf.items.slice(0, 2).map(p => `<span class="chip">${esc(p.name)}</span>`).join('')}
      ${inf.items.length > 2 ? `<span class="chip">+${inf.items.length - 2}</span>` : ''}
    </div>`;
  }
  const days = S.settings.postDays.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DOW_FULL[d]).join(', ') || 'არცერთი';
  return `<div class="sec-title"><span class="num">${ro ? 1 : 3}</span><div><h2>კალენდარი</h2><div class="muted small">${ro ? 'დააჭირე დღეს და ნახე პოსტის ტექსტი და სურათები' : 'დააჭირე დღეს და პოსტის ტექსტი შეცვალე'}</div></div></div>
    <div class="pane-head">
      <div class="row"><button class="navbtn" data-mon="-1" aria-label="წინა თვე">‹</button>
      <h3 class="month">${MONTHS[m]} ${y}</h3>
      <button class="navbtn" data-mon="1" aria-label="შემდეგი თვე">›</button>
      <button class="btn ghost sm" data-mon="0">დღეს</button></div>
      ${ro ? `<span class="muted small">პოსტის დღეები: ${days}</span>` : `<button class="btn ghost sm" id="days-btn">პოსტის დღეები: ${days}</button>`}
    </div>
    <div class="cal-grid ${pastMonth(iso(new Date(y, m, 1))) ? 'pastmonth' : ''}">${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
    <div class="legend">
      <span><i style="background:var(--green-soft);border:1.5px solid #9FDDBC"></i>პოსტის დღე</span>
      <span><i style="background:var(--plan-soft);border:1.5px solid var(--plan)"></i>დაგეგმილი</span>
      <span><i style="background:var(--done)"></i>დადებულია</span>
    </div>`;
}

// დამუშავებული პოსტები: მე ვტვირთავ, შენ თარიღს და დროს ნიშნავ, მერე სოციალურ ქსელებში ვდებ
function readyPosts() {
  // ჯერ დასადები (თარიღით), მერე უთარიღო, ბოლოს ამ თვეში უკვე დადებული
  const all = ours().filter(p => p.status !== 'posted' || !pastMonth(p.date));
  const rank = p => p.status === 'ready' ? 0 : p.status === 'planned' ? 1 : 2;
  const list = all.sort((a, b) => rank(a) - rank(b) || (a.date || '9999').localeCompare(b.date || '9999'));
  const n = s => all.filter(p => p.status === s).length;
  const tag = p => p.status === 'posted' ? '<span class="stag s-posted">✓ გამოქვეყნდა</span>'
    : p.status === 'planned' ? '<span class="stag s-planned">📅 კალენდარშია, ელოდება გამოქვეყნებას</span>'
    : '<span class="stag s-ready">⚠ კალენდარში არ არის</span>';
  return `<div class="sec-title"><span class="num">2</span><div><h2>გამზადებული პოსტები</h2><div class="muted small">მონიშნე, როდის დაიდოს, და დააჭირე „შენახვა“. მერე სოციალურ ქსელებში დაიდება.</div></div></div>
    <div class="rsum"><span class="stag s-ready">⚠ კალენდარში არ არის: ${n('ready')}</span><span class="stag s-planned">📅 კალენდარშია: ${n('planned')}</span><span class="stag s-posted">✓ გამოქვეყნდა: ${n('posted')}</span></div>
    <div class="ready">${list.length ? list.map(p => `<div class="rcard r-${p.status}">
      <span class="thumb lg" style="${p.images?.[0] ? `background-image:url('${p.images[0]}')` : ''}"></span>
      <div class="grow">
        <div class="row spread"><b>${esc(p.name)}</b>${tag(p)}</div>
        <div class="muted small">${esc(p.where || '')}</div>
        ${notesHtml(p)}
        ${p.status === 'posted' ? `<div class="row" style="margin-top:8px"><span class="muted small">გამოქვეყნდა: ${esc(shortDate(p.date))} ${esc(p.time || '')}</span>${linksHtml(p)}</div>` : `
        <div class="row" style="margin-top:8px">
          <input type="hidden" data-rdate="${p.key}" value="${esc(S.dpDraft[p.key] || p.date || '')}">
          <button type="button" class="btn ghost sm dp-btn" data-dpick="${p.key}" data-dstyle="${esc(p.style || '')}">📅 ${(S.dpDraft[p.key] || p.date) ? esc(niceDate(S.dpDraft[p.key] || p.date)) : 'აირჩიე თარიღი'}</button>
          <input type="time" data-rtime="${p.key}" value="${esc(p.time || '12:00')}" style="width:auto">
          <button class="btn sm" data-rsave="${p.key}">შენახვა</button>${p.date ? `<button class="btn ghost sm" data-rclear="${p.key}">✕ თარიღის მოხსნა</button>` : ''}
          <button class="btn ghost sm" data-prod="${p.id}">ტექსტი ✎</button>
        </div>`}
      </div>
    </div>`).join('') : '<div class="empty">ახლა გამზადებული პოსტი არ არის</div>'}</div>`;
}

// ბრენდ მენეჯერების მართვა: გახსნა, შეცვლა, გადანაცვლება, წაშლა
function teamCards() {
  const pending = S.managers.filter(m => !approved(m)).sort(byOrder);
  const ms = brandMgrs().filter(approved).sort(byOrder);
  const sales = S.managers.filter(m => m.role === 'sales' && approved(m));
  const leaders = S.managers.filter(m => m.role === 'leader' && approved(m));
  return `${pending.length ? `<div class="pending">
      <h3>🔔 ახალი რეგისტრაციები: დაშვებას ელოდება (${pending.length})</h3>
      ${pending.map(m => `<div class="prow">
        <span class="av">${esc(initials(m.fullName))}</span>
        <span class="grow"><span class="rolechip">${ROLE_NAME[m.role] || ''}</span> <b>${esc(m.brand || '')}</b> ${esc(m.fullName)} · ${esc(m.username || '')}<small class="d">${esc(catText(m))}</small></span>
        <button class="btn green sm" data-mok="${m.id}">✓ დაშვება</button>
        <button class="btn danger sm" data-mno="${m.id}">უარი</button>
      </div>`).join('')}
    </div>` : ''}
    <div class="row spread" style="align-items:flex-start">
      <div class="sec-title"><span class="num">4</span><div><h2>ბრენდ მენეჯერები</h2><div class="muted small">მართე სია: გახსნა, შეცვლა, ზემოთ/ქვემოთ, წაშლა</div></div></div>
      <button class="btn ghost sm" id="reload">↻ სიის განახლება</button>
    </div>
    <div class="team">${ms.length ? ms.map((m, i) => {
      const P = S.products.filter(p => p.managerId === m.id);
      return `<div class="tcard">
        <div class="row"><span class="av">${esc(initials(m.fullName))}</span><span class="grow"><b>${esc(m.brand)}</b><small>${esc(m.fullName)} · ${esc(m.username || '')}</small></span></div>
        <div class="tcats">${(m.cats || []).map(x => `<span>${esc(x)}</span>`).join('') || '<span>მიმართულება არ არის</span>'}</div>
        <div class="tnums"><span><b>${groupsOf(P).length}</b>გამოგზავნილი</span><span class="${P.some(p => p.cancelled) ? 'bad' : ''}"><b>${P.filter(p => p.cancelled).length}</b>გაუქმებული (შეცდომა)</span></div>
        <div class="tact">
          <button class="btn sm" data-mgr="${m.id}">გახსნა</button>
          <button class="icon" data-medit="${m.id}" title="შეცვლა" aria-label="შეცვლა">✎</button>
          <button class="icon" data-mup="${m.id}" title="ზემოთ" aria-label="ზემოთ" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon" data-mdown="${m.id}" title="ქვემოთ" aria-label="ქვემოთ" ${i === ms.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon del" data-mdel="${m.id}" title="წაშლა" aria-label="წაშლა">🗑</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty">ჯერ არცერთი ბრენდ მენეჯერი არ დარეგისტრირებულა</div>'}</div>
    <h3 style="margin:18px 0 8px">გაყიდვების მენეჯერები (${sales.length})</h3>
    <div class="prow-list">${sales.length ? sales.map(m => `<div class="prow"><span class="av">${esc(initials(m.fullName))}</span><span class="grow"><b>${esc(m.fullName)}</b> · ${esc(m.username || '')}</span><button class="icon del" data-mdel="${m.id}" title="წაშლა" aria-label="წაშლა">🗑</button></div>`).join('') : '<div class="muted small">ჯერ არავინ</div>'}</div>
    <h3 style="margin:18px 0 8px">ხელმძღვანელები (${leaders.length})</h3>
    <div class="prow-list">${leaders.length ? leaders.map(m => `<div class="prow"><span class="av">${esc(initials(m.fullName))}</span><span class="grow"><b>${esc(m.fullName)}</b> · ${esc(m.username || '')}</span><button class="icon del" data-mdel="${m.id}" title="წაშლა" aria-label="წაშლა">🗑</button></div>`).join('') : '<div class="muted small">ჯერ არავინ</div>'}</div>`;
}

// „დაიწყე მუშაობა“: მონიშნულები იგზავნება Claude-სთვის (Claude მხოლოდ ამ ღილაკის მერე იწყებს)
function workBar() {
  const picked = S.products.filter(p => p.pick && p.confirmed && !p.cancelled);
  const w = S.settings.workRequest;
  const st = !w ? '' : w.status === 'done' ? `✅ Claude-მ დაასრულა (${esc(fmtDT(w.at))})`
    : w.status === 'working' ? '⏳ Claude მუშაობს…' : `📨 გაგზავნილია Claude-სთვის, ელოდება (${esc(fmtDT(w.at))})`;
  return `<div class="workbar">
    <button class="btn orange big" id="start-work" ${picked.length ? '' : 'disabled'}>▶ დაიწყე მუშაობა (${picked.length})</button>
    <span class="muted small">${st || (picked.length ? 'მონიშნული და დადასტურებული პროდუქტები გაეგზავნება Claude-ს.' : 'ჯერ მონიშნე ✓ ქვემოთ (მხოლოდ დადასტურებული ✓ 100% ითვლება).')}</span>
  </div>`;
}

function bigTable() {
  let list = S.products.slice().sort(byNew);
  const brands = [...new Set(S.products.map(p => mgr(p.managerId)?.brand || p.brand).filter(Boolean))].sort();
  const styles = Object.entries(STYLES).map(([k, s]) => ['s:' + k, s.name]);
  if (S.filter === 'pick') list = list.filter(p => p.pick);
  else if (S.filter.startsWith('b:')) list = list.filter(p => (mgr(p.managerId)?.brand || p.brand) === S.filter.slice(2));
  else if (S.filter.startsWith('s:')) list = list.filter(p => p.style === S.filter.slice(2));
  const pills = [['all', 'ყველა'], ['pick', '✓ მონიშნული'], ...styles, ...brands.map(b => ['b:' + b, b])];
  return `<div class="sec-title"><span class="num">1</span><div><h2>ბრენდ მენეჯერების ატვირთული</h2><div class="muted small">მონიშნე ✓, რომელ პროდუქტზე ვიმუშაოთ. მზა პოსტი მე-2 გრაფაში ჩავარდება.</div></div></div>
    ${workBar()}
    <div class="filters">${pills.map(([k, t]) => `<button class="pill ${S.filter === k ? 'on' : ''}" data-filter="${esc(k)}">${esc(t)}</button>`).join('')}</div>
    <div class="tscroll"><table class="table">
      <thead><tr><th>ვიმუშაოთ</th><th>ფოტო</th><th>პროდუქტი</th><th>ბრენდი</th><th>მენეჯერი</th><th>სტილი</th><th>ძველი ფასი</th><th>ფასი</th><th>ლინკი</th><th>გამოგზავნა</th><th>დადასტურება</th></tr></thead>
      <tbody>${list.length ? groupsOf(list).map(g => {
        const multi = g.length > 1, m0 = mgr(g[0].managerId);
        const live = g.filter(p => !p.cancelled), gp = live.length && live.every(p => p.pick);
        const head = !multi ? '' : groupHead(g, (c1, c2) => `<td data-stop>${live.length ? `<label class="pick"><input type="checkbox" data-pick="${live.map(p => p.id).join(',')}" ${gp ? 'checked' : ''}><span>✓</span></label>` : '<span class="muted">-</span>'}</td><td>${c1}</td><td class="strong">${c2}</td><td>${esc(m0?.brand || g[0].brand)}</td><td>${esc(m0?.fullName || g[0].managerName)}</td>
          <td><span class="sbadge s${esc(g[0].style)}">${esc(STYLES[g[0].style]?.name || '-')}</span></td><td></td><td></td><td></td>
          <td class="muted">${g[0].createdAt ? esc(shortDate(iso(new Date(g[0].createdAt)))) : ''}</td>
          <td>${confirmBadge(g.find(p => !p.confirmed && !p.cancelled) || g[0])}</td>`);
        return head + g.map(p => {
        const m = mgr(p.managerId); const img = p.images?.[0];
        const link = safeUrl(p.link);
        return `<tr data-prod="${p.id}" class="${p.cancelled ? 'cancelled' : p.pick ? 'picked' : ''}${gsub(p, multi)}">
          <td data-stop>${multi ? '' : p.cancelled ? '<span class="muted">-</span>' : `<label class="pick"><input type="checkbox" data-pick="${p.id}" ${p.pick ? 'checked' : ''}><span>✓</span></label>`}</td>
          <td><span class="thumb sm" style="${img ? `background-image:url('${img}')` : ''}"></span></td>
          <td class="strong">${esc(p.name)}</td>
          <td>${esc(m?.brand || p.brand)}</td>
          <td>${esc(m?.fullName || p.managerName)}${catText(m) ? `<small class="d">${esc(catText(m))}</small>` : ''}</td>
          <td><span class="sbadge s${esc(p.style)}">${esc(STYLES[p.style]?.name || '-')}</span></td>
          <td class="price-c oldp">${p.oldPrice ? esc(p.oldPrice) + ' ₾' : '-'}</td>
          <td class="price-c">${p.price ? esc(p.price) + ' ₾' : '-'}</td>
          <td>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="lnk-s" data-stop>გახსნა ↗</a>` : '-'}</td>
          <td class="muted">${p.createdAt ? esc(shortDate(iso(new Date(p.createdAt)))) : ''}</td>
          <td>${confirmBadge(p)}${openNotes(pkey(p)).length ? ` <span class="nflag">⚠ ${openNotes(pkey(p)).length}</span>` : ''}</td>
        </tr>`;
      }).join(''); }).join('') : '<tr><td colspan="11" class="empty">ჯერ არაფერი ატვირთულა</td></tr>'}</tbody>
    </table></div>`;
}

// ═════════ ბრენდ მენეჯერი ═════════
// საჯარო გვერდი: შესვლა ან რეგისტრაცია (ყველასთვის სანახავი)
function brandEntry() {
  return `<div>
    <div class="entry">
      <form class="pane stack" id="loginform">
        <div class="sec-title"><span class="num">→</span><div><h2>შესვლა</h2><div class="muted small">უკვე დარეგისტრირებული ხარ?</div></div></div>
        <label class="f">მომხმარებელი<input type="text" name="username" required autocomplete="username"></label>
        <label class="f">პაროლი<input type="password" name="password" required autocomplete="current-password"></label>
        <div class="err" id="lerr"></div>
        <button class="btn big">შესვლა</button>
      </form>
      <form class="pane stack" id="regform">
        <div class="sec-title"><span class="num">+</span><div><h2>რეგისტრაცია</h2><div class="muted small">პირველად ხარ? შეავსე ერთხელ</div></div></div>
        <div class="grid2">
          <label class="f">ბრენდის სახელი *<input type="text" name="brand" required placeholder="მაგ. YATO"></label>
          <label class="f">სახელი და გვარი *<input type="text" name="fullName" required placeholder="მაგ. გიორგი ბერიძე"></label>
        </div>
        <div class="f">რომელ მიმართულებას ეკუთვნი * (შეგიძლია რამდენიმე აირჩიო)</div>
        <div class="cats">${CATS.map(c => `<label class="cat"><input type="checkbox" name="cats" value="${esc(c)}"><span>${esc(c)}</span></label>`).join('')}</div>
        <div class="grid2">
          <label class="f">მომხმარებელი * (ლათინური ასოები)<input type="text" name="username" required autocomplete="username" placeholder="მაგ. giorgi.yato"></label>
          <label class="f">პაროლი * (მინ. 6 სიმბოლო)<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
        </div>
        <div class="err" id="rerr"></div>
        <button class="btn big">რეგისტრაცია</button>
      </form>
    </div>
  </div>`;
}

// დადასტურება: გამოგზავნიდან 3 საათში ბრენდ მენეჯერმა უნდა დაადასტუროს „100% გადამოწმებულია“
const CONFIRM_MS = (BRAND.confirmHours || 3) * 60 * 60 * 1000;
function confirmState(p) {
  if (p.cancelled) return { k: 'cancel', t: '✕ გაუქმებულია', cls: 'c-late' };
  if (p.confirmed) return { k: 'ok', t: '✓ დადასტურებულია', cls: 'c-ok' };
  const left = (p.createdAt || 0) + CONFIRM_MS - Date.now();
  if (left <= 0) return { k: 'late', t: '⚠ 3 საათში არ დადასტურდა', cls: 'c-late' };
  const mins = Math.ceil(left / 60000), h = Math.floor(mins / 60), m = mins % 60;
  return { k: 'wait', t: `დასადასტურებლად დარჩა ${h ? h + ' სთ ' : ''}${m} წთ`, cls: 'c-wait' };
}
const confirmBadge = p => { const c = confirmState(p); return `<span class="cbadge ${c.cls}">${esc(c.t)}</span>`; };

// ბრენდ მენეჯერის კაბინეტი: მისი პროდუქტები ეტაპებით + ახალი პროდუქტის გამოგზავნა
const STAGES = ['გამოგზავნილი', 'მუშავდება', 'მზადაა', 'დაიდება', 'დაიდო'];
function stageOf(p) {
  const post = ours().find(o => o.productId === p.id);
  if (post?.status === 'posted') return { i: 4, post };
  if (post?.status === 'planned') return { i: 3, post };
  if (post) return { i: 2, post };
  if (p.pick) return { i: 1 };
  return { i: 0 };
}
function roomView(m) {
  if (!approved(m)) return `<div class="wrap narrow">
    <div class="intro"><h1>${esc(m.brand)}</h1><p>${esc(m.fullName)}</p></div>
    <div class="pane stack" style="text-align:center;padding:40px 20px">
      <div style="font-size:40px">⏳</div>
      <h2>რეგისტრაცია მიღებულია</h2>
      <p class="muted">მარკეტინგის მენეჯერმა უნდა დაგიშვას. დაშვების მერე აქ გაიხსნება შენი კაბინეტი.</p>
    </div>
  </div>`;
  const mine = S.products.filter(p => p.managerId === m.uid).sort(byNew);
  const cnt = STAGES.map((_, k) => mine.filter(p => !p.cancelled && stageOf(p).i === k).length);
  return `<div class="wrap narrow">
    <div class="intro"><h1>${esc(m.brand)}</h1><p>${esc(m.fullName)} · ${catText(m) ? esc(catText(m)) : 'მიმართულება არ არის არჩეული'} <button class="btn ghost sm" id="edit-me">შეცვლა</button></p></div>
    <section class="pane">
      <div class="row spread"><h2>ჩემი კაბინეტი</h2><button class="btn orange" id="new-prod">${S.showForm ? '× დახურვა' : '+ ახალი პროდუქტი'}</button></div>
      <div class="stagebar">${STAGES.map((s, k) => `<div><b>${cnt[k]}</b><span>${s}</span></div>`).join('')}</div>
    </section>
    ${S.showForm ? uploadForm() : ''}
    <section class="pane">
      <div class="sec-title"><span class="num">≡</span><div><h2>ჩემი პროდუქტები</h2><div class="muted small">გადაამოწმე და დააჭირე ნაცრისფერ „✓ 100% გადამოწმებულია“-ს (3 საათში). გამწვანების მერე იკეტება 🔒: შეცდომისას თავიდან ატვირთე.</div></div></div>
      <div class="plist2">${mine.length ? mine.map(p => {
        const img = p.images?.[0]; const s = stageOf(p);
        const extra = s.i === 3 && s.post?.date ? `: ${esc(shortDate(s.post.date))} ${esc(s.post.time || '')}` : '';
        return `<div class="pcard2">
          <button class="pc-head" data-view="${p.id}">
            <span class="thumb" style="${img ? `background-image:url('${img}')` : ''}"></span>
            <span class="tname"><b>${esc(p.name)}</b><small>${esc(STYLES[p.style]?.name || '')} · ${oldTxt(p)}${p.price ? esc(p.price) + ' ₾' : ''} · ${p.createdAt ? esc(shortDate(iso(new Date(p.createdAt)))) : ''}</small></span>
            <span class="lock">${p.confirmed ? '🔒' : ''}</span>
          </button>
          <div class="crow">${p.cancelled ? `<span class="vbtn cancel">✕ გაუქმებულია</span><span class="muted small">შეცდომის გამო. საჭიროების შემთხვევაში თავიდან ატვირთე.</span>` : p.confirmed ? `<span class="vbtn on">✓ 100% გადამოწმებულია 🔒</span><button class="btn danger sm" data-pcancel="${p.id}">გაუქმება</button>` : `<button class="vbtn" data-pconfirm="${p.id}">✓ 100% გადამოწმებულია</button>${confirmBadge(p)}${p.pick ? '' : `<button class="btn ghost sm" data-pedit="${p.id}">✎ შესწორება</button>`}`}</div>
          <div class="steps5 ${p.cancelled ? 'off' : ''}">${STAGES.map((t, k) => `<span class="${k < s.i ? 'done' : k === s.i ? 'on' : ''}">${k === s.i ? esc(t) + extra : esc(t)}</span>`).join('')}</div>
          ${s.i === 4 ? linksHtml(s.post) : ''}
        </div>`;
      }).join('') : '<div class="empty">ჯერ არაფერი გამოგიგზავნია. დააჭირე „+ ახალი პროდუქტი“.</div>'}</div>
    </section>
  </div>`;
}

function uploadForm() {
  const st = STYLES[S.style];
  return `<form class="pane stack" id="pform">
    <div class="sec-title"><span class="num">+</span><div><h2>ახალი პროდუქტის გამოგზავნა</h2><div class="muted small">ჯერ აირჩიე, რა სტილის პოსტი გინდა</div></div></div>
    <div class="styles">${Object.entries(STYLES).map(([k, s]) => `<button type="button" class="style-card ${S.style === k ? 'on' : ''}" data-style="${k}">
      <b>${s.name}</b><span>${s.what}</span><small>საჭიროა: ${s.need}</small></button>`).join('')}</div>
    ${st ? `
    <div class="design">
      <div><div class="dtitle">ერთი დიზაინი (1 პოსტერი ან 1 ვიდეო)</div><div class="muted small">აქ დამატებული ყველა პროდუქტი ერთ პოსტერზე / ერთ ვიდეოში შევა. მაქს. ${MAXP} პროდუქტი.</div></div>
      ${S.gImgs.map((_, i) => prodBlock(i, st)).join('')}
      ${S.gImgs.length < MAXP ? '<button type="button" class="addp" id="addp">+ კიდევ ერთი პროდუქტი ამ დიზაინში</button>' : ''}
    </div>
    <label class="vcheck"><input type="checkbox" name="verified"><span class="vbox">✓</span><span><b>100% გადამოწმებულია</b><small>თუ ახლა არ მონიშნავ, 3 საათი გაქვს გადასამოწმებლად. მონიშვნის მერე შეცვლა აღარ იქნება.</small></span></label>
    <div class="err" id="perr"></div>
    <div><button class="btn orange big" id="psubmit">გამოგზავნა: 1 დიზაინი, ${S.gImgs.length} პროდუქტი</button></div>` : ''}
  </form>`;
}
// ერთი დიზაინის (ერთი პოსტის) პროდუქტები: თითო ბლოკი, ველების სახელები ნომრით (name_0, name_1 ...)
const MAXP = 6;
const PFIELDS = ['link', 'shop', 'supplier', 'name', 'specs', 'old', 'price'];
// კვირის აქცია (config.js → promo: true): ძველი ფასი + სააქციო ფასი. ძველი ფასი ნაცრისფრად ჩანს.
const isPromo = s => !!STYLES[s]?.promo;
const oldTxt = p => p.oldPrice ? `<span class="oldp">${esc(p.oldPrice)} ₾</span> ` : '';
const oldBlock = p => isPromo(p.style) ? `<div><div class="lbl">ძველი ფასი</div><div class="price oldp">${p.oldPrice ? esc(p.oldPrice) + ' ₾' : '-'}</div></div>` : '';
function prodBlock(i, st) {
  const yt = st.link === 'youtube';
  return `<div class="pblock">
    <div class="row spread"><b>პროდუქტი ${i + 1}</b>${S.gImgs.length > 1 ? `<button type="button" class="btn ghost sm" data-pbdel="${i}">✕ ამოღება</button>` : ''}</div>
    <label class="f">${yt ? 'YouTube ვიდეოს ლინკი *' : '1. ჩვენი მაღაზიის პროდუქტის ლინკი (' + BRAND.shopHost + ') *'}<input type="url" name="link_${i}" required placeholder="${yt ? 'https://www.youtube.com/watch?v=...' : BRAND.shopUrl + '...'}"></label>
    ${yt ? `<label class="f">პროდუქტის ლინკი ${BRAND.shopHost}-ზე (თუ აქვს)<input type="url" name="shop_${i}" placeholder="${BRAND.shopUrl}..."></label>` : ''}
    <label class="f">2. მომწოდებლის მაღაზიის პროდუქტის ლინკი *<input type="url" name="supplier_${i}" required placeholder="https://..."></label>
    <label class="f">3. პროდუქტის დასახელება *<input type="text" name="name_${i}" required placeholder="მაგ. მომჭერი 150მმ 1000V YT-21190"></label>
    <div class="f">სურათები * (მაქს. 3)</div>
    <div class="imgs" data-gimgs="${i}"></div>
    <label class="f">მახასიათებლები / ტექსტი *<textarea name="specs_${i}" required placeholder="თითო მახასიათებელი ცალკე ხაზზე"></textarea></label>
    ${st.promo ? `<label class="f">ძველი ფასი (₾) *<input type="text" name="old_${i}" required inputmode="decimal" placeholder="მაგ. 299"></label>` : ''}
    <label class="f">${st.promo ? '<span class="promo-lbl">სააქციო ფასი (₾) *</span>' : 'ფასი (₾) *'}<input type="text" name="price_${i}" required inputmode="decimal" placeholder="მაგ. 249"></label>
  </div>`;
}
function drawGImgs() {
  $$('[data-gimgs]').forEach(box => {
    const i = Number(box.dataset.gimgs), arr = S.gImgs[i] || [];
    box.innerHTML = arr.map((src, k) => `<div><img src="${src}" alt=""><button type="button" data-grm="${k}" aria-label="წაშლა">×</button></div>`).join('')
      + (arr.length < 3 ? `<label class="drop">+<span>სურათი</span><input type="file" accept="image/*" multiple hidden></label>` : '');
    $$('[data-grm]', box).forEach(b => b.addEventListener('click', () => { arr.splice(Number(b.dataset.grm), 1); drawGImgs(); }));
    $('input[type=file]', box)?.addEventListener('change', async (ev) => {
      for (const f of [...ev.target.files].slice(0, 3 - arr.length)) { try { arr.push(await shrink(f)); } catch (e) { toast(e.message); } }
      drawGImgs();
    });
  });
}

// ცხრილებში: ერთი დიზაინის პროდუქტები ერთ ხაზად, „+“-ით იშლება
const gid = p => p.groupId || p.id;
function groupsOf(list) {
  const m = new Map();
  for (const p of list) { const k = gid(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
  return [...m.values()].map(g => g.sort((a, b) => (a.groupIdx ?? 0) - (b.groupIdx ?? 0)));
}
function groupHead(g, cells) {
  const k = gid(g[0]), open = S.open.has(k), img = g.find(p => p.images?.[0])?.images[0];
  return `<tr class="ghead" data-gtoggle="${esc(k)}">${cells(`<div class="gcell"><span class="gpm">${open ? '−' : '+'}</span><span class="thumb sm" style="${img ? `background-image:url('${img}')` : ''}"></span></div>`,
    `<b>ერთი დიზაინი</b><span class="gcnt">${g.length} პროდუქტი</span>`)}</tr>`;
}
const gsub = (p, multi) => multi ? ` gsub" data-gof="${esc(gid(p))}" style="${S.open.has(gid(p)) ? '' : 'display:none'}` : '';

// ───────── მოდალები ─────────
function modal(html, wide) {
  closeModal();
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="box ${wide ? 'wide' : ''}"><button class="x" data-close aria-label="დახურვა">×</button>${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
  document.body.appendChild(m);
  return m;
}
function closeModal() { $('#modal')?.remove(); }
function ask(text) {
  return new Promise(res => {
    const w = document.createElement('div'); w.className = 'modal'; w.id = 'askbox';
    w.innerHTML = `<div class="box"><div class="stack"><h2 style="font-size:18px">${esc(text)}</h2>
      <div class="row"><button class="btn" data-a="1">კი</button><button class="btn ghost" data-a="0">არა</button></div></div></div>`;
    w.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b || e.target === w) { w.remove(); res(b?.dataset.a === '1'); } });
    document.body.appendChild(w);
  });
}

// ბრენდ მენეჯერის მონაცემების შეცვლა (თვითონ ან ადმინი)
function managerForm(m) {
  const id = m.id || m.uid;
  const box = modal(`<form class="stack" id="mform">
    <h2>მონაცემების შეცვლა</h2>
    <label class="f">ბრენდის სახელი<input type="text" name="brand" required value="${esc(m.brand)}"></label>
    <label class="f">სახელი და გვარი<input type="text" name="fullName" required value="${esc(m.fullName)}"></label>
    <div class="f">მიმართულება * (შეიძლება რამდენიმე)</div>
    <div class="cats">${CATS.map(c => `<label class="cat"><input type="checkbox" name="cats" value="${esc(c)}" ${m.cats?.includes(c) ? 'checked' : ''}><span>${esc(c)}</span></label>`).join('')}</div>
    <div class="err" id="merr"></div>
    <div><button class="btn">შენახვა</button></div>
  </form>`, true);
  $('#mform', box).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const x = { brand: f.get('brand').trim(), fullName: f.get('fullName').trim(), cats: f.getAll('cats') };
    if (!x.brand || !x.fullName) return;
    if (!x.cats.length) return $('#merr', box).textContent = 'აირჩიე მინიმუმ ერთი მიმართულება.';
    try {
      await S.store.updateManager(id, x);
      if (isAdmin()) for (const p of S.products.filter(p => p.managerId === id)) await S.store.updateProduct(p.id, { managerName: x.fullName, brand: x.brand });
      closeModal(); toast('შენახულია');
    } catch (e) { $('#merr', box).textContent = errText(e); }
  });
}

function detailsHtml(p) {
  const m = mgr(p.managerId);
  const link = safeUrl(p.link), shop = safeUrl(p.shop), supplier = safeUrl(p.supplier);
  return `<div><span class="sbadge s${esc(p.style)}">${esc(STYLES[p.style]?.name || '')}</span></div>
    <h2 style="font-size:24px">${esc(p.name)}</h2>
    <div class="muted">${esc(m?.brand || p.brand)} · გამოგზავნა: <b>${esc(m?.fullName || p.managerName)}</b></div>
    ${p.images?.length ? `<div class="big-imgs">${p.images.map((s, i) => `<a href="${s}" download="${esc(p.name)}_${i + 1}.jpg" title="ჩამოტვირთვა"><img src="${s}" alt=""></a>`).join('')}</div>` : ''}
    <div class="grid2">
      <div><div class="row" style="gap:24px;align-items:flex-start">${oldBlock(p)}<div><div class="lbl">${isPromo(p.style) ? 'სააქციო ფასი' : 'ფასი'}</div><div class="price">${p.price ? esc(p.price) + ' ₾' : '-'}</div></div></div></div>
      <div><div class="lbl">${STYLES[p.style]?.link === 'youtube' ? 'YouTube ვიდეო' : 'ლინკი'}</div>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="lnk">${esc(link)}</a>` : '-'}
      ${shop ? `<div class="lbl" style="margin-top:8px">მაღაზია</div><a href="${esc(shop)}" target="_blank" rel="noopener" class="lnk">${esc(shop)}</a>` : ''}
      ${supplier ? `<div class="lbl" style="margin-top:8px">მომწოდებელი</div><a href="${esc(supplier)}" target="_blank" rel="noopener" class="lnk">${esc(supplier)}</a>` : ''}</div>
    </div>
    ${p.specs ? `<div><div class="row spread"><div class="lbl">მახასიათებლები</div><button class="btn ghost sm" id="m-copy">კოპირება</button></div><div class="specs">${esc(p.specs)}</div></div>` : ''}`;
}

// ერთი დიზაინის ყველა პროდუქტი ერთ ფანჯარაში: ფოტოები, ლინკები, ფასი, მახასიათებლები + ყველაფრის კოპირება
function groupText(g) {
  return g.map((p, i) => [`${i + 1}. ${p.name}`, isPromo(p.style) ? `ძველი ფასი: ${p.oldPrice ? p.oldPrice + ' ₾' : '-'}` : '', `${isPromo(p.style) ? 'სააქციო ფასი' : 'ფასი'}: ${p.price ? p.price + ' ₾' : '-'}`, `ლინკი: ${p.link || '-'}`, p.shop ? `მაღაზია: ${p.shop}` : '', `მომწოდებელი: ${p.supplier || '-'}`, `მახასიათებლები:\n${p.specs || '-'}`].filter(Boolean).join('\n')).join('\n\n');
}
function viewGroup(k) {
  const g = groupsOf(S.products.filter(p => gid(p) === k))[0]; if (!g) return;
  const p0 = g[0], m = mgr(p0.managerId);
  const box = modal(`<div class="stack">
    <div><span class="sbadge s${esc(p0.style)}">${esc(STYLES[p0.style]?.name || '')}</span></div>
    <h2 style="font-size:24px">ერთი დიზაინი · ${g.length} პროდუქტი</h2>
    <div class="muted">${esc(m?.brand || p0.brand)} · გამოგზავნა: <b>${esc(m?.fullName || p0.managerName)}</b></div>
    <div class="row"><button class="btn orange" id="g-copy">ყველაფრის კოპირება</button><button class="btn ghost" id="g-dl">ყველა ფოტოს ჩამოტვირთვა</button></div>
    ${g.map((p, i) => { const link = safeUrl(p.link), shop = safeUrl(p.shop), sup = safeUrl(p.supplier); return `<div class="gitem ${p.cancelled ? 'cancelled' : ''}">
      <div class="row spread"><b style="font-size:17px">${i + 1}. ${esc(p.name)}</b><span class="price">${oldTxt(p)}${p.price ? esc(p.price) + ' ₾' : '-'}</span></div>
      ${p.cancelled ? '<span class="badge b-missed">გაუქმებულია</span>' : ''}
      ${p.images?.length ? `<div class="gimgs">${p.images.map((s, j) => `<a href="${s}" download="${esc(p.name)}_${j + 1}.jpg" title="ჩამოტვირთვა"><img src="${s}" alt=""></a>`).join('')}</div>` : ''}
      <div class="glinks"><span class="lbl">${STYLES[p.style]?.link === 'youtube' ? 'YouTube' : 'ლინკი'}</span>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="lnk">${esc(link)}</a>` : '-'}
      ${shop ? `<span class="lbl">მაღაზია</span><a href="${esc(shop)}" target="_blank" rel="noopener" class="lnk">${esc(shop)}</a>` : ''}
      <span class="lbl">მომწოდებელი</span>${sup ? `<a href="${esc(sup)}" target="_blank" rel="noopener" class="lnk">${esc(sup)}</a>` : '-'}</div>
      ${p.specs ? `<div class="specs">${esc(p.specs)}</div>` : ''}
    </div>`; }).join('')}
  </div>`, true);
  $('#g-copy', box).addEventListener('click', () => copy(groupText(g)));
  $('#g-dl', box).addEventListener('click', () => $$('.gimgs a', box).forEach((a, i) => setTimeout(() => a.click(), i * 300)));
}

// ყველასთვის: პროდუქტი / დღის პოსტები (მხოლოდ სანახავად)
function viewProduct(id) {
  const p = findItem(id); if (!p) return;
  const box = modal(`<div class="stack">${detailsHtml(p)}${p.our ? '' : notesHtml(pkey(p))}${postTextHtml(p)}${!p.our && canNote() ? `<div><button class="btn ghost sm" data-note="${pkey(p)}">✎ დაწერა</button></div>` : ''}</div>`, true);
  $('#m-copy', box)?.addEventListener('click', () => copy(p.specs));
  bindNotes(box);
}
function postTextHtml(p) {
  return p.postText ? `<div><div class="lbl">პოსტის ტექსტი</div><div class="specs">${esc(p.postText)}</div></div>` : '';
}
function viewDay(ds) {
  const inf = dayInfo(ds);
  const box = modal(`<div class="stack">
    <h2 style="font-size:24px">${esc(niceDate(ds))}</h2>
    ${inf.tag ? `<div><span class="badge ${inf.cls === 'posted' ? 'b-posted' : inf.cls === 'missed' ? 'b-missed' : inf.cls === 'planned' ? 'b-planned' : 'b-day'}">${inf.tag}</span></div>` : ''}
    ${inf.items.length ? inf.items.map(p => {
      const m = mgr(p.managerId); const [st, cls] = STATUS[p.status] || STATUS.new;
      return `<article class="post">
        <div class="row spread"><b class="post-t">${esc(p.name)}</b><span class="badge ${cls}">${st}</span></div>
        <div class="muted small">${p.our ? `${BRAND.nameGen} პოსტი · ${esc(p.time || '')} · ${esc(p.where || '')}` : `${esc(m?.brand || p.brand)} · ${esc(m?.fullName || p.managerName)} · ${esc(STYLES[p.style]?.name || '')}`}</div>
        ${p.images?.length && !pastMonth(ds) ? `<div class="big-imgs">${p.images.map(s => `<img src="${s}" alt="">`).join('')}</div>` : ''}
        ${videosHtml(p)}
        ${linksHtml(p)}
        ${notesHtml(p)}
        ${isSales() && approved(S.user) && p.our ? `<div><button class="btn ghost sm" data-note="${p.key}">✎ დაწერა</button></div>` : ''}
        ${p.postText ? `<div class="specs">${esc(p.postText)}</div>` : p.specs ? `<div class="specs">${esc(p.specs)}</div>` : ''}
      </article>`;
    }).join('') : '<div class="empty">ამ დღეს პოსტი არ არის</div>'}
  </div>`, true);
  bindNotes(box);
}

function editProduct(id) {
  const p = S.products.find(x => x.id === id); if (!p) return;
  const keepDraft = S.draftImgs; S.draftImgs = [...(p.images || [])];
  const linkYt = STYLES[p.style]?.link === 'youtube';
  const box = modal(`<form class="stack" id="eform">
    <h2>შესწორება</h2>
    <div class="note small">${confirmBadge(p)} · სტილი: ${esc(STYLES[p.style]?.name || '')}</div>
    <label class="f">${linkYt ? 'YouTube ვიდეოს ლინკი *' : '1. ჩვენი მაღაზიის პროდუქტის ლინკი (' + BRAND.shopHost + ') *'}<input type="url" name="link" required value="${esc(p.link)}"></label>
    ${linkYt ? `<label class="f">პროდუქტის ლინკი ${BRAND.shopHost}-ზე<input type="url" name="shop" value="${esc(p.shop || '')}"></label>` : ''}
    <label class="f">2. მომწოდებლის მაღაზიის პროდუქტის ლინკი *<input type="url" name="supplier" required value="${esc(p.supplier || '')}"></label>
    <label class="f">3. პროდუქტის დასახელება *<input type="text" name="name" required value="${esc(p.name)}"></label>
    <div class="f">სურათები * (მაქს. 3)</div>
    <div class="imgs" id="imgs"></div>
    <label class="f">მახასიათებლები / ტექსტი *<textarea name="specs" required>${esc(p.specs)}</textarea></label>
    ${isPromo(p.style) ? `<label class="f">ძველი ფასი (₾) *<input type="text" name="old" required value="${esc(p.oldPrice || '')}"></label>` : ''}
    <label class="f">${isPromo(p.style) ? '<span class="promo-lbl">სააქციო ფასი (₾) *</span>' : 'ფასი (₾) *'}<input type="text" name="price" required value="${esc(p.price)}"></label>
    <div class="err" id="eerr"></div>
    <div class="row"><button class="btn">შენახვა</button></div>
  </form>`, true);
  drawImgs(box);
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) S.draftImgs = keepDraft; });
  $('#eform', box).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target); const g = k => (f.get(k) || '').trim();
    if (!S.draftImgs.length) return $('#eerr', box).textContent = 'დაამატე მინიმუმ ერთი სურათი.';
    if (linkYt ? !/youtu\.?be/i.test(g('link')) : !shopOk(g('link'))) return $('#eerr', box).textContent = linkYt ? 'საჭიროა YouTube ვიდეოს ლინკი.' : 'ჩასვი პროდუქტის ლინკი ' + BRAND.shopHost + '-დან.';
    if (!safeUrl(g('supplier'))) return $('#eerr', box).textContent = 'მომწოდებლის ლინკი არასწორია (უნდა იწყებოდეს https://).';
    if (!priceOk(g('price'))) return $('#eerr', box).textContent = 'ფასი ციფრებით ჩაწერე (მაგ. 249).';
    if (isPromo(p.style) && !priceOk(g('old'))) return $('#eerr', box).textContent = 'ძველი ფასი ციფრებით ჩაწერე (მაგ. 299).';
    // ახალი პროდუქტის ფორმის სურათები ბრუნდება შენახვამდე (შენახვა ხელახლა ხატავს ფორმას)
    const imgs = S.draftImgs; S.draftImgs = keepDraft;
    try { await S.store.updateProduct(p.id, { name: g('name'), link: g('link'), shop: g('shop'), supplier: g('supplier'), specs: g('specs'), price: g('price'), ...(isPromo(p.style) ? { oldPrice: g('old') } : {}), images: imgs }); closeModal(); toast('შესწორდა. არ დაგავიწყდეს დადასტურება ✓'); }
    catch (e) { S.draftImgs = imgs; $('#eerr', box).textContent = errText(e); }
  });
}

function viewLocked(id) {
  const p = S.products.find(x => x.id === id); if (!p) return;
  const box = modal(`<div class="stack">${detailsHtml(p)}<div class="note small">🔒 გამოგზავნილია და დაკეტილია. შესწორება: მარკეტინგის მენეჯერთან.</div></div>`, true);
  $('#m-copy', box)?.addEventListener('click', () => copy(p.specs));
}
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('დაკოპირდა'); } catch { toast('ვერ დაკოპირდა'); } }

// მარკეტინგი: ჩვენი პოსტის ტექსტის რედაქტირება
function openOur(id) {
  const p = findItem(id); if (!p) return;
  const [st, cls] = STATUS[p.status] || STATUS.planned;
  const box = modal(`<div class="stack">
    <div><span class="badge ${cls}">${st}${p.date ? ': ' + esc(niceDate(p.date)) + ' ' + esc(p.time || '') : ''}</span></div>
    <h2 style="font-size:24px">${esc(p.name)}</h2>
    <div class="muted small">${BRAND.nameGen} პოსტი · ${esc(p.where || '')}</div>
    ${p.images?.length && !pastMonth(p.date) ? `<div class="big-imgs post-imgs">${p.images.map(s => `<img src="${s}" alt="">`).join('')}</div>` : ''}
    ${videosHtml(p)}
    ${linksHtml(p)}
    <label class="f">პოსტის ტექსტი<textarea id="o-text" style="min-height:280px">${esc(p.postText || '')}</textarea></label>
    <div class="row"><button class="btn" id="o-save">შენახვა</button><span class="muted small">ცვლილება მთავარ გვერდზეც გამოჩნდება</span></div>
  </div>`, true);
  $('#o-save', box).addEventListener('click', async () => {
    try { await S.store.updatePost(p.key, { text: $('#o-text', box).value.trim() }); closeModal(); toast('ტექსტი შენახულია'); } catch (e) { toast(errText(e)); }
  });
}

function openProduct(id) {
  if (String(id).startsWith('our-')) return isAdmin() ? openOur(id) : viewDay(findItem(id)?.date);
  const p = S.products.find(x => x.id === id); if (!p) return;
  const box = modal(`<div class="stack">${detailsHtml(p)}${notesHtml(pkey(p))}
    <div class="row" style="justify-content:flex-end"><button class="btn danger sm" id="m-del">ბაზიდან წაშლა</button></div>
  </div>`, true);
  bindNotes(box);
  $('#m-copy', box)?.addEventListener('click', () => copy(p.specs));
  $('#m-del', box).addEventListener('click', async () => { if (!await ask('წავშალო ეს პროდუქტი ბაზიდან?')) return; await S.store.deleteProduct(p.id); closeModal(); toast('წაიშალა'); });
}

function openManager(id) {
  const m = mgr(id); if (!m) return;
  const P = S.products.filter(p => p.managerId === id).sort(byNew);
  const box = modal(`<div class="stack">
    <div class="row"><span class="av lg">${esc(initials(m.fullName))}</span><div><h2 style="font-size:24px">${esc(m.brand)}</h2><div class="muted">${esc(m.fullName)} · მომხმარებელი: ${esc(m.username || '')}</div></div></div>
    <div class="tcats">${(m.cats || []).map(x => `<span>${esc(x)}</span>`).join('')}</div>
    <div class="lbl">გამოგზავნილი (${groupsOf(P).length})</div>
    <div class="tbl">${P.length ? groupsOf(P).map(g => {
      if (g.length > 1) {
        const img = g.find(p => p.images?.[0])?.images[0], p0 = g[0];
        return `<div class="gbox">
        <div class="ghd"><b>ერთი დიზაინი</b><span class="gcnt">${g.length} პროდუქტი</span><small>${esc(STYLES[p0.style]?.name || '')} · ${p0.createdAt ? esc(shortDate(iso(new Date(p0.createdAt)))) : ''}</small></div>
        ${g.map(p => { const im = p.images?.[0]; return `<button class="trow" data-prod="${p.id}">
          <span class="thumb" style="${im ? `background-image:url('${im}')` : ''}"></span>
          <span class="tname"><b>${esc(p.name)}</b><small>${oldTxt(p)}${p.price ? esc(p.price) + ' ₾' : ''}</small></span>
          <span></span>
          <span class="muted small">${p.cancelled ? '<span class="badge b-missed">გაუქმებულია</span>' : ''}</span>
        </button>`; }).join('')}
      </div>`;
      }
      const p = g[0], img = p.images?.[0];
      return `<button class="trow" data-prod="${p.id}">
        <span class="thumb" style="${img ? `background-image:url('${img}')` : ''}"></span>
        <span class="tname"><b>${esc(p.name)}</b><small>${esc(STYLES[p.style]?.name || '')} · ${oldTxt(p)}${p.price ? esc(p.price) + ' ₾' : ''}</small></span>
        <span></span>
        <span class="muted small">${p.cancelled ? '<span class="badge b-missed">გაუქმებულია</span>' : p.createdAt ? esc(shortDate(iso(new Date(p.createdAt)))) : ''}</span>
      </button>`;
    }).join('') : '<div class="empty">ჯერ არაფერი გამოუგზავნია</div>'}</div>
  </div>`, true);
  $$('[data-prod]', box).forEach(b => b.addEventListener('click', () => openProduct(b.dataset.prod)));
}

function openDay(ds) {
  const inf = dayInfo(ds);
  const box = modal(`<div class="stack">
    <h2 style="font-size:24px">${esc(niceDate(ds))}</h2>
    ${inf.tag ? `<div><span class="badge ${inf.cls === 'posted' ? 'b-posted' : inf.cls === 'missed' ? 'b-missed' : inf.cls === 'planned' ? 'b-planned' : 'b-day'}">${inf.tag}</span></div>` : ''}
    <div class="tbl">${inf.items.length ? inf.items.map(p => `<button class="trow" data-prod="${p.id}"><span class="thumb" style="${p.images?.[0] && !pastMonth(ds) ? `background-image:url('${p.images[0]}')` : ''}"></span><span class="tname"><b>${esc(p.name)}</b><small>${esc(p.time || '')} · ${esc(p.where || '')}</small></span><span>✎</span><span class="badge ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span></button>`).join('') : '<div class="empty">ამ დღეს პოსტი არ არის დაგეგმილი</div>'}</div>
  </div>`);
  $$('[data-prod]', box).forEach(b => b.addEventListener('click', () => openOur(b.dataset.prod)));
}

function daysForm() {
  const days = [1, 2, 3, 4, 5, 6, 0];
  const box = modal(`<div class="stack">
    <h2>პოსტის დღეები</h2>
    <div class="muted">ეს დღეები ყოველ კვირას კალენდარში მწვანედ ჩანს.</div>
    <div class="filters">${days.map(d => `<button class="pill ${S.settings.postDays.includes(d) ? 'on' : ''}" data-pday="${d}">${DOW_FULL[d]}</button>`).join('')}</div>
    <div><button class="btn" data-close>მზადაა</button></div>
  </div>`);
  $$('[data-pday]', box).forEach(b => b.addEventListener('click', async () => {
    const d = Number(b.dataset.pday); const set = new Set(S.settings.postDays);
    set.has(d) ? set.delete(d) : set.add(d);
    b.classList.toggle('on');
    await S.store.saveSettings({ postDays: [...set] });
  }));
}

// ───────── მოვლენები ─────────
function drawImgs(root = document) {
  const box = $('#imgs', root); if (!box) return;
  box.innerHTML = S.draftImgs.map((src, i) => `<div><img src="${src}" alt=""><button type="button" data-rmimg="${i}" aria-label="წაშლა">×</button></div>`).join('')
    + (S.draftImgs.length < 3 ? `<label class="drop">+<span>სურათი</span><input type="file" accept="image/*" multiple id="pfile" hidden></label>` : '');
  $$('[data-rmimg]', box).forEach(b => b.addEventListener('click', () => { S.draftImgs.splice(Number(b.dataset.rmimg), 1); drawImgs(root); }));
  $('#pfile', box)?.addEventListener('change', async (ev) => {
    for (const f of [...ev.target.files].slice(0, 3 - S.draftImgs.length)) { try { S.draftImgs.push(await shrink(f)); } catch (e) { toast(e.message); } }
    drawImgs(root);
  });
}

// იმპორტი: Claude ამზადებს import/posts.json + სურათებს (ლოკალურად, GitHub-ზე არ იტვირთება) და აქედან ჩაიწერება ბაზაში
async function importPosts() {
  let base = 'import/', r = await fetch('import/posts.json', { cache: 'no-cache' }).catch(() => null);
  if (!r || !r.ok) { base = ''; r = await fetch('posts.json', { cache: 'no-cache' }).catch(() => null); }
  if (!r || !r.ok) return toast('იმპორტის ფაილი ვერ მოიძებნა (import/posts.json)');
  const list = await r.json();
  if (!await ask(`ჩავწერო ბაზაში ${list.length} პოსტი?`)) return;
  const toData = async src => { if (src.startsWith('data:')) return src; const b = await (await fetch((src.startsWith('posts/') && base ? base : '') + src)).blob(); return shrink(b, 900, 0.82); };
  let n = 0;
  for (const o of list) {
    const id = String(o.id || '').replace(/[^a-z0-9_-]/gi, '_'); if (!id) continue;
    const images = []; for (const src of o.images || []) { try { images.push(await toData(src)); } catch {} }
    const old = S.ours.find(x => x.id === id) || {};
    const sc = S.settings.ourSchedule?.[id] || {};
    // ახალი მონაცემი იგებს; რაც ფაილში არ წერია (მაგ. მარკეტინგის თარიღი), ძველი რჩება
    await S.store.setPost(id, {
      title: o.title || old.title || '',
      text: o.text || S.settings.ourEdits?.[id] || old.text || '',
      date: o.date || ('date' in sc ? sc.date : old.date) || null,
      time: o.date ? (o.time || '12:00') : (sc.time || old.time || o.time || '12:00'),
      style: String(o.style || old.style || '1'), where: o.where || old.where || '',
      images: images.length ? images : (old.images || []),
      links: (o.links && o.links.length) ? o.links : (old.links || []),
      videos: (o.videos && o.videos.length) ? o.videos : (old.videos || []),
      status: o.status || old.status || 'planned', productId: o.productId || old.productId || null, updatedAt: Date.now() });
    n++;
  }
  if (S.settings.ourSchedule || S.settings.ourEdits) await S.store.saveSettings({ ourSchedule: {}, ourEdits: {} });
  toast(`ჩაიწერა ${n} პოსტი`);
}

// 6 თვეზე ძველი პოსტები, ბრენდ მენეჯერების ატვირთვები და შენიშვნები ავტომატურად იშლება (ადგილი თავისუფლდება).
// მუშაობს, როცა მარკეტინგი საიტზე შედის (წაშლის უფლება მხოლოდ მას აქვს). ვიდეოები Drive-ზე რჩება.
async function cleanupOld() {
  if (!isAdmin() || S.cleaned) return; S.cleaned = true;
  const lim = new Date(); lim.setMonth(lim.getMonth() - 6); const limMs = lim.getTime(), limIso = iso(lim);
  let n = 0;
  try {
    for (const o of S.ours) if (o.date && o.date < limIso) { await S.store.deletePost(o.id); n++; }
    for (const p of S.products) if ((p.createdAt || Date.now()) < limMs) { await S.store.deleteProduct(p.id); n++; }
    for (const x of S.notes) if ((x.createdAt || Date.now()) < limMs) { await S.store.deleteNote(x.id); n++; }
  } catch (e) { console.warn('cleanup', e); }
  if (n) toast(`6 თვეზე ძველი ${n} ჩანაწერი წაიშალა`);
}

async function moveManager(id, dir) {
  const ms = brandMgrs().filter(approved).sort(byOrder);
  const i = ms.findIndex(m => m.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= ms.length) return;
  // ყველას ახალი რიგი ენიჭება, რომ ერთნაირი რიცხვები არ დარჩეს
  const re = ms.map(m => m.id); [re[i], re[j]] = [re[j], re[i]];
  for (let k = 0; k < re.length; k++) { const m = mgr(re[k]); if (m.order !== k) await S.store.updateManager(re[k], { order: k }); }
}

// თარიღის ამრჩევი: პოსტის სტილის დღეები (BRAND.styles[x].day) წითლადაა მონიშნული
function openDatePicker(btn) {
  $('.dp-pop')?.remove();
  const key = btn.dataset.dpick, st = STYLES[btn.dataset.dstyle], sday = st?.day;
  const inp = $(`[data-rdate="${key}"]`);
  let cur = inp.value ? fromIso(inp.value) : new Date(); cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const pop = document.createElement('div'); pop.className = 'dp-pop';
  const draw = () => {
    const y = cur.getFullYear(), m = cur.getMonth(), first = (new Date(y, m, 1).getDay() + 6) % 7, nd = new Date(y, m + 1, 0).getDate();
    const today = todayIso(); let cells = '';
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= nd; d++) {
      const ds = iso(new Date(y, m, d)), wd = new Date(y, m, d).getDay();
      const cls = ['dp-d', sday === wd ? 'dp-style' : '', ds === inp.value ? 'dp-sel' : '', ds === today ? 'dp-today' : ''].join(' ');
      cells += ds < today ? `<span class="dp-d dp-past">${d}</span>` : `<button type="button" class="${cls}" data-dpd="${ds}">${d}</button>`;
    }
    pop.innerHTML = `<div class="dp-head"><button type="button" data-dpm="-1">‹</button><b>${MONTHS[m]} ${y}</b><button type="button" data-dpm="1">›</button></div>
      <div class="dp-grid">${DOW.map(x => `<span class="dp-w">${x}</span>`).join('')}${cells}</div>
      ${st && sday != null ? `<div class="dp-leg"><i></i>${esc(st.name)}: ${DOW_FULL[sday]}</div>` : ''}`;
  };
  draw();
  pop.addEventListener('click', e => {
    e.stopPropagation();
    const mv = e.target.closest('[data-dpm]'), dd = e.target.closest('[data-dpd]');
    if (mv) { cur = new Date(cur.getFullYear(), cur.getMonth() + Number(mv.dataset.dpm), 1); draw(); }
    if (dd) { inp.value = dd.dataset.dpd; S.dpDraft[key] = dd.dataset.dpd; btn.textContent = '📅 ' + niceDate(dd.dataset.dpd); close(); }
  });
  const r = btn.getBoundingClientRect();
  pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
  pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - 300)) + 'px';
  document.body.appendChild(pop);
  const close = () => { pop.remove(); document.removeEventListener('click', close); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('click', close); document.addEventListener('keydown', onKey); });
}

function bind() {
  $$('[data-mode]').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; render(); window.scrollTo(0, 0); }));
  $('#logout')?.addEventListener('click', () => { const n = new Date(); S.month = { y: n.getFullYear(), m: n.getMonth() }; S.store.logout(); });
  $$('[data-mon]').forEach(b => b.addEventListener('click', () => {
    const k = Number(b.dataset.mon);
    if (!k) { const n = new Date(); S.month = { y: n.getFullYear(), m: n.getMonth() }; return render(); }
    let { y, m } = S.month; m += k;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    S.month = { y, m }; render();
  }));
  const edit = isAdmin() && S.mode === 'mkt';
  $$('[data-day]').forEach(b => b.addEventListener('click', () => edit ? openDay(b.dataset.day) : viewDay(b.dataset.day)));
  $$('.wrap [data-prod]').forEach(b => b.addEventListener('click', (e) => { if (e.target.closest('[data-stop]')) return; const id = b.dataset.prod; if (id.startsWith('our-')) return edit ? openOur(id) : viewDay(findItem(id)?.date); edit ? openProduct(id) : viewProduct(id); }));
  $$('[data-view]').forEach(b => b.addEventListener('click', () => viewLocked(b.dataset.view)));
  $$('[data-filter]').forEach(b => b.addEventListener('click', () => { S.filter = b.dataset.filter; render(); }));
  $('#days-btn')?.addEventListener('click', daysForm);
  $$('[data-sday]').forEach(b => b.addEventListener('click', async () => {
    const d = Number(b.dataset.sday); const set = new Set(S.settings.postDays);
    set.has(d) ? set.delete(d) : set.add(d);
    try { await S.store.saveSettings({ postDays: [...set] }); toast('განრიგი შეიცვალა'); } catch (e) { toast(errText(e)); }
  }));
  $('#reload')?.addEventListener('click', () => location.reload());
  $('#start-work')?.addEventListener('click', async () => {
    const picked = S.products.filter(p => p.pick && p.confirmed && !p.cancelled);
    if (!picked.length) return;
    if (!await ask(`გავუგზავნო Claude-ს ${picked.length} პროდუქტი სამუშაოდ?`)) return;
    try { await S.store.saveSettings({ workRequest: { at: Date.now(), status: 'waiting', ids: picked.map(p => p.id) } }); toast('გაიგზავნა Claude-სთვის'); } catch (e) { toast(errText(e)); }
  });
  $$('[data-pick]').forEach(c => c.addEventListener('change', async () => {
    try { for (const id of c.dataset.pick.split(',')) await S.store.updateProduct(id, { pick: c.checked }); toast(c.checked ? 'მოინიშნა: ამაზე ვიმუშავებთ' : 'მონიშვნა მოიხსნა'); } catch (e) { toast(errText(e)); c.checked = !c.checked; }
  }));
  $('#import-posts')?.addEventListener('click', importPosts);
  $$('[data-rclear]').forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.rclear;
    try { await S.store.updatePost(k, { date: null }); toast('თარიღი მოიხსნა: კალენდარში აღარ არის'); } catch (e) { toast(errText(e)); }
  }));
  $$('[data-dpick]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openDatePicker(b); }));
  $$('[data-rsave]').forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.rsave;
    const date = $(`[data-rdate="${k}"]`).value, time = $(`[data-rtime="${k}"]`).value || '12:00';
    if (!date) return toast('აირჩიე თარიღი');
    if (date < todayIso()) return toast('წარსული თარიღი არ შეიძლება');
    try { await S.store.updatePost(k, { date, time }); delete S.dpDraft[k]; toast('თარიღი შენახულია: ' + niceDate(date) + ' ' + time); } catch (e) { toast(errText(e)); }
  }));
  $$('[data-mgr]').forEach(b => b.addEventListener('click', () => openManager(b.dataset.mgr)));
  $$('[data-medit]').forEach(b => b.addEventListener('click', () => managerForm(mgr(b.dataset.medit))));
  $$('[data-mup]').forEach(b => b.addEventListener('click', () => moveManager(b.dataset.mup, -1)));
  $$('[data-mdown]').forEach(b => b.addEventListener('click', () => moveManager(b.dataset.mdown, 1)));
  $$('[data-mok]').forEach(b => b.addEventListener('click', async () => {
    try { await S.store.updateManager(b.dataset.mok, { approved: true }); toast('დაშვებულია'); } catch (e) { toast(errText(e)); }
  }));
  $$('[data-mno]').forEach(b => b.addEventListener('click', async () => {
    const m = mgr(b.dataset.mno);
    if (!await ask(`უარი ვუთხრა ${m.fullName}-ს${m.brand ? ' (' + m.brand + ')' : ''}? რეგისტრაცია წაიშლება.`)) return;
    try { await S.store.deleteManager(m.id); toast('უარი ეთქვა'); } catch (e) { toast(errText(e)); }
  }));
  $$('[data-mdel]').forEach(b => b.addEventListener('click', async () => {
    const m = mgr(b.dataset.mdel);
    if (!await ask(`წავშალო ${m.fullName}${m.brand ? ' (' + m.brand + ')' : ''}? ვეღარ შევა თავის გვერდზე. მისი პროდუქტები სიაში დარჩება.`)) return;
    try { await S.store.deleteManager(m.id); toast('წაიშალა'); } catch (e) { toast(errText(e)); }
  }));
  $('#edit-me')?.addEventListener('click', () => managerForm(S.user));
  $$('[data-pedit]').forEach(b => b.addEventListener('click', () => editProduct(b.dataset.pedit)));
  $$('[data-pcancel]').forEach(b => b.addEventListener('click', async () => {
    if (!await ask('გააუქმო ეს პროდუქტი? წაშლა არ ხდება: წითლად დარჩება „გაუქმებულია“ და ეს უკან აღარ ბრუნდება.')) return;
    try { await S.store.updateProduct(b.dataset.pcancel, { cancelled: true, cancelledAt: Date.now() }); toast('გაუქმდა'); } catch (e) { toast(errText(e)); }
  }));
  $$('[data-pconfirm]').forEach(b => b.addEventListener('click', async () => {
    if (!await ask('ადასტურებ, რომ ყველაფერი 100% გადამოწმებულია? გამწვანდება და შეცვლა აღარ იქნება.')) return;
    try { await S.store.updateProduct(b.dataset.pconfirm, { confirmed: true, confirmedAt: Date.now() }); toast('დადასტურდა ✓'); } catch (e) { toast(errText(e)); }
  }));
  $('#new-prod')?.addEventListener('click', () => { S.showForm = !S.showForm; if (!S.showForm) { S.style = null; S.draftImgs = []; S.gImgs = [[]]; S.formDraft = null; } render(); if (S.showForm) $('#pform')?.scrollIntoView({ block: 'start' }); });
  $$('[data-style]').forEach(b => b.addEventListener('click', () => { keepForm(); S.style = b.dataset.style; render(); restoreForm(); }));
  drawImgs(); drawGImgs();
  $('#addp')?.addEventListener('click', () => {
    if (S.gImgs.length >= MAXP) return;
    keepForm(); S.gImgs.push([]); render(); restoreForm();
    $$('.pblock').at(-1)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  $$('[data-pbdel]').forEach(b => b.addEventListener('click', async () => {
    const i = Number(b.dataset.pbdel);
    if (!await ask(`ამოვიღო პროდუქტი ${i + 1}?`)) return;
    keepForm(); const d = S.formDraft || {}, nd = {};
    for (const [k, v] of Object.entries(d)) {
      const mm = k.match(/^(\w+)_(\d+)$/);
      if (!mm || !PFIELDS.includes(mm[1])) { nd[k] = v; continue; }
      const j = Number(mm[2]); if (j === i) continue;
      nd[`${mm[1]}_${j > i ? j - 1 : j}`] = v;
    }
    S.formDraft = nd; S.gImgs.splice(i, 1); render(); restoreForm();
  }));
  $$('[data-gtoggle]').forEach(r => r.addEventListener('click', (e) => {
    if (e.target.closest('[data-stop]')) return;
    const k = r.dataset.gtoggle;
    if (!e.target.closest('.gpm')) return viewGroup(k);
    const open = !S.open.has(k);
    open ? S.open.add(k) : S.open.delete(k);
    $('.gpm', r).textContent = open ? '−' : '+';
    $$(`[data-gof="${CSS.escape(k)}"]`, r.closest('tbody')).forEach(x => x.style.display = open ? '' : 'none');
  }));

  bindNotes(document);
  $$('[data-ourview]').forEach(b => b.addEventListener('click', () => { const p = findItem(b.dataset.ourview); if (!p) return; const box = modal(`<div class="stack"><h2>${esc(p.name)}</h2>${p.images?.length ? `<div class="big-imgs post-imgs">${p.images.map(s => `<img src="${s}" alt="">`).join('')}</div>` : ''}${videosHtml(p)}${notesHtml(p)}<div class="specs">${esc(p.postText || '')}</div></div>`, true); bindNotes(box); }));
  $$('[data-role]').forEach(b => b.addEventListener('click', () => { S.role = b.dataset.role; render(); }));
  $('#peoplereg')?.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const x = { role: ev.target.dataset.prole, fullName: f.get('fullName').trim(), username: f.get('username').trim().toLowerCase(), password: f.get('password') };
    if (!userOk(x.username)) return $('#serr').textContent = 'მომხმარებელი: ლათინური ასოები, ციფრები და . _ -, მინ. 3.';
    if (x.password.length < 6) return $('#serr').textContent = 'პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს.';
    try { await S.store.register(x); toast('მოგესალმებით, ' + x.fullName); window.scrollTo(0, 0); } catch (e) { $('#serr').textContent = errText(e); }
  });
  // შესვლა / რეგისტრაცია / ადმინი
  $('#loginform')?.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    try { await S.store.login(f.get('username'), f.get('password')); window.scrollTo(0, 0); } catch (e) { $('#lerr').textContent = errText(e); }
  });
  $('#regform')?.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const x = { role: 'brand', brand: f.get('brand').trim(), fullName: f.get('fullName').trim(), cats: f.getAll('cats'), username: f.get('username').trim().toLowerCase(), password: f.get('password') };
    const err = $('#rerr');
    if (!x.cats.length) return err.textContent = 'აირჩიე მინიმუმ ერთი მიმართულება.';
    if (!userOk(x.username)) return err.textContent = 'მომხმარებელი: ლათინური ასოები, ციფრები და . _ -, მინ. 3.';
    if (x.password.length < 6) return err.textContent = 'პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს.';
    try { await S.store.register(x); toast('მოგესალმებით, ' + x.fullName); window.scrollTo(0, 0); } catch (e) { err.textContent = errText(e); }
  });
  $('#adminform')?.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    try { await S.store.login(f.get('username'), f.get('password')); window.scrollTo(0, 0); } catch (e) { $('#aerr').textContent = errText(e); }
  });
  $('#setupform')?.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const u = f.get('username').trim().toLowerCase();
    if (!userOk(u)) return $('#aerr').textContent = 'მომხმარებელი: ლათინური ასოები, ციფრები და . _ -, მინ. 3.';
    if (String(f.get('password') || '').length < 6) return $('#aerr').textContent = 'პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს.';
    try { await S.store.setupAdmin({ username: u, password: f.get('password'), fullName: f.get('fullName').trim() }); S.hasAdmin = true; } catch (e) { $('#aerr').textContent = errText(e); }
  });

  $('#pform')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const m = S.user; if (!isBrand() || !approved(m) || !S.style) return;
    if (!m.cats?.length) { toast('ჯერ აირჩიე შენი მიმართულება'); return managerForm(m); }
    const f = new FormData(ev.target);
    const n = S.gImgs.length, err = $('#perr');
    const items = [];
    for (let i = 0; i < n; i++) {
      const g = k => (f.get(k + '_' + i) || '').trim(), pre = n > 1 ? `პროდუქტი ${i + 1}: ` : '';
      const data = { name: g('name'), link: g('link'), shop: g('shop'), supplier: g('supplier'), specs: g('specs'), price: g('price'), images: S.gImgs[i], style: S.style };
      if (isPromo(S.style)) { data.oldPrice = g('old'); if (!priceOk(data.oldPrice)) return err.textContent = pre + 'ძველი ფასი ციფრებით ჩაწერე (მაგ. 299).'; }
      if (!data.images.length) return err.textContent = pre + 'დაამატე მინიმუმ ერთი სურათი.';
      if (STYLES[S.style].link === 'youtube' && !/youtu\.?be/i.test(data.link)) return err.textContent = pre + '„' + STYLES[S.style].name + '“ სტილს სჭირდება YouTube ვიდეოს ლინკი.';
      if (STYLES[S.style].link === 'shop' && !shopOk(data.link)) return err.textContent = pre + 'ჩასვი პროდუქტის ლინკი ' + BRAND.shopHost + '-დან.';
      if (!safeUrl(data.supplier)) return err.textContent = pre + 'მომწოდებლის ლინკი არასწორია (უნდა იწყებოდეს https://).';
      if (!priceOk(data.price)) return err.textContent = pre + 'ფასი ციფრებით ჩაწერე (მაგ. 249).';
      items.push(data);
    }
    err.textContent = '';
    const verified = f.get('verified') === 'on';
    const what = n > 1 ? `1 დიზაინი, ${n} პროდუქტი` : '1 პროდუქტი';
    if (!await ask(verified ? `გამოვაგზავნო (${what})? მონიშნული გაქვს „100% გადამოწმებულია“: შეცვლა აღარ იქნება.` : `გამოვაგზავნო (${what})? 3 საათში უნდა დაადასტურო, რომ ყველაფერი სწორია.`)) return;
    $('#psubmit').disabled = true;
    // ერთი დიზაინის პროდუქტებს საერთო groupId აქვთ: ასე ჩანს, რომ ერთ პოსტში შედის
    const grp = n > 1 ? { groupId: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), groupSize: n } : {};
    const now = Date.now();
    try {
      for (let i = 0; i < n; i++) await S.store.addProduct({ ...items[i], ...grp, ...(n > 1 ? { groupIdx: i } : {}), managerId: m.uid, managerName: m.fullName, brand: m.brand, status: 'new', date: null, createdAt: now, ...(verified ? { confirmed: true, confirmedAt: now } : {}) });
      S.draftImgs = []; S.gImgs = [[]]; S.style = null; S.formDraft = null; S.showForm = false;
      toast('გამოიგზავნა ✓'); render();
    } catch (e) { err.textContent = errText(e); $('#psubmit').disabled = false; }
  });
}
function keepForm() { const fm = $('#pform'); if (fm) S.formDraft = Object.fromEntries(new FormData(fm)); }
function restoreForm() { const fm = $('#pform'); if (!fm || !S.formDraft) return; for (const [k, v] of Object.entries(S.formDraft)) if (fm.elements[k] && typeof v === 'string') fm.elements[k].value = v; }

// ───────── გაშვება ─────────
// პოსტის სურათზე დაჭერა: დიდად, მთელ ეკრანზე (დაჭერით ან Esc-ით იხურება)
document.addEventListener('click', e => {
  const img = e.target.closest('.post-imgs img, .post .big-imgs img'); if (!img) return;
  e.preventDefault(); e.stopPropagation();
  const w = document.createElement('div'); w.className = 'zoom';
  w.innerHTML = `<img src="${img.src}" alt=""><button type="button" aria-label="დახურვა">×</button>`;
  const close = () => { w.remove(); document.removeEventListener('keydown', key, true); };
  const key = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
  w.addEventListener('click', ev => { ev.stopPropagation(); close(); }); document.addEventListener('keydown', key, true);
  document.body.appendChild(w);
}, true);

// Esc: ჯერ კითხვა (= „არა“), მერე ფანჯარა იხურება (სურათის გადიდებას თავისი Esc აქვს)
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const a = $('#askbox'); if (a) return a.click();
  $('#modal [data-close]')?.click();
});

(async function main() {
  const now = new Date(); S.month = { y: now.getFullYear(), m: now.getMonth() };
  app.innerHTML = '<div class="empty">იტვირთება…</div>';
  try { S.store = await createStore(); } catch (e) { app.innerHTML = `<div class="empty">ვერ ჩაიტვირთა: ${esc(e.message)}</div>`; return; }
  // ფორმის შევსებისას ახალი მონაცემი ფორმას არ შლის
  setInterval(() => { if (!$('#modal')) safeRender(); }, 60000);
  const safeRender = () => { if ($('#pform')) { keepForm(); render(); restoreForm(); } else if ($('#regform') || $('#peoplereg') || $('#loginform') || $('#adminform') || $('#setupform')) { /* ფორმა ივსება */ } else render(); };
  S.store.watchSettings(v => { S.settings = { postDays: BRAND.postDays || [2, 5], ...v }; safeRender(); });
  // პროდუქტები ყველასთვის ჩანს (მთავარი გვერდი)
  S.store.onAuth(async (u) => {
    S.user = u;
    // იგივე ადამიანი იგივე უფლებით: მხოლოდ ხელახლა ხატვა; დაშვება შეეცვალა: მონაცემები თავიდან
    const key = u ? u.uid + ':' + (u.role === 'admin' || approved(u)) : '';
    if (key === S.authKey && S.ready) return safeRender();
    S.authKey = key;
    S.unsub.forEach(f => f && f()); S.unsub = []; S.managers = []; S.style = null; S.draftImgs = [];
    S.products = []; S.notes = []; S.ours = [];
    if (u && (u.role === 'admin' || approved(u))) { S.unsub.push(S.store.watchProducts(v => { S.products = v; safeRender(); })); S.unsub.push(S.store.watchNotes(v => { S.notes = v; safeRender(); })); S.unsub.push(S.store.watchPosts(v => { S.ours = v; safeRender(); })); }
    if (!u) { S.hasAdmin = await S.store.hasAdmin().catch(() => true); S.mode = 'home'; }
    if (u?.role === 'admin') {
      S.mode = 'mkt';
      S.unsub.push(S.store.watchManagers(v => { S.managers = v; safeRender(); }));
      setTimeout(cleanupOld, 8000); // მონაცემები ჯერ ჩაიტვირთოს
    } else if (u?.role === 'brand') S.mode = 'brand';
    else if (u?.role === 'sales') S.mode = 'sales';
    else S.mode = 'home';
    S.ready = true; render();
  });
})();
