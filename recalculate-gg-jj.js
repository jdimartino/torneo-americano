import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, FieldValue, increment } from 'firebase/firestore';

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

async function recalculateGGJJ() {
  console.log('Iniciando recálculo de GG y JJ...');

  // 1. Resetear todos los GG y JJ de los jugadores a 0
  const jugadoresSnap = await getDocs(collection(db, 'jugadores'));
  console.log(`Reseteando GG y JJ en ${jugadoresSnap.size} jugadores...`);
  for (const jugadorDoc of jugadoresSnap.docs) {
    await updateDoc(doc(db, 'jugadores', jugadorDoc.id), { GG: 0, JJ: 0 });
  }
  console.log('GG y JJ de todos los jugadores reseteado a 0.');

  // 2. Recorrer todos los partidos y recalcular GG y JJ
  const partidosSnap = await getDocs(collection(db, 'partidos_eliminatoria'));
  console.log(`Procesando ${partidosSnap.size} partidos para recalcular GG y JJ...`);

  for (const partidoDoc of partidosSnap.docs) {
    const partidoData = partidoDoc.data();
    const { p1a_id, p1b_id, p2c_id, p2d_id, games1, games2 } = partidoData;

    if (games1 !== undefined && games2 !== undefined && games1 !== null && games2 !== null) {
      // Incrementar GG y JJ para los jugadores de pareja1
      if (p1a_id) {
        await updateDoc(doc(db, 'jugadores', p1a_id), { GG: increment(games1), JJ: increment(1) });
      }
      if (p1b_id) {
        await updateDoc(doc(db, 'jugadores', p1b_id), { GG: increment(games1), JJ: increment(1) });
      }

      // Incrementar GG y JJ para los jugadores de pareja2
      if (p2c_id) {
        await updateDoc(doc(db, 'jugadores', p2c_id), { GG: increment(games2), JJ: increment(1) });
      }
      if (p2d_id) {
        await updateDoc(doc(db, 'jugadores', p2d_id), { GG: increment(games2), JJ: increment(1) });
      }
    }
  }
  console.log('Recálculo de GG y JJ completado.');
}

recalculateGGJJ().catch(e => { console.error(e); process.exit(1); });
