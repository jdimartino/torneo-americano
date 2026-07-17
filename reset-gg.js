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
  const email = process.env.FB_EMAIL;
  const password = process.env.FB_PASS;
  if (!email || !password) {
    console.log('Uso: FB_EMAIL=... FB_PASS=... node reset-gg.js [--confirm]');
    console.log('Sin --confirm solo muestra qué se haría.');
    return;
  }

  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);

  const snap = await getDocs(collection(db, 'jugadores'));
  console.log(`Se resetearía GG a 0 en ${snap.size} jugadores.`);

  const confirm = process.argv.includes('--confirm');
  if (!confirm) {
    console.log('\nPara ejecutar: FB_EMAIL=... FB_PASS=... node reset-gg.js --confirm');
    return;
  }

  console.log('Aplicando...');
  for (const d of snap.docs) {
    await updateDoc(doc(db, 'jugadores', d.id), { GG: 0 });
  }
  console.log(`GG reseteado a 0 en ${snap.size} jugadores.`);
}

resetGG().catch(e => { console.error(e); process.exit(1); });
