// მონაცემების ფენა: Firebase (გუნდისთვის საერთო) ან სადემო (localStorage).
// შესვლა: მომხმარებელი + პაროლი. როლები: admin (მარკეტინგი) და brand (ბრენდ მენეჯერი).
import { firebaseConfig, BRAND } from './config.js?v=52';

export const DEMO = !firebaseConfig.apiKey;
const DEFAULT_SETTINGS = { postDays: BRAND.postDays || [2, 5] }; // 2 = სამშაბათი, 5 = პარასკევი
const DOMAIN = BRAND.loginDomain || 'team.local';
const clean = u => String(u || '').trim().toLowerCase();

async function hash(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const fail = (code, msg) => Object.assign(new Error(msg), { code });

// ───────── სადემო (მხოლოდ ამ ბრაუზერში) ─────────
function demoStore() {
  const K = (BRAND.storageKey || 'mkt') + '_plan_v3';
  const load = () => {
    try { const d = JSON.parse(localStorage.getItem(K)); if (d) return d; } catch {}
    return { settings: DEFAULT_SETTINGS, users: {}, products: {}, notes: {}, posts: {} };
  };
  let data = load();
  data.notes = data.notes || {};
  data.posts = data.posts || {};
  const save = () => { try { localStorage.setItem(K, JSON.stringify(data)); } catch { alert('მეხსიერება გაივსო: სურათი ძალიან დიდია.'); } };
  const subs = new Set();
  const emit = () => subs.forEach(f => f());
  const id = () => Math.random().toString(36).slice(2, 10);
  let authCb = null;
  const me = () => { const uid = localStorage.getItem((BRAND.storageKey || 'mkt') + '_session'); const u = uid && data.users[uid]; return u ? { uid, ...u } : null; };
  const pub = u => { const { pw, ...rest } = u; return rest; };
  const tell = () => { const u = me(); authCb && authCb(u ? pub(u) : null); };
  const findUser = (username) => Object.entries(data.users).find(([, u]) => u.username === clean(username));
  const on = (fn) => { subs.add(fn); setTimeout(fn); return () => subs.delete(fn); };
  return {
    demo: true,
    onAuth(cb) { authCb = cb; setTimeout(tell); },
    async hasAdmin() { return Object.values(data.users).some(u => u.role === 'admin'); },
    async setupAdmin({ username, password, fullName }) {
      if (await this.hasAdmin()) throw fail('exists', 'ადმინი უკვე არსებობს');
      const uid = 'u_' + id();
      data.users[uid] = { username: clean(username), pw: await hash(clean(username) + ':' + password), role: 'admin', fullName, createdAt: Date.now() };
      save(); localStorage.setItem((BRAND.storageKey || 'mkt') + '_session', uid); tell(); emit();
    },
    async register({ username, password, brand, fullName, cats, role }) {
      if (findUser(username)) throw fail('auth/email-already-in-use', 'taken');
      const uid = 'u_' + id();
      data.users[uid] = { username: clean(username), pw: await hash(clean(username) + ':' + password), role: ['sales', 'leader'].includes(role) ? role : 'brand', approved: false, brand: brand || '', fullName, cats: cats || [], order: Date.now(), createdAt: Date.now() };
      save(); localStorage.setItem((BRAND.storageKey || 'mkt') + '_session', uid); tell(); emit();
    },
    async login(username, password) {
      const f = findUser(username);
      if (!f || f[1].pw !== await hash(clean(username) + ':' + password)) throw fail('auth/invalid-credential', 'bad');
      localStorage.setItem((BRAND.storageKey || 'mkt') + '_session', f[0]); tell();
    },
    async logout() { localStorage.removeItem((BRAND.storageKey || 'mkt') + '_session'); tell(); },
    watchManagers: (cb) => on(() => cb(Object.entries(data.users).filter(([, u]) => u.role === 'brand' || u.role === 'sales' || u.role === 'leader').map(([id, u]) => ({ id, ...pub(u) })))),
    async updateManager(uid, patch) { data.users[uid] = { ...data.users[uid], ...patch }; save(); emit(); tell(); },
    async deleteManager(uid) { delete data.users[uid]; save(); emit(); },
    watchProducts: (cb, owner) => on(() => cb(Object.entries(data.products).map(([id, p]) => ({ id, ...p })).filter(p => !owner || p.managerId === owner))),
    async addProduct(p) { data.products[id()] = { ...p, createdAt: Date.now() }; save(); emit(); },
    async updateProduct(pid, patch) { data.products[pid] = { ...data.products[pid], ...patch }; save(); emit(); },
    async deleteProduct(pid) { delete data.products[pid]; save(); emit(); },
    watchSettings: (cb) => on(() => cb(data.settings)),
    async saveSettings(s) { data.settings = { ...data.settings, ...s }; save(); emit(); },
    watchNotes: (cb) => on(() => cb(Object.entries(data.notes).map(([id, n]) => ({ id, ...n })))),
    async addNote(n) { data.notes[id()] = { ...n, createdAt: Date.now() }; save(); emit(); },
    async updateNote(nid, patch) { data.notes[nid] = { ...data.notes[nid], ...patch }; save(); emit(); },
    async deleteNote(nid) { delete data.notes[nid]; save(); emit(); },
    watchPosts: (cb) => on(() => cb(Object.entries(data.posts).map(([id, p]) => ({ ...p, id })))),
    async setPost(pid, p) { data.posts[pid] = { ...p }; save(); emit(); },
    async updatePost(pid, patch) { data.posts[pid] = { ...data.posts[pid], ...patch }; save(); emit(); },
    async deletePost(pid) { delete data.posts[pid]; save(); emit(); },
  };
}

// ───────── Firebase (გუნდისთვის საერთო) ─────────
async function firebaseStore() {
  const V = '12.19.0';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const mail = u => `${clean(u)}@${DOMAIN}`;
  const list = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
  // ნებართვის შეცდომისას (მაგ. ანგარიში ახლახან შეიქმნა) რამდენიმე წამში თავიდან ცდა
  const live = (ref, cb, tries = 6) => {
    let un = null, stop = false, n = 0;
    const go = () => { un = F.onSnapshot(ref, s => { n = 0; cb(list(s)); }, () => { if (!stop && n++ < tries) setTimeout(go, 1500 * n); }); };
    go(); return () => { stop = true; un && un(); };
  };
  return {
    demo: false,
    onAuth(cb) {
      let un = null;
      A.onAuthStateChanged(auth, (u) => {
        if (un) { un(); un = null; }
        if (!u) return cb(null);
        un = F.onSnapshot(F.doc(db, 'users', u.uid), d => {
          if (!d.exists()) { A.signOut(auth); return cb(null); } // წაშლილი ანგარიში
          cb({ uid: u.uid, ...d.data() });
        }, () => cb(null));
      });
    },
    async hasAdmin() { const s = await F.getDoc(F.doc(db, 'settings', 'main')); return s.exists() && !!s.data().adminUid; },
    async setupAdmin({ username, password, fullName }) {
      const c = await A.createUserWithEmailAndPassword(auth, mail(username), password);
      const b = F.writeBatch(db);
      b.set(F.doc(db, 'users', c.user.uid), { username: clean(username), role: 'admin', fullName, createdAt: Date.now() });
      b.set(F.doc(db, 'settings', 'main'), { ...DEFAULT_SETTINGS, adminUid: c.user.uid });
      await b.commit();
    },
    async register({ username, password, brand, fullName, cats, role }) {
      const c = await A.createUserWithEmailAndPassword(auth, mail(username), password);
      await F.setDoc(F.doc(db, 'users', c.user.uid), { username: clean(username), role: ['sales', 'leader'].includes(role) ? role : 'brand', approved: false, brand: brand || '', fullName, cats: cats || [], order: Date.now(), createdAt: Date.now() });
    },
    async login(username, password) { await A.signInWithEmailAndPassword(auth, mail(username), password); },
    async logout() { await A.signOut(auth); },
    watchManagers: (cb) => live(F.query(F.collection(db, 'users'), F.where('role', 'in', ['brand', 'sales', 'leader'])), cb),
    async updateManager(uid, patch) { await F.updateDoc(F.doc(db, 'users', uid), patch); },
    async deleteManager(uid) { await F.deleteDoc(F.doc(db, 'users', uid)); },
    watchProducts: (cb, owner) => live(owner ? F.query(F.collection(db, 'products'), F.where('managerId', '==', owner)) : F.collection(db, 'products'), cb),
    async addProduct(p) { await F.addDoc(F.collection(db, 'products'), { ...p, createdAt: Date.now() }); },
    async updateProduct(pid, patch) { await F.updateDoc(F.doc(db, 'products', pid), patch); },
    async deleteProduct(pid) { await F.deleteDoc(F.doc(db, 'products', pid)); },
    watchSettings: (cb) => F.onSnapshot(F.doc(db, 'settings', 'main'), s => cb(s.exists() ? s.data() : DEFAULT_SETTINGS)),
    async saveSettings(s) { await F.updateDoc(F.doc(db, 'settings', 'main'), s); },
    watchNotes: (cb) => live(F.collection(db, 'notes'), cb),
    async addNote(n) { await F.addDoc(F.collection(db, 'notes'), { ...n, createdAt: Date.now() }); },
    async updateNote(nid, patch) { await F.updateDoc(F.doc(db, 'notes', nid), patch); },
    async deleteNote(nid) { await F.deleteDoc(F.doc(db, 'notes', nid)); },
    watchPosts: (cb) => live(F.collection(db, 'posts'), v => cb(v)),
    async setPost(pid, p) { await F.setDoc(F.doc(db, 'posts', pid), p); },
    async updatePost(pid, patch) { await F.updateDoc(F.doc(db, 'posts', pid), patch); },
    async deletePost(pid) { await F.deleteDoc(F.doc(db, 'posts', pid)); },
  };
}

export async function createStore() { return DEMO ? demoStore() : firebaseStore(); }
