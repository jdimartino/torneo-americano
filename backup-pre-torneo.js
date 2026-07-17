import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyCotL1eksVmwdkYql9QTpX3VFN597NgYAA",
  authDomain: "torneo-americano-jdm.firebaseapp.com",
  projectId: "torneo-americano-jdm",
  storageBucket: "torneo-americano-jdm.firebasestorage.app",
  messagingSenderId: "830482002349",
  appId: "1:830482002349:web:26961fdc22e3785300f124"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const COLLECTIONS = ['jugadores', 'partidos_eliminatoria', 'cuartos', 'semifinales', 'final'];

async function backup() {
  const email = process.env.FB_EMAIL;
  const password = process.env.FB_PASS;
  if (!email || !password) {
    console.log('Uso: FB_EMAIL=... FB_PASS=... node backup-pre-torneo.js');
    return;
  }

  console.log('Autenticando...');
  await signInWithEmailAndPassword(auth, email, password);
  console.log('OK.\n');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
  const dirName = `${dateStr}_${timeStr}`;
  const backupDir = join('backups', dirName);
  mkdirSync(backupDir, { recursive: true });

  console.log(`Creando backup en: ${backupDir}\n`);

  const summary = {};

  for (const colName of COLLECTIONS) {
    console.log(`Exportando ${colName}...`);
    const snap = await getDocs(collection(db, colName));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const filePath = join(backupDir, `${colName}.json`);
    writeFileSync(filePath, JSON.stringify(docs, null, 2));
    summary[colName] = docs.length;
    console.log(`  → ${docs.length} documentos guardados en ${colName}.json`);
  }

  const summaryPath = join(backupDir, '_summary.json');
  writeFileSync(summaryPath, JSON.stringify({
    fecha: now.toISOString(),
    colecciones: summary
  }, null, 2));

  console.log('\n=== RESUMEN DEL BACKUP ===');
  for (const [col, count] of Object.entries(summary)) {
    console.log(`  ${col}: ${count} documentos`);
  }
  console.log(`\nBackup completo en: ${backupDir}`);
}

backup().catch(e => { console.error(e.message || e); process.exit(1); });
