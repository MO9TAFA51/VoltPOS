// ════════════════════════════════════════
//  VoltPOS — Firebase Configuration
//  🔥 استبدل القيم دي بـ config بتاعك
// ════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  getDocs, setDoc, updateDoc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️ ضع firebaseConfig بتاعك هنا
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const firestoreDB = getFirestore(app);

// ── Table name mapping (SQLite → Firestore collections) ──
const TABLE_MAP = {
  users:      'users',
  categories: 'categories',
  products:   'products',
  invoices:   'invoices',
  inv_logs:   'inv_logs',
  debts:      'debts',
  settings:   'settings',
};

// ── voltDB shim: نفس الـ API اللي كان Electron بيوفره ──
window.voltDB = {

  // تحميل كل البيانات دفعة واحدة عند البداية
  async loadAll() {
    try {
      const [users, categories, products, invoices, invLogs, debts] = await Promise.all([
        getDocs(collection(firestoreDB, 'users')),
        getDocs(collection(firestoreDB, 'categories')),
        getDocs(collection(firestoreDB, 'products')),
        getDocs(collection(firestoreDB, 'invoices')),
        getDocs(collection(firestoreDB, 'inv_logs')),
        getDocs(collection(firestoreDB, 'debts')),
      ]);

      // جلب الإعدادات
      let settings = null;
      try {
        const settingsSnap = await getDoc(doc(firestoreDB, 'settings', 'main'));
        if (settingsSnap.exists()) settings = { id: 'main', ...settingsSnap.data() };
      } catch(e) {}

      return {
        users:      users.docs.map(d  => ({ id: d.id, ...d.data() })),
        categories: categories.docs.map(d => ({ id: d.id, ...d.data() })),
        products:   products.docs.map(d  => ({ id: d.id, ...d.data() })),
        invoices:   invoices.docs.map(d  => ({ id: d.id, ...d.data() })),
        invLogs:    invLogs.docs.map(d   => ({ id: d.id, ...d.data() })),
        debts:      debts.docs.map(d    => ({ id: d.id, ...d.data() })),
        settings,
      };
    } catch(e) {
      return { error: e.message };
    }
  },

  // إدراج صف جديد
  async insert(table, row) {
    try {
      const col  = TABLE_MAP[table] || table;
      const docRef = doc(collection(firestoreDB, col), row.id || undefined);
      const data   = { ...row, id: docRef.id };
      await setDoc(docRef, data);
      return { data };
    } catch(e) {
      return { error: e.message };
    }
  },

  // تحديث صف موجود
  async update(table, id, changes) {
    try {
      const col = TABLE_MAP[table] || table;
      await updateDoc(doc(firestoreDB, col, id), changes);
      return { data: { id, ...changes } };
    } catch(e) {
      return { error: e.message };
    }
  },

  // حذف صف
  async delete(table, id) {
    try {
      const col = TABLE_MAP[table] || table;
      await deleteDoc(doc(firestoreDB, col, id));
      return { data: { id } };
    } catch(e) {
      return { error: e.message };
    }
  },

  // upsert (insert أو update)
  async upsert(table, row) {
    try {
      const col    = TABLE_MAP[table] || table;
      const id     = row.id || 'main';
      const docRef = doc(firestoreDB, col, id);
      await setDoc(docRef, { ...row, id }, { merge: true });
      return { data: { ...row, id } };
    } catch(e) {
      return { error: e.message };
    }
  },

  // مسار قاعدة البيانات (Firestore بدل محلي)
  async getPath() {
    return `Firestore: ${firebaseConfig.projectId}`;
  },

  // تصدير نسخة احتياطية JSON
  async backup() {
    try {
      const all = await window.voltDB.loadAll();
      if (all.error) return { error: all.error };
      return { data: JSON.stringify(all, null, 2) };
    } catch(e) {
      return { error: e.message };
    }
  },

  // استعادة من نسخة احتياطية JSON
  async restore(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const tables = ['users', 'categories', 'products', 'invoices', 'inv_logs', 'debts'];
      for (const table of tables) {
        if (!data[table]) continue;
        for (const row of data[table]) {
          if (!row.id) continue;
          await setDoc(doc(firestoreDB, TABLE_MAP[table] || table, row.id), row);
        }
      }
      if (data.settings) {
        await setDoc(doc(firestoreDB, 'settings', 'main'), data.settings, { merge: true });
      }
      return { data: 'ok' };
    } catch(e) {
      return { error: e.message };
    }
  },
};

console.log('🔥 Firebase voltDB shim loaded');
