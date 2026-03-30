// ════════════════════════════════════════
//  VoltPOS — Demo Mode (بيانات وهمية)
//  بدون لوجين، بدون داتا بيز
// ════════════════════════════════════════

window.DEMO_MODE = true;

window.voltDB = {
  async loadAll() {
    return {
      users: [
        { id: '1', name: 'أحمد مدير', username: 'admin', pass_hash: 'demo', role: 'admin', created_at: '2024-01-01T00:00:00.000Z' }
      ],
      categories: [
        { id: 'c1', name: 'كابلات وأسلاك',    description: 'أنواع الكابلات الكهربائية', created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'c2', name: 'مفاتيح وقواطع',    description: 'مفاتيح التحكم والقواطع',   created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'c3', name: 'إضاءة LED',        description: 'لمبات ولوحات LED',          created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'c4', name: 'مقابس وتوصيلات',   description: 'مقابس وتوصيلات كهربائية',  created_at: '2024-01-01T00:00:00.000Z' },
      ],
      products: [
        { id: 'p1',  name: 'كابل NYY 2.5mm',     sku: 'NYY-25',  category: 'كابلات وأسلاك',  unit: 'متر',   sale_price: 12,  cost_price: 8,   stock: 500, reorder: 50,  description: 'كابل نحاسي مدفون', created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'p2',  name: 'كابل NYY 4mm',        sku: 'NYY-4',   category: 'كابلات وأسلاك',  unit: 'متر',   sale_price: 18,  cost_price: 12,  stock: 300, reorder: 30,  description: 'كابل نحاسي مدفون', created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'p3',  name: 'سلك أحمر 1.5mm',      sku: 'WR-15',   category: 'كابلات وأسلاك',  unit: 'متر',   sale_price: 5,   cost_price: 3,   stock: 8,   reorder: 20,  description: 'سلك نحاسي مفرد',   created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'p4',  name: 'قاطع 16A أحادي',      sku: 'CB-16A',  category: 'مفاتيح وقواطع',  unit: 'قطعة',  sale_price: 35,  cost_price: 22,  stock: 150, reorder: 20,  description: 'قاطع حماية كهربائي', created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'p5',  name: 'قاطع 32A ثلاثي',      sku: 'CB-32A3', category: 'مفاتيح وقواطع',  unit: 'قطعة',  sale_price: 95,  cost_price: 60,  stock: 60,  reorder: 10,  description: 'قاطع ثلاثي الأوجه', created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'p6',  name: 'مفتاح إضاءة مفرد',    sku: 'SW-S1',   category: 'مفاتيح وقواطع',  unit: 'قطعة',  sale_price: 8,   cost_price: 4,   stock: 200, reorder: 30,  description: 'مفتاح حائط كلاسيك', created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'p7',  name: 'لمبة LED 9W',          sku: 'LED-9W',  category: 'إضاءة LED',      unit: 'قطعة',  sale_price: 15,  cost_price: 8,   stock: 400, reorder: 50,  description: 'لمبة ليد توفير',    created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'p8',  name: 'لمبة LED 18W',         sku: 'LED-18W', category: 'إضاءة LED',      unit: 'قطعة',  sale_price: 25,  cost_price: 14,  stock: 5,   reorder: 20,  description: 'لمبة ليد قوية',     created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'p9',  name: 'مقبس أرضي مزدوج',      sku: 'SOC-D2',  category: 'مقابس وتوصيلات', unit: 'قطعة',  sale_price: 22,  cost_price: 13,  stock: 120, reorder: 20,  description: 'مقبس حائط مزدوج',  created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'p10', name: 'وصلة تمديد 5م',        sku: 'EXT-5M',  category: 'مقابس وتوصيلات', unit: 'قطعة',  sale_price: 45,  cost_price: 28,  stock: 80,  reorder: 15,  description: 'وصلة كهربائية 5 متر', created_at: '2024-01-01T00:00:00.000Z' },
      ],
      invoices: [
        { id: 'inv1', num: 'INV-0001', date: new Date(Date.now()-86400000*2).toISOString(), cashier: 'أحمد مدير', items: JSON.stringify([{productId:'p7', name:'لمبة LED 9W', sku:'LED-9W', qty:10, unitPrice:15, lineTotal:150},{productId:'p4', name:'قاطع 16A أحادي', sku:'CB-16A', qty:2, unitPrice:35, lineTotal:70}]), subtotal:220, discount:20, tax:30, total:230, paid:230, change:0 },
        { id: 'inv2', num: 'INV-0002', date: new Date(Date.now()-86400000).toISOString(),   cashier: 'أحمد مدير', items: JSON.stringify([{productId:'p1', name:'كابل NYY 2.5mm', sku:'NYY-25', qty:50, unitPrice:12, lineTotal:600}]), subtotal:600, discount:0, tax:90, total:690, paid:700, change:10 },
        { id: 'inv3', num: 'INV-0003', date: new Date(Date.now()-3600000).toISOString(),    cashier: 'أحمد مدير', items: JSON.stringify([{productId:'p9', name:'مقبس أرضي مزدوج', sku:'SOC-D2', qty:5, unitPrice:22, lineTotal:110},{productId:'p6', name:'مفتاح إضاءة مفرد', sku:'SW-S1', qty:4, unitPrice:8, lineTotal:32}]), subtotal:142, discount:0, tax:21, total:163, paid:200, change:37 },
      ],
      invLogs: [
        { id: 'l1', product_id: 'p7', product_name: 'لمبة LED 9W',       type: 'sale',     change: -10, before: 410, after: 400, user: 'أحمد مدير', note: '#INV-0001', date: new Date(Date.now()-86400000*2).toISOString() },
        { id: 'l2', product_id: 'p4', product_name: 'قاطع 16A أحادي',    type: 'sale',     change: -2,  before: 152, after: 150, user: 'أحمد مدير', note: '#INV-0001', date: new Date(Date.now()-86400000*2).toISOString() },
        { id: 'l3', product_id: 'p1', product_name: 'كابل NYY 2.5mm',     type: 'sale',     change: -50, before: 550, after: 500, user: 'أحمد مدير', note: '#INV-0002', date: new Date(Date.now()-86400000).toISOString() },
        { id: 'l4', product_id: 'p2', product_name: 'كابل NYY 4mm',       type: 'purchase', change: 100, before: 200, after: 300, user: 'أحمد مدير', note: 'استلام بضاعة', date: new Date(Date.now()-86400000*3).toISOString() },
      ],
      debts: [
        { id: 'd1', customer_name: 'مؤسسة النور للمقاولات', phone: '0501234567', items: JSON.stringify([{productId:'p5', name:'قاطع 32A ثلاثي', qty:3, unitPrice:95, lineTotal:285}]), subtotal:285, discount:0, tax:42, total:327, note:'مشروع فيلا الرياض', status:'unpaid', cashier:'أحمد مدير', date: new Date(Date.now()-86400000*5).toISOString(), paid_date: null },
        { id: 'd2', customer_name: 'أبو خالد الكهربائي',    phone: '0559876543', items: JSON.stringify([{productId:'p1', name:'كابل NYY 2.5mm', qty:100, unitPrice:12, lineTotal:1200}]), subtotal:1200, discount:100, tax:165, total:1265, note:'', status:'paid', cashier:'أحمد مدير', date: new Date(Date.now()-86400000*10).toISOString(), paid_date: new Date(Date.now()-86400000*3).toISOString() },
      ],
      settings: { id: 'main', store_name: 'مغلق — أدوات كهربائية', phone: '0501234567', address: 'الرياض، حي الصناعية', vat: '310012345600003', email: 'info@maghloq.com', footer: 'شكراً لزيارتكم! نتمنى لكم يوماً سعيداً', tax_rate: 15, tax_label: 'VAT', currency: 'ر.س', printer: 'thermal80', show_logo: 1, show_vat: 1 }
    };
  },
  async insert(t, row) { return { data: { ...row, id: row.id || 'demo-' + Date.now() } }; },
  async update(t, id, changes) { return { data: { id, ...changes } }; },
  async delete(t, id) { return { data: { id } }; },
  async upsert(t, row) { return { data: row }; },
  async getPath() { return 'Demo Mode — No Database'; },
  async backup() { return { data: '{}' }; },
  async restore() { return { data: 'ok' }; },
};
