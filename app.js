// ════════════════════════════════════════
//  VoltPOS — Main Application Logic
//  Offline Desktop Mode (Electron + SQLite)
// ════════════════════════════════════════

// ── Global DB state ──
const db = {
  users:      [],
  categories: [],
  products:   [],
  invoices:   [],
  invLogs:    [],
  debts:      [],
  settings:   {},
};

// ── Bridge: voltDB shim (Firebase or Electron) ──
// window.voltDB يتحمل من firebase-init.js تلقائياً
async function sbInsert(table, row) {
  const r = await window.voltDB.insert(table, row);
  if (r.error) throw new Error(r.error);
  return r.data;
}
async function sbUpdate(table, id, changes) {
  const r = await window.voltDB.update(table, id, changes);
  if (r.error) throw new Error(r.error);
  return r.data || r;
}
async function sbDelete(table, id) {
  const r = await window.voltDB.delete(table, id);
  if (r.error) throw new Error(r.error);
  return r.data || r;
}
async function sbUpsert(table, row) {
  const r = await window.voltDB.upsert(table, row);
  if (r.error) throw new Error(r.error);
  return r.data || r;
}

// ════════════════════════════════════════
//  VoltPOS Desktop — Offline SQLite Mode
//  البيانات تُحفظ محلياً بدون إنترنت
// ════════════════════════════════════════

// ── Map Supabase rows ──
function mapUser(r)     { return r ? { id: r.id, name: r.name, username: r.username, passHash: r.pass_hash, role: r.role, createdAt: r.created_at } : null; }
function mapCat(r)      { return r ? { id: r.id, name: r.name, description: r.description, createdAt: r.created_at } : null; }
function mapProd(r)     { return r ? { id: r.id, name: r.name, sku: r.sku, category: r.category, unit: r.unit, salePrice: r.sale_price, costPrice: r.cost_price, stock: r.stock, reorder: r.reorder, description: r.description, createdAt: r.created_at } : null; }
function mapInv(r)      { return r ? { id: r.id, num: r.num, date: r.date, cashier: r.cashier, items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items || [], subtotal: r.subtotal, discount: r.discount, tax: r.tax, total: r.total, paid: r.paid, change: r.change } : null; }
function mapLog(r)      { return r ? { id: r.id, productId: r.product_id, productName: r.product_name, type: r.type, change: r.change, before: r.before, after: r.after, user: r.user, note: r.note, date: r.date } : null; }
function mapSettings(r) { return r ? { storeName: r.store_name || '', phone: r.phone || '', address: r.address || '', vat: r.vat || '', email: r.email || '', footer: r.footer || 'شكراً لك!', taxRate: r.tax_rate || 15, taxLabel: r.tax_label || 'VAT', currency: r.currency || '$', printer: r.printer || 'thermal80', showLogo: r.show_logo ?? 1, showVat: r.show_vat ?? 1 } : null; }
function mapDebt(r)     { return r ? { id: r.id, customerName: r.customer_name, phone: r.phone || '', items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items || [], subtotal: r.subtotal, discount: r.discount || 0, tax: r.tax || 0, total: r.total, note: r.note || '', status: r.status || 'unpaid', cashier: r.cashier, date: r.date, paidDate: r.paid_date || null } : null; }

async function loadDB() {
  try {
    showLoading('جاري تحميل البيانات…');
    const result = await window.voltDB.loadAll();
    if (result.error) throw new Error(result.error);

    db.users      = (result.users      || []).map(mapUser);
    db.categories = (result.categories || []).map(mapCat);
    db.products   = (result.products   || []).map(mapProd);
    db.invoices   = (result.invoices   || []).map(mapInv);
    db.invLogs    = (result.invLogs    || []).map(mapLog);
    db.debts      = (result.debts      || []).map(mapDebt);
    if (result.settings) db.settings = mapSettings(result.settings);

    hideLoading();
    return true;
  } catch(e) {
    hideLoading();
    toast('فشل تحميل البيانات: ' + e.message, 'e');
    return false;
  }
}

async function saveDB() {
  try {
    const s = db.settings;
    await sbUpsert('settings', {
      id: 1,
      store_name: s.storeName,
      phone:      s.phone,
      address:    s.address,
      vat:        s.vat,
      email:      s.email,
      footer:     s.footer,
      tax_rate:   s.taxRate,
      tax_label:  s.taxLabel,
      currency:   s.currency,
      printer:    s.printer,
      show_logo:  s.showLogo,
      show_vat:   s.showVat,
    });
  } catch(e) { toast('فشل حفظ الإعدادات: ' + e.message, 'e'); }
}

// ════════════════════════════════════════
//  STARTUP — تحميل تلقائي بدون إنترنت
// ════════════════════════════════════════
window.addEventListener('load', async () => {
  const setupScreen = document.getElementById('sb-setup-screen');
  if (setupScreen) setupScreen.style.display = 'none';

  // دخول مباشر بدون لوجين
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  currentUser = { id: 'default', name: 'Admin', username: 'admin', role: 'admin' };
  const av = document.getElementById('u-av');
  const un = document.getElementById('u-name');
  const ur = document.getElementById('u-role');
  if (av) av.textContent = 'A';
  if (un) un.textContent = 'Admin';
  if (ur) ur.textContent = 'مدير';
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');

  nav('dashboard');

  // تحميل البيانات في الخلفية
  loadDB().then(() => {
    nav('dashboard');
    loadSettingsForm();
  });
});

// ════════════════════════════════════════
//  STATE
// ════════════════════════════════════════
let currentUser    = null;
let cart           = [];
let posCatFilter   = '';
let lastInvoiceId  = null;

let invoiceCounter = () => {
  const nums = db.invoices.map(i => parseInt(i.num.replace('INV-', '')) || 0);
  return 'INV-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
};

// ════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════
function doLogin() {
  const u = v('li-u').trim(), p = v('li-p').trim();
  if (!u || !p) { loginErr('أدخل اسم المستخدم وكلمة المرور'); return; }

  console.log('👥 db.users:', db.users);
  if (db.users.length === 0) {
    loginErr('⚠️ تعذّر تحميل قائمة المستخدمين، أعد تشغيل التطبيق');
    return;
  }

  const found = db.users.find(x => x.username === u && x.passHash === simpleHash(p));
  if (!found) { loginErr('اسم المستخدم أو كلمة المرور غير صحيحة'); return; }
  currentUser = found;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('u-av').textContent    = found.name[0].toUpperCase();
  document.getElementById('u-name').textContent  = found.name;
  document.getElementById('u-role').textContent  = found.role === 'admin' ? 'مدير' : 'كاشير';
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = found.role === 'admin' ? '' : 'none');
  loginErr('');
  nav('dashboard');
  loadSettingsForm();
  toast(`مرحباً، ${found.name}!`, 's');
}

function loginErr(msg) {
  const el = document.getElementById('login-err');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function doLogout() {
  if (!confirm('تسجيل الخروج؟')) return;
  currentUser = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('li-p').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('li-p')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('li-u')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('li-p').focus(); });
});

// ════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════
const META = {
  dashboard:  ['لوحة التحكم', 'نظرة عامة وإحصائيات'],
  pos:        ['نقطة البيع', 'F1: بحث  ·  F2: إتمام البيع'],
  products:   ['المنتجات', 'إدارة كتالوج المنتجات'],
  categories: ['الفئات', 'إدارة فئات المنتجات'],
  inventory:  ['المخزون', 'مستويات المخزون وسجل الحركات'],
  invoices:   ['الفواتير', 'استعراض وإدارة المبيعات'],
  debts:      ['📒 دفتر الديون', 'سجل ديون العملاء'],
  reports:    ['التقارير', 'تحليلات المبيعات'],
  users:      ['المستخدمون', 'إدارة الحسابات (للمدير فقط)'],
  settings:   ['الإعدادات', 'إعدادات المتجر والنظام'],
};

function nav(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.s-item').forEach(i => i.classList.remove('active'));
  const s    = document.getElementById('screen-' + screen);
  if (s) s.classList.add('active');
  const item = document.querySelector(`[data-screen="${screen}"]`);
  if (item) item.classList.add('active');
  const m = META[screen] || [screen, ''];
  document.getElementById('t-title').textContent = m[0];
  document.getElementById('t-sub').textContent   = m[1];
  document.getElementById('t-right').innerHTML   = '';

  if (screen === 'dashboard')  renderDashboard();
  if (screen === 'pos')        initPOS();
  if (screen === 'products')   renderProductsTable();
  if (screen === 'categories') renderCatsTable();
  if (screen === 'inventory')  { renderInventory(); dismissLowAlert(); }
  if (screen === 'invoices')   renderInvoicesTable();
  if (screen === 'debts')      renderDebtsScreen();
  if (screen === 'reports')    { setRepRange('today'); renderReports(); }
  if (screen === 'users')      renderUsersTable();
}

document.querySelectorAll('.s-item').forEach(el => {
  el.addEventListener('click', () => nav(el.dataset.screen));
});

// ════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════
let lowAlertDismissed = false;

function dismissLowAlert() {
  lowAlertDismissed = true;
  hide('dash-low-alert');
  const badge = document.getElementById('low-badge');
  if (badge) badge.style.display = 'none';
}

function renderDashboard() {
  const todayStr      = today();
  const todayInvoices = db.invoices.filter(i => i.date.slice(0, 10) === todayStr);
  const rev           = todayInvoices.reduce((s, i) => s + i.total, 0);
  const lowProds      = db.products.filter(p => p.stock <= p.reorder);
  const unpaidDebts   = db.debts.filter(d => d.status === 'unpaid');
  const totalDebt     = unpaidDebts.reduce((s, d) => s + d.total, 0);

  set('d-rev',      fmt(rev));
  set('d-rev-sub',  todayInvoices.length + ' فاتورة اليوم');
  set('d-sales',    todayInvoices.length);
  set('d-prods',    db.products.length);
  set('d-cats-sub', db.categories.length + ' فئة');
  set('d-low',      lowProds.length);
  set('d-debt-count', unpaidDebts.length);
  set('d-debt-total', fmt(totalDebt));

  if (lowProds.length > 0 && !lowAlertDismissed) {
    show('dash-low-alert');
    set('dash-low-txt', `${lowProds.length} منتج أقل من حد إعادة الطلب.`);
    const badge = document.getElementById('low-badge');
    badge.textContent   = lowProds.length;
    badge.style.display = 'inline';
  } else if (lowProds.length === 0) {
    lowAlertDismissed = false;
    hide('dash-low-alert');
    document.getElementById('low-badge').style.display = 'none';
  } else {
    hide('dash-low-alert');
  }

  // Recent invoices
  const recent = [...db.invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const tbody  = document.getElementById('d-inv-tbody');
  tbody.innerHTML = recent.length
    ? recent.map(i => `<tr>
        <td class="mono ca">#${i.num}</td>
        <td class="cm mono">${i.date.slice(11, 16)}</td>
        <td class="mono fw7">${fmt(i.total)}</td>
        <td class="cm">${i.cashier}</td>
      </tr>`).join('')
    : `<tr><td colspan="4"><div class="empty"><div class="ei">🧾</div><div class="es">لا توجد فواتير بعد</div></div></td></tr>`;

  // Top selling products
  const soldMap = {};
  db.invoices.forEach(inv => inv.items.forEach(item => {
    if (!soldMap[item.productId]) soldMap[item.productId] = { qty: 0, rev: 0, name: item.name };
    soldMap[item.productId].qty += item.qty;
    soldMap[item.productId].rev += item.lineTotal;
  }));
  const topSold  = Object.values(soldMap).sort((a, b) => b.rev - a.rev).slice(0, 5);
  const topBody  = document.getElementById('d-top-tbody');
  topBody.innerHTML = topSold.length
    ? topSold.map(p => `<tr><td>${p.name}</td><td class="mono">${p.qty}</td><td class="mono ca">${fmt(p.rev)}</td></tr>`).join('')
    : `<tr><td colspan="3"><div class="empty"><div class="ei">📦</div><div class="es">لا مبيعات بعد</div></div></td></tr>`;

  // Low stock list
  const lowEl = document.getElementById('d-lowstock-list');
  if (!lowProds.length) {
    lowEl.innerHTML = `<div class="empty"><div class="ei">✅</div><div class="et">المخزون كامل</div><div class="es">لا منتجات أقل من حد إعادة الطلب</div></div>`;
  } else {
    lowEl.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">' +
      lowProds.map(p => {
        const pct = p.reorder > 0 ? Math.round((p.stock / p.reorder) * 100) : 100;
        const col = p.stock === 0 ? 'var(--red)' : p.stock <= p.reorder ? 'var(--accent)' : 'var(--green)';
        return `<div class="card card-sm">
          <div class="fbet mb8">
            <div>
              <div style="font-size:13px;font-weight:600">${p.name}</div>
              <div class="mono cm" style="font-size:10px">${p.sku}</div>
            </div>
            <span class="badge bg-red">${p.stock} / ${p.reorder}</span>
          </div>
          <div class="stock-bar"><div class="stock-fill" style="width:${Math.min(pct,100)}%;background:${col}"></div></div>
        </div>`;
      }).join('') + '</div>';
  }
}

// ════════════════════════════════════════
//  POS
// ════════════════════════════════════════
function initPOS() {
  renderPOSCats();
  renderPOSGrid();
  renderCart();
  const taxRate = db.settings.taxRate || 0;
  document.getElementById('pi-taxlbl').textContent = taxRate;
  updatePOSTime();
}

function updatePOSTime() {
  const el = document.getElementById('pi-time');
  if (el) el.textContent = new Date().toLocaleString();
}

function renderPOSCats() {
  const cats = ['All', ...db.categories.map(c => c.name)];
  const el   = document.getElementById('pos-cats');
  el.innerHTML = cats.map(c =>
    `<span class="chip ${(!posCatFilter && c === 'All') || (posCatFilter === c) ? 'on' : ''}" onclick="setPOSCat('${c}')">${c}</span>`
  ).join('');
}

function setPOSCat(c) {
  posCatFilter = c === 'All' ? '' : c;
  renderPOSCats();
  renderPOSGrid();
}

function renderPOSGrid() {
  const q    = (document.getElementById('pos-q')?.value || '').toLowerCase();
  const grid = document.getElementById('pos-grid');
  let prods  = db.products.filter(p => {
    const mq = !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    const mc = !posCatFilter || p.category === posCatFilter;
    return mq && mc;
  });
  if (!prods.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="ei">📦</div><div class="et">No products found</div></div>`;
    return;
  }
  grid.innerHTML = prods.map(p => {
    const out = p.stock === 0;
    const low = !out && p.stock <= p.reorder;
    const stockColor = out ? 'var(--red)' : low ? 'var(--accent)' : 'var(--green)';
    const stockIcon  = out ? '⛔' : low ? '⚠️' : '✅';
    const stockLabel = out ? 'نفد المخزون' : `${p.stock} ${p.unit}`;
    return `<div class="p-tile ${low ? 'p-tile-low' : ''} ${out ? 'p-tile-out' : ''}" onclick="${out ? '' : `addToCart('${p.id}')`}" style="${out ? 'opacity:.5;cursor:not-allowed' : ''}">
      ${low ? '<span class="p-low-badge">⚠️ مخزون منخفض</span>' : ''}
      ${out ? '<span class="p-out-badge">⛔ نفد</span>' : ''}
      <div class="pt-sku">${p.sku}</div>
      <div class="pt-name">${p.name}</div>
      <div class="pt-price">${fmt(p.salePrice)}</div>
      <div class="pt-stock-bar-wrap">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span class="pt-stock ${out ? 'out' : low ? 'low' : ''}" style="font-size:11px">${stockIcon} ${stockLabel}</span>
          ${!out ? `<span style="font-size:10px;color:var(--text3)">/${p.reorder}</span>` : ''}
        </div>
        ${!out ? `<div style="height:4px;background:var(--surface3);border-radius:3px;overflow:hidden">
          <div style="height:100%;border-radius:3px;background:${stockColor};width:${Math.min(Math.round((p.stock / Math.max(p.reorder,1)) * 100), 100)}%;transition:width .3s"></div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function addToCart(id) {
  const prod = db.products.find(p => p.id === id);
  if (!prod || prod.stock === 0) { toast('نفد المخزون!', 'e'); return; }
  const ex = cart.find(i => i.id === id);
  if (ex) {
    if (ex.qty >= prod.stock) { toast('الكمية غير كافية في المخزون!', 'e'); return; }
    ex.qty++;
  } else {
    cart.push({ id, name: prod.name, sku: prod.sku, price: prod.salePrice, unit: prod.unit, qty: 1 });
  }
  renderCart();
  recalc();
}

function updateQty(id, d) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  const prod = db.products.find(p => p.id === id);
  if (d > 0 && prod && item.qty >= prod.stock) { toast('الكمية غير كافية في المخزون!', 'e'); return; }
  item.qty += d;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  renderCart();
  recalc();
}

function removeFromCart(id) { cart = cart.filter(i => i.id !== id); renderCart(); recalc(); }

function renderCart() {
  const el  = document.getElementById('pi-items');
  const num = document.getElementById('pi-num');
  if (num) num.textContent = '#' + invoiceCounter();
  if (!cart.length) {
    el.innerHTML = `<div class="pi-empty"><div class="ei">🛒</div><p style="font-size:13px">أضف منتجات من اليسار</p></div>`;
    return;
  }
  el.innerHTML = cart.map(item => `<div class="pi-item">
    <div class="pi-info">
      <div class="pi-iname">${item.name}</div>
      <div class="pi-isku">${item.sku}</div>
    </div>
    <div class="qty-ctrl">
      <div class="qb" onclick="updateQty('${item.id}',-1)">−</div>
      <div class="qv">${item.qty}</div>
      <div class="qb" onclick="updateQty('${item.id}',1)">+</div>
    </div>
    <div class="pi-price">
      <div class="pi-unit">${fmt(item.price)}</div>
      <div class="pi-total">${fmt(item.price * item.qty)}</div>
    </div>
    <div class="pi-del" onclick="removeFromCart('${item.id}')">✕</div>
  </div>`).join('');
}

// ════════════════════════════════════════
//  CALCULATOR STATE
// ════════════════════════════════════════
let calcInput = '0';
let calcTotal = 0;

function recalc() {
  const sub     = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt = parseFloat(v('pi-disc-amt')) || 0;
  const taxRate = (db.settings.taxRate || 0) / 100;
  const taxable = Math.max(sub - discAmt, 0);
  const tax     = taxable * taxRate;
  const total   = taxable + tax;
  calcTotal     = total;

  set('pi-sub',  fmtNum(sub));
  set('pi-disc', fmtNum(discAmt) + '-');
  set('pi-tax',  fmtNum(tax) + '+');
  set('pi-total', fmtNum(total));

  updateCalcDisplay();
  renderQuickAmounts(total);
}

function recalcPct() {
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const pct = parseFloat(v('pi-disc-pct')) || 0;
  document.getElementById('pi-disc-amt').value = (sub * pct / 100).toFixed(2);
  recalc();
}

function calcPress(val) {
  if (val === '.') {
    if (calcInput.includes('.')) return;
    calcInput += '.';
  } else if (val === '00') {
    if (calcInput === '0') return;
    calcInput += '00';
  } else {
    if (calcInput === '0' && val !== '.') calcInput = val;
    else calcInput += val;
  }
  if (calcInput.replace('.','').length > 10) return;
  updateCalcDisplay();
}

function calcDel() {
  if (calcInput.length <= 1) { calcInput = '0'; }
  else { calcInput = calcInput.slice(0, -1); }
  updateCalcDisplay();
}

function calcClear() {
  calcInput = '0';
  updateCalcDisplay();
}

function calcSetAmount(amount) {
  calcInput = amount.toFixed(2).replace(/\.?0+$/, '') || '0';
  updateCalcDisplay();
  document.querySelectorAll('.calc-quick-btn').forEach(b => {
    b.classList.toggle('active', parseFloat(b.dataset.val) === amount);
  });
}

function updateCalcDisplay() {
  const paid   = parseFloat(calcInput) || 0;
  const change = paid - calcTotal;

  const hiddenPaid = document.getElementById('pi-paid');
  if (hiddenPaid) hiddenPaid.value = paid;

  const disp = document.getElementById('calc-display');
  if (disp) {
    disp.textContent = calcInput;
    disp.className   = 'calc-display' + (paid === 0 ? '' : change < 0 ? ' over' : change === 0 ? ' exact' : '');
  }

  const totalLbl = document.getElementById('calc-total-lbl');
  if (totalLbl) totalLbl.textContent = fmtNum(calcTotal);

  const changeLbl = document.getElementById('pi-change');
  if (changeLbl) {
    if (paid === 0) {
      changeLbl.textContent = '0.00';
      changeLbl.style.color = 'var(--text3)';
    } else if (change < 0) {
      changeLbl.textContent = Math.abs(change).toFixed(2) + ' ناقص';
      changeLbl.style.color = 'var(--red)';
    } else {
      changeLbl.textContent = change.toFixed(2);
      changeLbl.style.color = 'var(--green)';
    }
  }
}

function renderQuickAmounts(total) {
  const el = document.getElementById('calc-quick');
  if (!el) return;
  const t = Math.ceil(total);
  const amounts = new Set();
  amounts.add(t);
  amounts.add(Math.ceil(t / 5) * 5);
  amounts.add(Math.ceil(t / 10) * 10);
  amounts.add(Math.ceil(t / 50) * 50);
  amounts.add(Math.ceil(t / 100) * 100);
  if (total > 0) amounts.add(Math.ceil(t / 500) * 500);
  const sorted = [...amounts].filter(a => a >= total).sort((a,b) => a-b).slice(0,5);
  el.innerHTML = sorted.map(a =>
    `<button class="calc-quick-btn" data-val="${a}" onclick="calcSetAmount(${a})">${a}</button>`
  ).join('');
}

async function completeSale() {
  if (!cart.length) { toast('السلة فارغة!', 'e'); return; }
  const totalStr = document.getElementById('pi-total').textContent.replace(/[^0-9.]/g, '');
  const total    = parseFloat(totalStr) || 0;
  const paid     = parseFloat(calcInput) || 0;
  if (paid < total) { toast('المبلغ المدفوع أقل من الإجمالي!', 'e'); return; }

  const sub     = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt = parseFloat(v('pi-disc-amt')) || 0;
  const taxRate = (db.settings.taxRate || 0) / 100;
  const tax     = Math.max(sub - discAmt, 0) * taxRate;
  const num     = invoiceCounter();

  const invRow = {
    id:       uid(),
    num,
    date:     new Date().toISOString(),
    cashier:  currentUser.username,
    items:    JSON.stringify(cart.map(i => ({
      productId: i.id, name: i.name, sku: i.sku,
      qty: i.qty, unitPrice: i.price, lineTotal: i.price * i.qty,
    }))),
    subtotal: sub,
    discount: discAmt,
    tax,
    total,
    paid,
    change:   Math.max(0, paid - total),
  };

  try {
    showLoading('جاري حفظ الفاتورة…');
    let inserted;
    try {
      inserted = await sbInsert('invoices', invRow);
    } catch(e) {
      hideLoading();
      toast('❌ فشل حفظ الفاتورة: ' + e.message, 'e');
      return;
    }
    db.invoices.unshift(mapInv(inserted));

    showLoading('جاري تحديث المخزون…');
    for (const item of cart) {
      const prod = db.products.find(p => p.id === item.id);
      if (!prod) continue;
      const before = prod.stock;
      const after  = Math.max(0, prod.stock - item.qty);
      try {
        await sbUpdate('products', prod.id, { stock: after });
        prod.stock = after;
        const logRow      = { id: uid(), product_id: prod.id, product_name: prod.name, type: 'sale', change: -item.qty, before, after, user: currentUser.username, note: '#' + num, date: now() };
        const insertedLog = await sbInsert('inv_logs', logRow);
        db.invLogs.unshift(mapLog(insertedLog));
      } catch(e) {
        console.error('⚠️ Stock update failed for', prod.name, e);
        toast('⚠️ تحذير: المخزون لـ "' + prod.name + '" لم يتحدث', 'e');
      }
    }

    hideLoading();
    lastInvoiceId = inserted.id;
    set('done-num',    '#' + num);
    set('done-total',  fmt(total));
    set('done-paid',   fmt(paid));
    set('done-change', fmt(paid - total));
    openModal('m-done');
  } catch(e) { hideLoading(); toast('خطأ غير متوقع: ' + e.message, 'e'); }
}

function clearCart() {
  cart = [];
  calcInput = '0';
  calcTotal = 0;
  document.getElementById('pi-disc-amt').value = 0;
  document.getElementById('pi-disc-pct').value = 0;
  renderCart();
  recalc();
  updateCalcDisplay();
}

function newSale() { clearCart(); closeModal('m-done'); renderPOSGrid(); updatePOSTime(); }

function printLastReceipt() {
  if (!lastInvoiceId) { toast('لا يوجد بيع حديث للطباعة', 'e'); return; }
  printReceipt(lastInvoiceId);
}

// ════════════════════════════════════════
//  📒 DEBT BOOK — دفتر الديون
// ════════════════════════════════════════

/**
 * يفتح modal تسجيل الدين مع بيانات السلة الحالية
 */
function openDebtModal() {
  if (!cart.length) { toast('السلة فارغة! أضف منتجات أولاً', 'e'); return; }

  // احسب الإجماليات
  const sub     = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt = parseFloat(v('pi-disc-amt')) || 0;
  const taxRate = (db.settings.taxRate || 0) / 100;
  const taxable = Math.max(sub - discAmt, 0);
  const tax     = taxable * taxRate;
  const total   = taxable + tax;

  // عبي ملخص الفاتورة في الـ modal
  document.getElementById('debt-customer').value = '';
  document.getElementById('debt-phone').value    = '';
  document.getElementById('debt-note').value     = '';

  // عرض عناصر السلة
  const itemsEl = document.getElementById('debt-items-preview');
  itemsEl.innerHTML = cart.map(item => `
    <div class="debt-item-row">
      <span class="debt-item-name">${item.name}</span>
      <span class="debt-item-qty">×${item.qty}</span>
      <span class="debt-item-price">${fmt(item.price * item.qty)}</span>
    </div>
  `).join('');

  document.getElementById('debt-subtotal-val').textContent = fmt(sub);
  document.getElementById('debt-discount-val').textContent = discAmt > 0 ? '-' + fmt(discAmt) : '—';
  document.getElementById('debt-tax-val').textContent      = '+' + fmt(tax);
  document.getElementById('debt-total-val').textContent    = fmt(total);

  openModal('m-debt');
  setTimeout(() => document.getElementById('debt-customer').focus(), 100);
}

/**
 * يحفظ الدين ويخصم المخزون
 */
async function saveDebt() {
  const customerName = document.getElementById('debt-customer').value.trim();
  const phone        = document.getElementById('debt-phone').value.trim();
  const note         = document.getElementById('debt-note').value.trim();

  if (!customerName) { toast('أدخل اسم العميل', 'e'); document.getElementById('debt-customer').focus(); return; }

  const sub     = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt = parseFloat(v('pi-disc-amt')) || 0;
  const taxRate = (db.settings.taxRate || 0) / 100;
  const taxable = Math.max(sub - discAmt, 0);
  const tax     = taxable * taxRate;
  const total   = taxable + tax;

  const debtRow = {
    id:            uid(),
    customer_name: customerName,
    phone:         phone,
    items:         JSON.stringify(cart.map(i => ({
      productId: i.id, name: i.name, sku: i.sku,
      qty: i.qty, unitPrice: i.price, lineTotal: i.price * i.qty,
    }))),
    subtotal: sub,
    discount: discAmt,
    tax,
    total,
    note,
    status:   'unpaid',
    cashier:  currentUser.username,
    date:     new Date().toISOString(),
    paid_date: null,
  };

  try {
    showLoading('جاري حفظ الدين…');

    // حفظ الدين في Supabase
    let inserted;
    try {
      inserted = await sbInsert('debts', debtRow);
    } catch(e) {
      hideLoading();
      toast('❌ فشل حفظ الدين: ' + e.message, 'e');
      return;
    }
    db.debts.unshift(mapDebt(inserted));

    // خصم المخزون
    showLoading('جاري تحديث المخزون…');
    for (const item of cart) {
      const prod = db.products.find(p => p.id === item.id);
      if (!prod) continue;
      const before = prod.stock;
      const after  = Math.max(0, prod.stock - item.qty);
      try {
        await sbUpdate('products', prod.id, { stock: after });
        prod.stock = after;
        const logRow      = { id: uid(), product_id: prod.id, product_name: prod.name, type: 'sale', change: -item.qty, before, after, user: currentUser.username, note: 'دين - ' + customerName, date: now() };
        const insertedLog = await sbInsert('inv_logs', logRow);
        db.invLogs.unshift(mapLog(insertedLog));
      } catch(e) {
        console.error('⚠️ Stock update failed for', prod.name, e);
      }
    }

    hideLoading();
    closeModal('m-debt');

    // تحديث badge الديون
    updateDebtBadge();

    // عرض تأكيد
    toast(`✅ تم تسجيل دين "${customerName}" بمبلغ ${fmt(total)}`, 's');

    // مسح السلة
    clearCart();
    renderPOSGrid();

  } catch(e) { hideLoading(); toast('خطأ: ' + e.message, 'e'); }
}

/**
 * عرض شاشة دفتر الديون
 */
function renderDebtsScreen() {
  const filter   = document.getElementById('debt-filter')?.value || 'all';
  const q        = (document.getElementById('debt-q')?.value || '').toLowerCase();
  let debts      = [...db.debts].sort((a, b) => b.date.localeCompare(a.date));

  if (filter === 'unpaid') debts = debts.filter(d => d.status === 'unpaid');
  if (filter === 'paid')   debts = debts.filter(d => d.status === 'paid');
  if (q) debts = debts.filter(d => d.customerName.toLowerCase().includes(q) || (d.phone || '').includes(q));

  const totalUnpaid = db.debts.filter(d => d.status === 'unpaid').reduce((s, d) => s + d.total, 0);
  const totalPaid   = db.debts.filter(d => d.status === 'paid').reduce((s, d) => s + d.total, 0);
  const countUnpaid = db.debts.filter(d => d.status === 'unpaid').length;

  set('debt-stat-unpaid-count', countUnpaid);
  set('debt-stat-unpaid-amt',   fmt(totalUnpaid));
  set('debt-stat-paid-amt',     fmt(totalPaid));
  set('debt-stat-total',        db.debts.length);

  const tbody = document.getElementById('debts-tbody');
  if (!debts.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="ei">📒</div><div class="et">لا توجد ديون</div><div class="es">سجّل ديناً من نقطة البيع</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = debts.map(d => `<tr class="${d.status === 'paid' ? 'debt-row-paid' : ''}">
    <td>
      <div style="font-weight:700;font-size:14px">${d.customerName}</div>
      ${d.phone ? `<div style="font-size:11px;color:var(--text3);font-family:var(--mono)">${d.phone}</div>` : ''}
    </td>
    <td class="mono fw7 ${d.status === 'unpaid' ? 'cr' : 'cg'}">${fmt(d.total)}</td>
    <td>
      <div style="font-size:12px;color:var(--text2)">
        ${d.items.slice(0,2).map(i => `${i.name} ×${i.qty}`).join('<br>')}
        ${d.items.length > 2 ? `<span class="cm">+${d.items.length - 2} أخرى</span>` : ''}
      </div>
    </td>
    <td class="cm" style="font-size:12px">${d.note || '—'}</td>
    <td class="mono cm" style="font-size:11px">${fmtDate(d.date)}</td>
    <td>
      <span class="badge ${d.status === 'paid' ? 'bg-green' : 'bg-red'}">
        ${d.status === 'paid' ? '✅ مدفوع' : '⏳ مستحق'}
      </span>
    </td>
    <td>
      <div class="flex gap8">
        <button class="btn btn-ghost btn-sm" onclick="viewDebt('${d.id}')">عرض</button>
        ${d.status === 'unpaid'
          ? `<button class="btn btn-success btn-sm" onclick="markDebtPaid('${d.id}')">تم الدفع ✓</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="markDebtUnpaid('${d.id}')">إلغاء</button>`
        }
        <button class="btn btn-danger btn-sm" onclick="deleteDebt('${d.id}')">حذف</button>
      </div>
    </td>
  </tr>`).join('');
}

function viewDebt(id) {
  const d = db.debts.find(x => x.id === id);
  if (!d) return;

  const html = `
    <div class="debt-detail">
      <div class="debt-detail-header">
        <div>
          <div style="font-size:22px;font-weight:900;color:var(--text)">${d.customerName}</div>
          ${d.phone ? `<div style="color:var(--text3);font-family:var(--mono);font-size:13px">📞 ${d.phone}</div>` : ''}
          <div style="margin-top:8px"><span class="badge ${d.status === 'paid' ? 'bg-green' : 'bg-red'}">${d.status === 'paid' ? '✅ مدفوع' : '⏳ مستحق السداد'}</span></div>
        </div>
        <div style="text-align:left">
          <div style="font-size:11px;color:var(--text3)">تاريخ الدين</div>
          <div style="font-family:var(--mono);font-size:12px">${fmtDate(d.date)}</div>
          ${d.paidDate ? `<div style="font-size:11px;color:var(--green);margin-top:4px">دُفع: ${fmtDate(d.paidDate)}</div>` : ''}
        </div>
      </div>
      <div style="margin:16px 0">
        <div class="sec">المنتجات</div>
        ${d.items.map(i => `
          <div class="debt-item-row">
            <span class="debt-item-name">${i.name} <span class="cm mono" style="font-size:11px">${i.sku}</span></span>
            <span class="debt-item-qty">×${i.qty}</span>
            <span class="debt-item-price">${fmt(i.lineTotal)}</span>
          </div>
        `).join('')}
      </div>
      <div class="debt-totals">
        <div class="t-row"><span class="tl">المجموع الفرعي</span><span class="tv">${fmt(d.subtotal)}</span></div>
        ${d.discount ? `<div class="t-row" style="color:var(--green)"><span class="tl">الخصم</span><span class="tv">-${fmt(d.discount)}</span></div>` : ''}
        <div class="t-row" style="color:var(--red)"><span class="tl">الضريبة</span><span class="tv">+${fmt(d.tax)}</span></div>
        <div class="t-row grand"><span class="tl">الإجمالي المستحق</span><span class="tv" style="color:${d.status === 'paid' ? 'var(--green)' : 'var(--red)'}">${fmt(d.total)}</span></div>
      </div>
      ${d.note ? `<div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:var(--radius);font-size:13px;color:var(--text2)">📝 ${d.note}</div>` : ''}
      <div style="font-size:11px;color:var(--text3);margin-top:10px">الكاشير: ${d.cashier}</div>
    </div>
  `;

  document.getElementById('m-debt-view-body').innerHTML = html;
  document.getElementById('m-debt-view-title').textContent = `دين — ${d.customerName}`;

  const footerBtn = document.getElementById('m-debt-view-action');
  if (d.status === 'unpaid') {
    footerBtn.style.display = '';
    footerBtn.onclick = () => { closeModal('m-debt-view'); markDebtPaid(id); };
  } else {
    footerBtn.style.display = 'none';
  }

  openModal('m-debt-view');
}

async function markDebtPaid(id) {
  const d = db.debts.find(x => x.id === id);
  if (!d) return;
  if (!confirm(`تأكيد استلام مبلغ ${fmt(d.total)} من "${d.customerName}"؟`)) return;
  try {
    showLoading('جاري التحديث…');
    const paidDate = new Date().toISOString();
    await sbUpdate('debts', id, { status: 'paid', paid_date: paidDate });
    d.status   = 'paid';
    d.paidDate = paidDate;
    hideLoading();
    updateDebtBadge();
    renderDebtsScreen();
    toast(`✅ تم تسجيل دفع "${d.customerName}"`, 's');
  } catch(e) { hideLoading(); toast('خطأ: ' + e.message, 'e'); }
}

async function markDebtUnpaid(id) {
  const d = db.debts.find(x => x.id === id);
  if (!d) return;
  try {
    showLoading('جاري التحديث…');
    await sbUpdate('debts', id, { status: 'unpaid', paid_date: null });
    d.status   = 'unpaid';
    d.paidDate = null;
    hideLoading();
    updateDebtBadge();
    renderDebtsScreen();
    toast('تم إعادة الدين كـ "غير مدفوع"', 'i');
  } catch(e) { hideLoading(); toast('خطأ: ' + e.message, 'e'); }
}

async function deleteDebt(id) {
  const d = db.debts.find(x => x.id === id);
  if (!confirm(`حذف دين "${d?.customerName}"؟ لا يمكن التراجع.`)) return;
  try {
    showLoading('جاري الحذف…');
    await sbDelete('debts', id);
    db.debts = db.debts.filter(x => x.id !== id);
    hideLoading();
    updateDebtBadge();
    renderDebtsScreen();
    toast('تم حذف الدين', 's');
  } catch(e) { hideLoading(); toast('خطأ: ' + e.message, 'e'); }
}

function updateDebtBadge() {
  const count = db.debts.filter(d => d.status === 'unpaid').length;
  const badge = document.getElementById('debt-badge');
  if (!badge) return;
  badge.textContent   = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
}

// ════════════════════════════════════════
//  PRODUCTS
// ════════════════════════════════════════
function renderProductsTable() {
  const q     = (document.getElementById('prod-q')?.value || '').toLowerCase();
  const catF  = document.getElementById('prod-cat-f')?.value || '';
  const tbody = document.getElementById('prod-tbody');
  let prods   = db.products.filter(p => {
    const mq = !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    const mc = !catF || p.category === catF;
    return mq && mc;
  });
  if (!prods.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty"><div class="ei">📦</div><div class="et">لا توجد منتجات بعد</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = prods.map((p, i) => {
    const low = p.stock <= p.reorder;
    return `<tr>
      <td class="mono cm">${i + 1}</td>
      <td><strong>${p.name}</strong>${p.description ? `<div class="cm" style="font-size:11px">${p.description}</div>` : ''}</td>
      <td class="mono cm">${p.sku}</td>
      <td><span class="badge bg-blue">${p.category}</span></td>
      <td class="mono fw7 ca">${fmt(p.salePrice)}</td>
      <td class="mono cm">${fmt(p.costPrice || 0)}</td>
      <td><span class="badge ${p.stock === 0 ? 'bg-red' : low ? 'bg-orange' : 'bg-green'}">${p.stock} ${p.unit}</span></td>
      <td class="cm">${p.unit}</td>
      <td class="mono cm">${p.reorder}</td>
      <td><div class="flex gap8">
        <button class="btn btn-ghost btn-sm" onclick="openProdModal('${p.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="delProd('${p.id}')">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
  refreshCatFilter();
}

function refreshCatFilter() {
  const sel = document.getElementById('prod-cat-f');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>' +
    db.categories.map(c => `<option ${c.name === cur ? 'selected' : ''}>${c.name}</option>`).join('');
}

function openProdModal(id) {
  const p      = id ? db.products.find(x => x.id === id) : null;
  const errEl  = document.getElementById('mp-err');
  const warnEl = document.getElementById('mp-cat-warn');
  if (errEl)  { errEl.style.display = 'none'; errEl.textContent = ''; }

  document.getElementById('m-prod-title').textContent = p ? 'Edit Product' : 'Add Product';
  document.getElementById('mp-id').value     = p ? p.id         : '';
  document.getElementById('mp-name').value   = p ? p.name       : '';
  document.getElementById('mp-sku').value    = p ? p.sku        : '';
  document.getElementById('mp-price').value  = p ? p.salePrice  : '';
  document.getElementById('mp-cost').value   = p ? (p.costPrice || '') : '';
  document.getElementById('mp-stock').value  = p ? p.stock      : '0';
  document.getElementById('mp-reorder').value = p ? (p.reorder || '') : '';
  document.getElementById('mp-desc').value   = p ? (p.description || '') : '';

  const catSel = document.getElementById('mp-cat');
  catSel.innerHTML = '<option value="">— Select —</option>' +
    db.categories.map(c => `<option value="${c.name}" ${p && p.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('');

  if (warnEl) warnEl.style.display = db.categories.length === 0 ? 'block' : 'none';

  const unitSel = document.getElementById('mp-unit');
  if (p && p.unit) unitSel.value = p.unit;

  openModal('m-prod');
  setTimeout(() => document.getElementById('mp-name').focus(), 100);
}

async function saveProd() {
  const errEl   = document.getElementById('mp-err');
  const showErr = (msg) => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } else toast(msg, 'e'); };

  const name     = v('mp-name').trim();
  const sku      = v('mp-sku').trim();
  const cat      = document.getElementById('mp-cat').value;
  const priceStr = v('mp-price');
  const price    = parseFloat(priceStr);

  if (!name)                               { showErr('اسم المنتج مطلوب.');       return; }
  if (!sku)                                { showErr('الكود / الباركود مطلوب.'); return; }
  if (!cat)                                { showErr('يرجى اختيار فئة.');        return; }
  if (!priceStr || isNaN(price) || price < 0) { showErr('أدخل سعر بيع صحيح.'); return; }

  if (errEl) errEl.style.display = 'none';

  const id         = document.getElementById('mp-id').value;
  const stockVal   = parseInt(v('mp-stock'))   || 0;
  const costVal    = parseFloat(v('mp-cost'))  || 0;
  const reorderVal = parseInt(v('mp-reorder')) || 0;
  const desc       = v('mp-desc').trim();
  const unit       = document.getElementById('mp-unit').value;

  try {
    showLoading('جاري حفظ المنتج…');
    if (id) {
      const oldProd   = db.products.find(p => p.id === id);
      const stockDiff = stockVal - (oldProd?.stock || 0);
      await sbUpdate('products', id, { name, sku, category: cat, unit, sale_price: price, cost_price: costVal, stock: stockVal, reorder: reorderVal, description: desc });
      const idx = db.products.findIndex(p => p.id === id);
      db.products[idx] = { ...oldProd, name, sku, category: cat, unit, salePrice: price, costPrice: costVal, stock: stockVal, reorder: reorderVal, description: desc };
      if (stockDiff !== 0) {
        const logRow     = { id: uid(), product_id: id, product_name: name, type: 'adjustment', change: stockDiff, before: oldProd.stock, after: stockVal, user: currentUser.username, note: 'تعديل منتج', date: now() };
        const inserted   = await sbInsert('inv_logs', logRow);
        db.invLogs.unshift(mapLog(inserted));
      }
    } else {
      if (db.products.find(p => p.sku.toLowerCase() === sku.toLowerCase())) {
        hideLoading(); showErr('يوجد منتج بهذا الكود مسبقاً.'); return;
      }
      const newId    = uid();
      const row      = { id: newId, name, sku, category: cat, unit, sale_price: price, cost_price: costVal, stock: stockVal, reorder: reorderVal, description: desc };
      const inserted = await sbInsert('products', row);
      db.products.push(mapProd(inserted));
      if (stockVal > 0) {
        const logRow      = { id: uid(), product_id: newId, product_name: name, type: 'purchase', change: stockVal, before: 0, after: stockVal, user: currentUser.username, note: 'مخزون ابتدائي', date: now() };
        const insertedLog = await sbInsert('inv_logs', logRow);
        db.invLogs.unshift(mapLog(insertedLog));
      }
    }
    hideLoading();
    closeModal('m-prod');
    renderProductsTable();
    toast('تم حفظ المنتج!', 's');
  } catch(e) { hideLoading(); showErr('Error: ' + e.message); }
}

async function delProd(id) {
  const p = db.products.find(x => x.id === id);
  if (!confirm(`حذف "${p?.name}"؟`)) return;
  try {
    showLoading('جاري الحذف…');
    await sbDelete('products', id);
    db.products = db.products.filter(x => x.id !== id);
    hideLoading(); renderProductsTable(); toast('تم حذف المنتج', 's');
  } catch(e) { hideLoading(); toast('Error: ' + e.message, 'e'); }
}

function exportProductsCSV() {
  let csv = 'Name,SKU,Category,Sale Price,Cost,Stock,Unit,Reorder\n';
  db.products.forEach(p => { csv += `"${p.name}","${p.sku}","${p.category}",${p.salePrice},${p.costPrice || 0},${p.stock},"${p.unit}",${p.reorder || 0}\n`; });
  downloadFile('products.csv', csv, 'text/csv');
}

// ════════════════════════════════════════
//  CATEGORIES
// ════════════════════════════════════════
function renderCatsTable() {
  const tbody = document.getElementById('cat-tbody');
  if (!db.categories.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="ei">🗂️</div><div class="et">لا توجد فئات</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = db.categories.map((c, i) => {
    const count = db.products.filter(p => p.category === c.name).length;
    return `<tr>
      <td class="mono cm">${i + 1}</td>
      <td><strong>${c.name}</strong></td>
      <td class="cm">${c.description || '—'}</td>
      <td><span class="badge bg-blue">${count}</span></td>
      <td><div class="flex gap8">
        <button class="btn btn-ghost btn-sm" onclick="openCatModal('${c.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="delCat('${c.id}')">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openCatModal(id) {
  const c = id ? db.categories.find(x => x.id === id) : null;
  document.getElementById('m-cat-title').textContent = c ? 'Edit Category' : 'Add Category';
  document.getElementById('mc-id').value   = c ? c.id              : '';
  document.getElementById('mc-name').value = c ? c.name            : '';
  document.getElementById('mc-desc').value = c ? (c.description || '') : '';
  openModal('m-cat');
}

async function saveCat() {
  const name = v('mc-name').trim();
  if (!name) { toast('اسم الفئة مطلوب', 'e'); return; }
  const id = document.getElementById('mc-id').value;
  try {
    showLoading('جاري الحفظ…');
    if (id) {
      const old = db.categories.find(c => c.id === id)?.name;
      await sbUpdate('categories', id, { name, description: v('mc-desc').trim() });
      const idx = db.categories.findIndex(c => c.id === id);
      db.categories[idx] = { ...db.categories[idx], name, description: v('mc-desc').trim() };
      for (const p of db.products.filter(p => p.category === old)) {
        await sbUpdate('products', p.id, { category: name });
        p.category = name;
      }
    } else {
      if (db.categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
        hideLoading(); toast('الفئة موجودة مسبقاً!', 'e'); return;
      }
      const row      = { id: uid(), name, description: v('mc-desc').trim() };
      const inserted = await sbInsert('categories', row);
      db.categories.push(mapCat(inserted));
    }
    hideLoading(); closeModal('m-cat'); renderCatsTable(); toast('تم حفظ الفئة!', 's');
  } catch(e) { hideLoading(); toast('Error: ' + e.message, 'e'); }
}

async function delCat(id) {
  const c    = db.categories.find(x => x.id === id);
  const used = db.products.filter(p => p.category === c?.name).length;
  if (used > 0) { toast(`لا يمكن الحذف — ${used} منتج يستخدم هذه الفئة`, 'e'); return; }
  if (!confirm(`حذف الفئة "${c?.name}"?`)) return;
  try {
    showLoading('جاري الحذف…');
    await sbDelete('categories', id);
    db.categories = db.categories.filter(x => x.id !== id);
    hideLoading(); renderCatsTable(); toast('تم حذف الفئة', 's');
  } catch(e) { hideLoading(); toast('Error: ' + e.message, 'e'); }
}

// ════════════════════════════════════════
//  INVENTORY
// ════════════════════════════════════════
function renderInventory() {
  const lowProds = db.products.filter(p => p.stock <= p.reorder);
  if (lowProds.length) {
    show('inv-alert');
    set('inv-alert-txt', `${lowProds.length} منتج عند حد إعادة الطلب أو أقل.`);
  } else { hide('inv-alert'); }

  const logs  = [...db.invLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
  const tbody = document.getElementById('inv-tbody');
  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty"><div class="ei">📋</div><div class="es">لا توجد حركات مخزون بعد</div></div></td></tr>`;
  } else {
    tbody.innerHTML = logs.map(l => {
      const typeMap = { sale: 'bg-red', purchase: 'bg-green', return: 'bg-blue', adjustment: 'bg-orange', damage: 'bg-red' };
      return `<tr>
        <td class="mono cm" style="font-size:11px">${fmtDate(l.date)}</td>
        <td>${l.productName}</td>
        <td><span class="badge ${typeMap[l.type] || 'bg-blue'}">${l.type.toUpperCase()}</span></td>
        <td class="mono">${l.before}</td>
        <td class="mono ${l.change > 0 ? 'cg' : 'cr'}">${l.change > 0 ? '+' : ''}${l.change}</td>
        <td class="mono">${l.after}</td>
        <td class="cm">${l.user}</td>
        <td class="cm" style="font-size:12px">${l.note || '—'}</td>
      </tr>`;
    }).join('');
  }

  const sel = document.getElementById('adj-prod');
  sel.innerHTML = '<option value="">Select product…</option>' +
    db.products.map(p => `<option value="${p.id}">${p.name} (Stock: ${p.stock})</option>`).join('');

  const lowEl = document.getElementById('inv-low-list');
  if (!lowProds.length) {
    lowEl.innerHTML = `<div class="empty"><div class="ei">✅</div><div class="es">المخزون كامل!</div></div>`;
  } else {
    lowEl.innerHTML = lowProds.map(p => {
      const pct = p.reorder > 0 ? Math.min(Math.round((p.stock / p.reorder) * 100), 100) : 0;
      const col = p.stock === 0 ? 'var(--red)' : 'var(--accent)';
      return `<div class="card card-sm mb8">
        <div class="fbet mb8">
          <div>
            <div style="font-size:13px;font-weight:600">${p.name}</div>
            <div class="mono cm" style="font-size:10px">${p.sku}</div>
          </div>
          <span class="badge bg-red">${p.stock}/${p.reorder}</span>
        </div>
        <div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${col}"></div></div>
      </div>`;
    }).join('');
  }
}

async function doAdjust() {
  const prodId = document.getElementById('adj-prod').value;
  const type   = document.getElementById('adj-type').value;
  const qty    = parseInt(document.getElementById('adj-qty').value);
  const note   = document.getElementById('adj-note').value.trim();
  if (!prodId) { toast('اختر منتجاً', 'e'); return; }
  if (isNaN(qty) || qty === 0) { toast('أدخل كمية صحيحة', 'e'); return; }
  const prod = db.products.find(p => p.id === prodId);
  if (!prod) return;
  const before = prod.stock;
  const after  = Math.max(0, before + qty);
  try {
    showLoading('جاري حفظ التعديل…');
    await sbUpdate('products', prod.id, { stock: after });
    prod.stock = after;
    const logRow      = { id: uid(), product_id: prod.id, product_name: prod.name, type, change: qty, before, after, user: currentUser.username, note: note || type, date: now() };
    const insertedLog = await sbInsert('inv_logs', logRow);
    db.invLogs.unshift(mapLog(insertedLog));
    hideLoading();
    document.getElementById('adj-qty').value  = '';
    document.getElementById('adj-note').value = '';
    renderInventory();
    toast('تم حفظ التعديل!', 's');
  } catch(e) { hideLoading(); toast('Error: ' + e.message, 'e'); }
}

// ════════════════════════════════════════
//  INVOICES
// ════════════════════════════════════════
function renderInvoicesTable() {
  const q    = (v('inv-q') || '').toLowerCase();
  const from = document.getElementById('inv-date-from')?.value || '';
  const to   = document.getElementById('inv-date-to')?.value   || '';
  let invs   = [...db.invoices].sort((a, b) => b.date.localeCompare(a.date));
  if (q)    invs = invs.filter(i => i.num.toLowerCase().includes(q));
  if (from) invs = invs.filter(i => i.date.slice(0, 10) >= from);
  if (to)   invs = invs.filter(i => i.date.slice(0, 10) <= to);
  const tbody = document.getElementById('inv-tbody-main');
  if (!invs.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty"><div class="ei">🧾</div><div class="et">لا توجد فواتير</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = invs.map(i => `<tr>
    <td class="mono ca">#${i.num}</td>
    <td class="mono cm" style="font-size:12px">${fmtDate(i.date)}</td>
    <td class="cm">${i.cashier}</td>
    <td class="mono">${i.items.length}</td>
    <td class="mono">${fmt(i.subtotal)}</td>
    <td class="mono cg">-${fmt(i.discount || 0)}</td>
    <td class="mono cr">+${fmt(i.tax || 0)}</td>
    <td class="mono fw7">${fmt(i.total)}</td>
    <td class="mono">${fmt(i.paid)}</td>
    <td class="mono cg">${fmt(i.change)}</td>
    <td><div class="flex gap8">
      <button class="btn btn-ghost btn-sm" onclick="viewInvoice('${i.id}')">View</button>
      <button class="btn btn-ghost btn-sm" onclick="printReceipt('${i.id}')">🖨</button>
    </div></td>
  </tr>`).join('');
}

function viewInvoice(id) {
  const inv = db.invoices.find(i => i.id === id);
  if (!inv) return;
  document.getElementById('m-inv-title').textContent = 'Invoice #' + inv.num;
  document.getElementById('m-inv-body').innerHTML    = buildReceiptHTML(inv, true);
  document.getElementById('m-inv-print').onclick     = () => printReceipt(id);
  openModal('m-inv');
}

function exportInvoicesCSV() {
  let csv = 'Invoice#,Date,كاشير,Items,Subtotal,Discount,Tax,Total,Paid,Change\n';
  db.invoices.forEach(i => { csv += `"${i.num}","${fmtDate(i.date)}","${i.cashier}",${i.items.length},${i.subtotal},${i.discount || 0},${i.tax || 0},${i.total},${i.paid},${i.change}\n`; });
  downloadFile('invoices.csv', csv, 'text/csv');
}

// ════════════════════════════════════════
//  REPORTS
// ════════════════════════════════════════
function setRepRange(range) {
  const t = new Date();
  let from = today(), to = today();
  if (range === 'week')  { const d = new Date(t); d.setDate(t.getDate() - 6); from = d.toISOString().slice(0, 10); }
  if (range === 'month') { from = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-01'; }
  document.getElementById('rep-from').value = from;
  document.getElementById('rep-to').value   = to;
}

function renderReports() {
  const from = document.getElementById('rep-from').value || today();
  const to   = document.getElementById('rep-to').value   || today();
  const invs = db.invoices.filter(i => i.date.slice(0, 10) >= from && i.date.slice(0, 10) <= to);
  const rev  = invs.reduce((s, i) => s + i.total, 0);
  const tax  = invs.reduce((s, i) => s + (i.tax || 0), 0);
  set('rep-rev', fmt(rev));
  set('rep-txn', invs.length);
  set('rep-avg', fmt(invs.length ? rev / invs.length : 0));
  set('rep-tax', fmt(tax));

  const soldMap = {};
  invs.forEach(inv => inv.items.forEach(item => {
    if (!soldMap[item.productId]) soldMap[item.productId] = { qty: 0, rev: 0, name: item.name };
    soldMap[item.productId].qty += item.qty;
    soldMap[item.productId].rev += item.lineTotal;
  }));
  const top   = Object.values(soldMap).sort((a, b) => b.rev - a.rev).slice(0, 10);
  const topEl = document.getElementById('rep-top');
  topEl.innerHTML = top.length
    ? top.map(p => `<tr><td>${p.name}</td><td class="mono">${p.qty}</td><td class="mono ca">${fmt(p.rev)}</td></tr>`).join('')
    : `<tr><td colspan="3"><div class="empty"><div class="ei">📊</div><div class="es">No data</div></div></td></tr>`;

  const catMap = {};
  invs.forEach(inv => inv.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    const cat  = prod?.category || 'Unknown';
    catMap[cat] = (catMap[cat] || 0) + item.lineTotal;
  }));
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const catEl      = document.getElementById('rep-cat');
  catEl.innerHTML  = catEntries.length
    ? catEntries.map(([cat, rev]) => {
        const total = catEntries.reduce((s, e) => s + e[1], 0);
        return `<tr><td>${cat}</td><td class="mono ca">${fmt(rev)}</td><td><span class="badge bg-orange">${Math.round(rev / Math.max(total, 1) * 100)}%</span></td></tr>`;
      }).join('')
    : `<tr><td colspan="3"><div class="empty"><div class="ei">📊</div><div class="es">No data</div></div></td></tr>`;
}

// ════════════════════════════════════════
//  USERS
// ════════════════════════════════════════
function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = db.users.map((u, i) => `<tr>
    <td class="mono cm">${i + 1}</td>
    <td><strong>${u.name}</strong></td>
    <td class="mono">${u.username}</td>
    <td><span class="badge ${u.role === 'admin' ? 'bg-orange' : 'bg-blue'}">${u.role}</span></td>
    <td class="mono cm">${fmtDateShort(u.createdAt)}</td>
    <td><div class="flex gap8">
      <button class="btn btn-ghost btn-sm" onclick="openUserModal('${u.id}')">Edit</button>
      ${u.id !== currentUser.id ? `<button class="btn btn-danger btn-sm" onclick="delUser('${u.id}')">Delete</button>` : ''}
    </div></td>
  </tr>`).join('');
}

function openUserModal(id) {
  const u = id ? db.users.find(x => x.id === id) : null;
  document.getElementById('m-user-title').textContent     = u ? 'Edit User' : 'Add User';
  document.getElementById('mu-id').value                  = u ? u.id       : '';
  document.getElementById('mu-name').value                = u ? u.name     : '';
  document.getElementById('mu-uname').value               = u ? u.username : '';
  document.getElementById('mu-pass').value                = '';
  document.getElementById('mu-role').value                = u ? u.role     : 'cashier';
  document.getElementById('mu-pass-hint').style.display   = u ? 'inline'   : 'none';
  openModal('m-user');
}

async function saveUser() {
  const name     = v('mu-name').trim();
  const username = v('mu-uname').trim();
  const pass     = v('mu-pass');
  const role     = document.getElementById('mu-role').value;
  const id       = document.getElementById('mu-id').value;
  if (!name || !username) { toast('الاسم واسم المستخدم مطلوبان', 'e'); return; }
  if (!id && !pass)       { toast('كلمة المرور مطلوبة للمستخدمين الجدد', 'e'); return; }
  if (pass && pass.length < 6) { toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'e'); return; }
  const dup = db.users.find(u => u.username === username && u.id !== id);
  if (dup) { toast('اسم المستخدم مستخدم مسبقاً', 'e'); return; }
  try {
    showLoading('جاري حفظ المستخدم…');
    if (id) {
      const changes = { name, username, role, ...(pass ? { pass_hash: simpleHash(pass) } : {}) };
      await sbUpdate('users', id, changes);
      const idx = db.users.findIndex(u => u.id === id);
      db.users[idx] = { ...db.users[idx], name, username, role, ...(pass ? { passHash: simpleHash(pass) } : {}) };
    } else {
      const row      = { id: uid(), name, username, pass_hash: simpleHash(pass), role };
      const inserted = await sbInsert('users', row);
      db.users.push(mapUser(inserted));
    }
    hideLoading(); closeModal('m-user'); renderUsersTable(); toast('تم حفظ المستخدم!', 's');
  } catch(e) { hideLoading(); toast('Error: ' + e.message, 'e'); }
}

async function delUser(id) {
  if (id === currentUser.id) { toast("لا يمكنك حذف حسابك الخاص", 'e'); return; }
  const u = db.users.find(x => x.id === id);
  if (!confirm(`حذف المستخدم "${u?.name}"?`)) return;
  try {
    showLoading('جاري الحذف…');
    await sbDelete('users', id);
    db.users = db.users.filter(x => x.id !== id);
    hideLoading(); renderUsersTable(); toast('تم حذف المستخدم', 's');
  } catch(e) { hideLoading(); toast('Error: ' + e.message, 'e'); }
}

// ════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════
function loadSettingsForm() {
  const s = db.settings;
  const fields = {
    's-name':   s.storeName,
    's-phone':  s.phone,
    's-addr':   s.address,
    's-vat':    s.vat,
    's-email':  s.email,
    's-footer': s.footer,
    's-tax':    s.taxRate,
    's-taxlbl': s.taxLabel,
    's-curr':   s.currency,
  };
  Object.entries(fields).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  const printer = document.getElementById('s-printer'); if (printer) printer.value = s.printer || 'thermal80';
  const logo    = document.getElementById('s-logo');    if (logo)    logo.value    = s.showLogo === 0 ? '0' : '1';
  const showVat = document.getElementById('s-show-vat'); if (showVat) showVat.value = s.showVat === 0  ? '0' : '1';
}

function saveSettings() {
  db.settings = {
    storeName: v('s-name'),
    phone:     v('s-phone'),
    address:   v('s-addr'),
    vat:       v('s-vat'),
    email:     v('s-email'),
    footer:    v('s-footer'),
    taxRate:   parseFloat(v('s-tax')) || 0,
    taxLabel:  v('s-taxlbl') || 'Tax',
    currency:  v('s-curr') || '$',
    printer:   document.getElementById('s-printer')?.value  || 'thermal80',
    showLogo:  document.getElementById('s-logo')?.value     === '0' ? 0 : 1,
    showVat:   document.getElementById('s-show-vat')?.value === '0' ? 0 : 1,
  };
  saveDB();
  toast('تم حفظ الإعدادات!', 's');
  const tl = document.getElementById('pi-taxlbl');
  if (tl) tl.textContent = db.settings.taxRate;
}

async function showDBPath() {
  const res = await window.voltDB.getPath();
  alert('📁 مسار قاعدة البيانات:\n' + res);
}

function showSettingsTab(tab, el) {
  document.querySelectorAll('[id^="stab-"]').forEach(e => e.style.display = 'none');
  document.getElementById('stab-' + tab).style.display = 'block';
  document.querySelectorAll('.s-tab').forEach(e => e.classList.remove('on'));
  el.classList.add('on');
}

// ════════════════════════════════════════
//  BACKUP & RESTORE
// ════════════════════════════════════════
async function exportBackup() {
  try {
    const res = await window.voltDB.backup();
    if (res.error) { toast('فشل الحفظ: ' + res.error, 'e'); return; }
    downloadFile(`voltpos-backup-${today()}.json`, res.data, 'application/json');
    toast('تم تحميل النسخة الاحتياطية!', 's');
  } catch(e) { toast('خطأ: ' + e.message, 'e'); }
}

function disconnectSupabase() {
  // غير مستخدم في وضع سطح المكتب
}

async function importBackup() {
  const file = document.getElementById('restore-file').files[0];
  if (!file) { toast('اختر ملف النسخة الاحتياطية أولاً', 'e'); return; }
  if (!confirm('سيتم استبدال جميع البيانات الحالية. هل تريد المتابعة؟')) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      showLoading('جاري استعادة النسخة الاحتياطية…');
      const res = await window.voltDB.restore(e.target.result);
      if (res.error) throw new Error(res.error);
      hideLoading();
      toast('تمت الاستعادة! جاري إعادة التحميل…', 's');
      setTimeout(() => location.reload(), 1200);
    } catch(err) { hideLoading(); toast('فشلت الاستعادة: ' + err.message, 'e'); }
  };
  reader.readAsText(file);
}

// ════════════════════════════════════════
//  PRINT / RECEIPT
// ════════════════════════════════════════
function buildReceiptHTML(inv, forModal = false) {
  const s         = db.settings;
  const lineItems = inv.items.map(item => `
    <div class="r-row"><span>${item.name} x${item.qty}</span><span>${fmt(item.lineTotal)}</span></div>
    <div style="font-size:11px;color:#888">${fmt(item.unitPrice)} each</div>
  `).join('');

  if (forModal) {
    return `<div class="receipt-wrap">
      ${s.storeName ? `<div class="r-c r-bold" style="font-size:15px">${s.storeName}</div>` : ''}
      ${s.address   ? `<div class="r-c" style="font-size:11px">${s.address}</div>` : ''}
      ${s.phone     ? `<div class="r-c" style="font-size:11px">Tel: ${s.phone}</div>` : ''}
      ${s.vat && s.showVat ? `<div class="r-c" style="font-size:11px">VAT: ${s.vat}</div>` : ''}
      <hr class="r-hr">
      <div class="r-c r-bold">INVOICE #${inv.num}</div>
      <div class="r-c" style="font-size:11px">${fmtDate(inv.date)}</div>
      <div class="r-c" style="font-size:11px">كاشير: ${inv.cashier}</div>
      <hr class="r-hr">
      ${lineItems}
      <hr class="r-hr">
      <div class="r-row"><span>المجموع الفرعي</span><span>${fmt(inv.subtotal)}</span></div>
      ${inv.discount ? `<div class="r-row"><span>الخصم</span><span>-${fmt(inv.discount)}</span></div>` : ''}
      <div class="r-row"><span>Tax (${s.taxRate || 0}%)</span><span>+${fmt(inv.tax || 0)}</span></div>
      <hr class="r-hr">
      <div class="r-row r-bold" style="font-size:14px"><span>الإجمالي</span><span>${fmt(inv.total)}</span></div>
      <div class="r-row"><span>المدفوع</span><span>${fmt(inv.paid)}</span></div>
      <div class="r-row"><span>الباقي</span><span>${fmt(inv.change)}</span></div>
      <hr class="r-hr">
      <div class="r-c" style="font-size:11px">${s.footer || 'شكراً لك!'}</div>
    </div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${inv.num}</title>
  <style>body{font-family:monospace;font-size:12px;max-width:300px;margin:20px auto;padding:10px}.r-c{text-align:center}.r-row{display:flex;justify-content:space-between}.r-bold{font-weight:700}.r-hr{border:none;border-top:1px dashed #999;margin:8px 0}@media print{@page{margin:5mm}}</style>
  </head><body>
  ${s.storeName ? `<div class="r-c r-bold" style="font-size:15px">${s.storeName}</div>` : ''}
  ${s.address   ? `<div class="r-c">${s.address}</div>` : ''}
  ${s.phone     ? `<div class="r-c">Tel: ${s.phone}</div>` : ''}
  <hr class="r-hr"><div class="r-c r-bold">INVOICE #${inv.num}</div>
  <div class="r-c">${fmtDate(inv.date)}</div>
  <hr class="r-hr">${lineItems}<hr class="r-hr">
  <div class="r-row"><span>المجموع الفرعي</span><span>${fmt(inv.subtotal)}</span></div>
  ${inv.discount ? `<div class="r-row"><span>الخصم</span><span>-${fmt(inv.discount)}</span></div>` : ''}
  <div class="r-row"><span>Tax</span><span>+${fmt(inv.tax || 0)}</span></div>
  <hr class="r-hr">
  <div class="r-row r-bold" style="font-size:14px"><span>الإجمالي</span><span>${fmt(inv.total)}</span></div>
  <div class="r-row"><span>المدفوع</span><span>${fmt(inv.paid)}</span></div>
  <div class="r-row"><span>الباقي</span><span>${fmt(inv.change)}</span></div>
  <hr class="r-hr"><div class="r-c">${s.footer || 'شكراً لك!'}</div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script>
  </body></html>`;
}

function printReceipt(id) {
  const inv = db.invoices.find(i => i.id === id);
  if (!inv) { toast('الفاتورة غير موجودة', 'e'); return; }
  const frame = document.getElementById('print-frame');
  frame.src   = 'about:blank';
  setTimeout(() => {
    frame.contentDocument.open();
    frame.contentDocument.write(buildReceiptHTML(inv, false));
    frame.contentDocument.close();
  }, 100);
}

// ════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════
function v(id)        { return document.getElementById(id)?.value || ''; }
function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function show(id)     { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id)     { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function toast(msg, type = 'i') {
  const icons = { s: '✅', e: '❌', i: 'ℹ️' };
  const cont  = document.getElementById('toasts');
  const t     = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  cont.appendChild(t);
  setTimeout(() => {
    t.style.opacity    = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(() => t.remove(), 350);
  }, 3000);
}

function showLoading(msg) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.85);backdrop-filter:blur(4px);z-index:9998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px';
    el.innerHTML = `
      <div style="width:40px;height:40px;border:4px solid #dde1ea;border-top-color:#f5a623;border-radius:50%;animation:spin .7s linear infinite"></div>
      <div style="font-size:14px;color:#4a5270;font-weight:600" id="loading-msg">Loading…</div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(el);
  }
  document.getElementById('loading-msg').textContent = msg || 'جاري التحميل…';
  el.style.display = 'flex';
}
function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

function downloadFile(name, content, mime) {
  const a = document.createElement('a');
  a.href  = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
}

function simpleHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function now()             { return new Date().toISOString(); }
function uid()             { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }
function today()           { return new Date().toISOString().slice(0, 10); }
function fmt(n)            { const s = db.settings; return (s.currency || '') + Number(n || 0).toFixed(2); }
function fmtNum(n)         { return Number(n || 0).toFixed(2); }
function fmtDate(iso)      { return iso ? new Date(iso).toLocaleString() : '—'; }
function fmtDateShort(iso) { return iso ? iso.slice(0, 10) : '—'; }

// ════════════════════════════════════════
//  BARCODE SCANNER
// ════════════════════════════════════════
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const barcodeInput = document.getElementById('pos-barcode');
    if (!barcodeInput) return;

    barcodeInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = this.value.trim();
        if (!code) return;
        const prod = db.products.find(p => p.sku === code || p.name.toLowerCase() === code.toLowerCase());
        if (prod) {
          if (prod.stock <= 0) { toast('المنتج نفد من المخزون!', 'e'); }
          else { addToCart(prod.id); toast(`✅ تمت الإضافة: ${prod.name}`, 's'); }
        } else {
          toast(`الباركود غير موجود: ${code}`, 'e');
        }
        this.value = '';
        this.focus();
      }
    });

    document.querySelectorAll('.s-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.screen === 'pos') {
          setTimeout(() => barcodeInput.focus(), 150);
        }
      });
    });
  });
})();

// ════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (!currentUser) return;
  if (e.key === 'F1')             { e.preventDefault(); nav('pos'); setTimeout(() => document.getElementById('pos-q')?.focus(), 100); }
  if (e.key === 'F2')             { e.preventDefault(); completeSale(); }
  if (e.key === 'F3')             { e.preventDefault(); openDebtModal(); }
  if (e.ctrlKey && e.key === 'p') { e.preventDefault(); printLastReceipt(); }
});
