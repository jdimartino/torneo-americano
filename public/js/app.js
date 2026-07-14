import { db } from './firebase.js';
import { collection, onSnapshot, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
};

// Ejemplo: Escuchar posiciones
const q = query(collection(db, "jugadores"), orderBy("JG", "desc"));
onSnapshot(q, (snapshot) => {
    // Renderizar tabla de posiciones
    console.log("Datos de jugadores actualizados");
});
