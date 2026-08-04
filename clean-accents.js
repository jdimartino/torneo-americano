import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

function stripAccents(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function cleanAccents() {
  const email = process.env.FB_EMAIL;
  const password = process.env.FB_PASS;
  if (!email || !password) {
    console.log('Uso: FB_EMAIL=... FB_PASS=... node clean-accents.js');
    return;
  }

  console.log('Autenticando...');
  await signInWithEmailAndPassword(auth, email, password);
  console.log('OK.\n');

  const configSnap = await getDoc(doc(db, 'config', 'activeTournament'));
  let tournamentIds = [];
  if (configSnap.exists()) {
    const cfg = configSnap.data();
    if (cfg.activeTournamentIds) tournamentIds = cfg.activeTournamentIds;
    else if (cfg.tournamentId) tournamentIds = [cfg.tournamentId];
  }

  if (!tournamentIds.length) {
    console.log('No se encontraron torneos activos');
    return;
  }

  let totalUpdated = 0;

  for (const torneoId of tournamentIds) {
    console.log(`\n--- Torneo: ${torneoId} ---`);
    const snap = await getDocs(collection(db, 'torneos', torneoId, 'jugadores'));
    let updated = 0;

    for (const d of snap.docs) {
      const data = d.data();
      const newNombre = stripAccents(data.nombre);
      const newApellidos = stripAccents(data.apellidos);

      if (newNombre !== data.nombre || newApellidos !== data.apellidos) {
        console.log(`  ${data.nombre || ''} ${data.apellidos || ''} → ${newNombre} ${newApellidos}`);
        await updateDoc(doc(db, 'torneos', torneoId, 'jugadores', d.id), {
          nombre: newNombre,
          apellidos: newApellidos
        });
        updated++;
      }
    }

    console.log(`  ${updated} jugadores actualizados de ${snap.docs.length} totales`);
    totalUpdated += updated;
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`Total jugadores actualizados: ${totalUpdated}`);
}

cleanAccents().catch(e => { console.error(e.message || e); process.exit(1); });
