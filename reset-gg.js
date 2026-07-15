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

async function resetGG() {
  const snap = await getDocs(collection(db, 'jugadores'));
  console.log(`Reseteando GG en ${snap.size} jugadores...`);
  for (const d of snap.docs) {
    await updateDoc(doc(db, 'jugadores', d.id), { GG: 0 });
  }
  console.log(`GG reseteado a 0 en ${snap.size} jugadores.`);
}

resetGG().catch(e => { console.error(e); process.exit(1); });
