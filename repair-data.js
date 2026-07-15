import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

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

async function repairData() {
  const partidosSnap = await getDocs(collection(db, 'partidos_eliminatoria'));
  const jugadoresSnap = await getDocs(collection(db, 'jugadores'));

  const jjMap = {};
  const ggMap = {};

  for (const d of jugadoresSnap.docs) {
    jjMap[d.id] = 0;
    ggMap[d.id] = 0;
  }

  let partidosConScore = 0;
  for (const p of partidosSnap.docs) {
    const data = p.data();
    if (data.games1 === null || data.games1 === undefined) continue;
    partidosConScore++;

    jjMap[data.p1a_id] = (jjMap[data.p1a_id] || 0) + 1;
    jjMap[data.p1b_id] = (jjMap[data.p1b_id] || 0) + 1;
    jjMap[data.p2c_id] = (jjMap[data.p2c_id] || 0) + 1;
    jjMap[data.p2d_id] = (jjMap[data.p2d_id] || 0) + 1;

    ggMap[data.p1a_id] = (ggMap[data.p1a_id] || 0) + data.games1;
    ggMap[data.p1b_id] = (ggMap[data.p1b_id] || 0) + data.games1;
    ggMap[data.p2c_id] = (ggMap[data.p2c_id] || 0) + data.games2;
    ggMap[data.p2d_id] = (ggMap[data.p2d_id] || 0) + data.games2;
  }

  console.log(`Partidos con score: ${partidosConScore}`);
  console.log('Valores calculados desde partidos_eliminatoria:');
  for (const [id, jj] of Object.entries(jjMap)) {
    console.log(`  ${id}: JJ=${jj}, GG=${ggMap[id]}`);
  }

  const confirm = process.argv.includes('--confirm');
  if (!confirm) {
    console.log('\nPara aplicar los cambios, ejecutá: node repair-data.js --confirm');
    return;
  }

  console.log('\nAplicando correcciones...');
  for (const [id, jj] of Object.entries(jjMap)) {
    await updateDoc(doc(db, 'jugadores', id), {
      JJ: jj,
      GG: ggMap[id] || 0
    });
    console.log(`  ${id}: JJ=${jj}, GG=${ggMap[id] || 0}`);
  }
  console.log('Listo. JJ y GG recalculados desde partidos_eliminatoria.');
}

repairData().catch(e => { console.error(e); process.exit(1); });
