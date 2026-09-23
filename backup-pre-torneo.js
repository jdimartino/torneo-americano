import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyAvU8uKaivoZH_401zpXyM5-OOGgi5OGcw",
  authDomain: "torneos-tenis-jdm.firebaseapp.com",
  projectId: "torneos-tenis-jdm",
  storageBucket: "torneos-tenis-jdm.firebasestorage.app",
  messagingSenderId: "951550758841",
  appId: "1:951550758841:web:b4baab45dde503d0717068"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const COLLECTIONS = ['jugadores', 'partidos_eliminatoria', 'cuartos', 'semifinales', 'final'];

async function backupCollection(db, ref, colName) {
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

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

  // 1. Leer config de torneos activos
  let tournamentIds = [];
  try {
    const configSnap = await getDoc(doc(db, 'config', 'torneosAmericano_activeTournament'));
    if (configSnap.exists()) {
      const cfg = configSnap.data();
      if (cfg.activeTournamentIds) tournamentIds = cfg.activeTournamentIds;
      else if (cfg.tournamentId) tournamentIds = [cfg.tournamentId];
    }
    writeFileSync(join(backupDir, '_config.json'), JSON.stringify(configSnap.exists() ? configSnap.data() : {}, null, 2));
    console.log(`Config leída: ${tournamentIds.length} torneo(s) activo(s)`);
  } catch (e) {
    console.log('No se pudo leer config/torneosAmericano_activeTournament:', e.message);
  }

  // 2. Backup de documentos de torneos
  try {
    const torneosSnap = await getDocs(collection(db, 'torneosAmericano'));
    const torneosDocs = torneosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    writeFileSync(join(backupDir, '_torneos.json'), JSON.stringify(torneosDocs, null, 2));
    summary['_torneos'] = torneosDocs.length;
    console.log(`\nTorneos encontrados: ${torneosDocs.length}`);
    for (const t of torneosDocs) {
      console.log(`  - ${t.id}: ${t.nombre || '(sin nombre)'}`);
    }
  } catch (e) {
    console.log('Error leyendo torneos:', e.message);
  }

  // 3. Backup de cada torneo (subcolecciones)
  for (const torneoId of tournamentIds) {
    console.log(`\n--- Torneo: ${torneoId} ---`);
    const torneoDir = join(backupDir, torneoId);
    mkdirSync(torneoDir, { recursive: true });

    for (const colName of COLLECTIONS) {
      console.log(`Exportando ${colName}...`);
      const ref = collection(db, 'torneosAmericano', torneoId, colName);
      const docs = await backupCollection(db, ref, colName);
      const filePath = join(torneoDir, `${colName}.json`);
      writeFileSync(filePath, JSON.stringify(docs, null, 2));
      summary[`${torneoId}/${colName}`] = docs.length;
      console.log(`  → ${docs.length} documentos guardados en ${colName}.json`);
    }
  }

  // 4. Backup de colecciones raíz (legacy)
  console.log('\n--- Colecciones raíz (legacy) ---');
  const rootDir = join(backupDir, '_root');
  mkdirSync(rootDir, { recursive: true });
  for (const colName of COLLECTIONS) {
    console.log(`Exportando ${colName}...`);
    const ref = collection(db, colName);
    const docs = await backupCollection(db, ref, colName);
    if (docs.length > 0) {
      const filePath = join(rootDir, `${colName}.json`);
      writeFileSync(filePath, JSON.stringify(docs, null, 2));
      summary[`_root/${colName}`] = docs.length;
      console.log(`  → ${docs.length} documentos guardados en ${colName}.json`);
    } else {
      console.log(`  → 0 documentos (vacío)`);
    }
  }

  // 5. Summary
  const summaryPath = join(backupDir, '_summary.json');
  writeFileSync(summaryPath, JSON.stringify({
    fecha: now.toISOString(),
    torneos: tournamentIds,
    colecciones: summary
  }, null, 2));

  console.log('\n=== RESUMEN DEL BACKUP ===');
  for (const [col, count] of Object.entries(summary)) {
    console.log(`  ${col}: ${count} documentos`);
  }
  console.log(`\nBackup completo en: ${backupDir}`);
}

backup().catch(e => { console.error(e.message || e); process.exit(1); });
