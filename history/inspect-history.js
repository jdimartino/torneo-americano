import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

function shortName(j) {
  if (!j) return '';
  const firstName = (j.nombre || '').split(' ')[0];
  const firstLast = (j.apellidos || '').split(' ')[0];
  return (firstName + ' ' + firstLast).trim();
}

async function inspect() {
  const email = process.env.FB_EMAIL;
  const password = process.env.FB_PASS;
  if (!email || !password) {
    console.log('Uso: FB_EMAIL=... FB_PASS=... node history/inspect-history.js');
    return;
  }

  console.log('Autenticando...');
  await signInWithEmailAndPassword(auth, email, password);
  console.log('OK auth.\n');

  console.log('Leyendo colecciones...');
  const [jugSnap, partSnap, cuarSnap, semiSnap, finalSnap] = await Promise.all([
    getDocs(collection(db, 'jugadores')),
    getDocs(collection(db, 'partidos_eliminatoria')),
    getDocs(collection(db, 'cuartos')),
    getDocs(collection(db, 'semifinales')),
    getDocs(collection(db, 'final'))
  ]);

  const jugadores = jugSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allPartidos = partSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allCuartos = cuarSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allSemis = semiSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allFinales = finalSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log('=== RESUMEN DE COLECCIONES ===');
  console.log('Jugadores:           ', jugadores.length);
  console.log('Partidos DRAW:       ', allPartidos.length);
  console.log('Cuartos:             ', allCuartos.length);
  console.log('Semifinales:         ', allSemis.length);
  console.log('Final:               ', allFinales.length);
  console.log('');

  console.log('=== JUGADORES CON HISTORIAL RESIDUAL ===\n');
  let conHistorial = 0;

  for (const j of jugadores) {
    const pid = j.id;
    const pname = shortName(j);
    const found = [];

    // DRAW (por ID)
    for (const p of allPartidos) {
      const inP1 = p.p1a_id === pid || p.p1b_id === pid;
      const inP2 = p.p2c_id === pid || p.p2d_id === pid;
      if (inP1 || inP2) found.push('DRAW(' + (inP1 ? 'P1' : 'P2') + ',score=' + (p.games1 !== null && p.games1 !== undefined ? p.games1 + '-' + p.games2 : 'nulo') + ')');
    }
    // Cuartos (por ID)
    for (const c of allCuartos) {
      const inP1 = c.pareja1_id_a === pid || c.pareja1_id_b === pid;
      const inP2 = c.pareja2_id_a === pid || c.pareja2_id_b === pid;
      if (inP1 || inP2) found.push('CUARTOS(P' + (inP1 ? '1' : '2') + ')');
    }
    // Semis (por nombre)
    for (const s of allSemis) {
      const inP1 = s.pareja1_nombre && s.pareja1_nombre.includes(pname);
      const inP2 = s.pareja2_nombre && s.pareja2_nombre.includes(pname);
      if (inP1 || inP2) found.push('SEMIS(P' + (inP1 ? '1' : '2') + ')');
    }
    // Final (por nombre)
    for (const f of allFinales) {
      const inP1 = f.pareja1_nombre && f.pareja1_nombre.includes(pname);
      const inP2 = f.pareja2_nombre && f.pareja2_nombre.includes(pname);
      if (inP1 || inP2) found.push('FINAL(P' + (inP1 ? '1' : '2') + ')');
    }

    if (found.length) {
      conHistorial++;
      console.log('• ' + shortName(j) + '  [JJ=' + (j.JJ||0) + ' GG=' + (j.GG||0) + ']');
      found.forEach(f => console.log('    - ' + f));
    }
  }

  console.log('');
  console.log('=== TOTAL: ' + conHistorial + ' jugador(es) con historial residual de ' + jugadores.length + ' ===');
  if (conHistorial === 0) console.log('✅ Ningún jugador tiene historial residual.');
}

inspect().catch(e => { console.error(e.message || e); process.exit(1); });
