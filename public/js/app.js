import { getDocs, collection, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db } from './firebase.js';

let allJugadores = [];
let allPartidos = [];

function toast(msg, type) {
    const container = document.querySelector('.toast-container') || (() => {
        const el = document.createElement('div');
        el.className = 'toast-container';
        document.body.appendChild(el);
        return el;
    })();
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 2800);
}

function rankBadge(pos) {
    if (pos === 1) return '<span class="rank-badge gold">1</span>';
    if (pos === 2) return '<span class="rank-badge silver">2</span>';
    if (pos === 3) return '<span class="rank-badge bronze">3</span>';
    return '<span class="rank-badge">' + pos + '</span>';
}

function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateLong(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Posiciones ──
function renderPosiciones() {
    const el = document.getElementById('posiciones');
    if (!allJugadores.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127934;</div><p>Aún no hay jugadores inscritos</p></div>';
        return;
    }
    const sorted = [...allJugadores].sort((a, b) => (b.JG || 0) - (a.JG || 0));
    el.innerHTML = '' +
        '<table>' +
        '<thead><tr><th class="col-pos">#</th><th>Jugador</th><th class="col-stat">JJ</th><th class="col-stat">JG</th></tr></thead>' +
        '<tbody>' +
        sorted.map((j, i) => '' +
            '<tr>' +
            '<td class="col-pos">' + rankBadge(i + 1) + '</td>' +
            '<td>' + esc(j.nombre || '') + ' ' + esc(j.apellidos || '') + '</td>' +
            '<td class="col-stat">' + (j.JJ || 0) + '</td>' +
            '<td class="col-stat"><strong>' + (j.JG || 0) + '</strong></td>' +
            '</tr>' +
        '').join('') +
        '</tbody>' +
        '</table>';
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ── Resultados ──
function renderResultados() {
    const el = document.getElementById('resultados');
    if (!allPartidos.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127934;</div><p>Aún no hay partidos registrados</p></div>';
        return;
    }
    el.innerHTML = '' +
        allPartidos.map(p => '' +
            '<div class="resultado-card">' +
            '<div class="r-match">' + esc(p.pareja1_nombre || p.pareja1 || '') + ' vs ' + esc(p.pareja2_nombre || p.pareja2 || '') + '</div>' +
            '<div class="r-meta"><span class="r-score">' + esc(p.score || '—') + '</span><span class="r-fecha">' + formatDate(p.fecha) + '</span></div>' +
            '</div>' +
        '').join('');
}

// ── Cuartos ──
function renderCuartos() {
    const el = document.getElementById('cuartos');
    el.innerHTML = '' +
        '<div class="bracket-round">' +
        '<div class="bracket-round-header">Cuartos de Final</div>' +
        '<div id="cuartos-matches">' +
        '<div class="empty-state"><div class="empty-icon">&#127934;</div><p>Aún no se han generado los cuartos</p></div>' +
        '</div>' +
        '</div>';
    loadCuartos();
}

async function loadCuartos() {
    try {
        const snap = await getDocs(query(collection(db, 'cuartos'), orderBy('grupo')));
        const cuartos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const container = document.getElementById('cuartos-matches');
        if (!container) return;
        if (!cuartos.length) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127934;</div><p>Aún no se han generado los cuartos</p></div>';
            return;
        }
        container.innerHTML = cuartos.map(c => '' +
            '<div class="bracket-match">' +
            '<div class="bracket-match-body">' +
            '<div class="bracket-team' + (c.ganador === 'pareja1' ? ' winner' : '') + '">' + esc(c.pareja1_nombre || '—') + '</div>' +
            '<div class="bracket-vs">vs</div>' +
            '<div class="bracket-team' + (c.ganador === 'pareja2' ? ' winner' : '') + '">' + esc(c.pareja2_nombre || '—') + '</div>' +
            '</div>' +
            '<div class="bracket-score' + (!c.score ? ' tbd' : '') + '">' + esc(c.score || '—') + '</div>' +
            '</div>' +
        '').join('');
        renderSemifinales(cuartos);
    } catch (e) {
        console.error('Error loading cuartos:', e);
    }
}

// ── Semifinales ──
async function renderSemifinales(cuartosOverride) {
    let cuartos = cuartosOverride;
    if (!cuartos) {
        try {
            const snap = await getDocs(query(collection(db, 'cuartos'), orderBy('grupo')));
            cuartos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            return;
        }
    }
    const el = document.getElementById('semifinales');
    const completed = cuartos.filter(c => c.ganador);
    if (completed.length < 4) {
        el.innerHTML = '' +
            '<div class="bracket-round">' +
            '<div class="bracket-round-header">Semifinales</div>' +
            '<div class="empty-state"><div class="empty-icon">&#127934;</div><p>A la espera de resultados de cuartos</p></div>' +
            '</div>';
        renderFinales(null);
        return;
    }
    const g1 = cuartos.find(c => c.grupo === 1);
    const g2 = cuartos.find(c => c.grupo === 2);
    const g3 = cuartos.find(c => c.grupo === 3);
    const g4 = cuartos.find(c => c.grupo === 4);
    const sf1_p1 = g1?.ganador === 'pareja1' ? g1.pareja1_nombre : g1?.pareja2_nombre || '—';
    const sf1_p2 = g2?.ganador === 'pareja1' ? g2.pareja1_nombre : g2?.pareja2_nombre || '—';
    const sf2_p1 = g3?.ganador === 'pareja1' ? g3.pareja1_nombre : g3?.pareja2_nombre || '—';
    const sf2_p2 = g4?.ganador === 'pareja1' ? g4.pareja1_nombre : g4?.pareja2_nombre || '—';
    try {
        const snapSemi = await getDocs(query(collection(db, 'semifinales'), orderBy('cruce')));
        const semis = snapSemi.docs.map(d => ({ id: d.id, ...d.data() }));
        const sf1 = semis.find(s => s.cruce === 1);
        const sf2 = semis.find(s => s.cruce === 2);
        el.innerHTML = '' +
            '<div class="bracket-round">' +
            '<div class="bracket-round-header">Semifinales</div>' +
            '<div class="bracket-match">' +
            '<div class="bracket-match-body">' +
            '<div class="bracket-team' + (sf1?.ganador === 'pareja1' ? ' winner' : '') + '">' + esc(sf1_p1) + '</div>' +
            '<div class="bracket-vs">vs</div>' +
            '<div class="bracket-team' + (sf1?.ganador === 'pareja2' ? ' winner' : '') + '">' + esc(sf1_p2) + '</div>' +
            '</div>' +
            '<div class="bracket-score' + (!sf1?.score ? ' tbd' : '') + '">' + esc(sf1?.score || '—') + '</div>' +
            '</div>' +
            '<div class="bracket-match">' +
            '<div class="bracket-match-body">' +
            '<div class="bracket-team' + (sf2?.ganador === 'pareja1' ? ' winner' : '') + '">' + esc(sf2_p1) + '</div>' +
            '<div class="bracket-vs">vs</div>' +
            '<div class="bracket-team' + (sf2?.ganador === 'pareja2' ? ' winner' : '') + '">' + esc(sf2_p2) + '</div>' +
            '</div>' +
            '<div class="bracket-score' + (!sf2?.score ? ' tbd' : '') + '">' + esc(sf2?.score || '—') + '</div>' +
            '</div>' +
            '</div>';
        renderFinales(semis);
    } catch (e) {
        console.error('Error:', e);
    }
}

// ── Final ──
async function renderFinales(semisOverride) {
    let semis = semisOverride;
    if (!semis) {
        try {
            const snapCuartos = await getDocs(query(collection(db, 'cuartos'), orderBy('grupo')));
            const cuartos = snapCuartos.docs.map(d => ({ id: d.id, ...d.data() }));
            if (cuartos.filter(c => c.ganador).length < 4) {
                document.getElementById('finales').innerHTML = '' +
                    '<div class="bracket-round"><div class="bracket-round-header">Final</div>' +
                    '<div class="empty-state"><div class="empty-icon">&#127942;</div><p>A la espera de semifinales</p></div></div>';
                return;
            }
            const snapSemis = await getDocs(query(collection(db, 'semifinales'), orderBy('cruce')));
            semis = snapSemis.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            return;
        }
    }
    if (!semis || semis.length < 2) {
        document.getElementById('finales').innerHTML = '' +
            '<div class="bracket-round"><div class="bracket-round-header">Final</div>' +
            '<div class="empty-state"><div class="empty-icon">&#127942;</div><p>A la espera de semifinales</p></div></div>';
        return;
    }
    if (!semis[0].ganador || !semis[1].ganador) {
        document.getElementById('finales').innerHTML = '' +
            '<div class="bracket-round"><div class="bracket-round-header">Final</div>' +
            '<div class="empty-state"><div class="empty-icon">&#127942;</div><p>A la espera de resultados de semifinales</p></div></div>';
        return;
    }
    const sf1p1 = semis[0].pareja1_nombre || '';
    const sf1p2 = semis[0].pareja2_nombre || '';
    const sf2p1 = semis[1].pareja1_nombre || '';
    const sf2p2 = semis[1].pareja2_nombre || '';
    const finalP1 = semis[0].ganador === 'pareja1' ? sf1p1 : sf1p2;
    const finalP2 = semis[1].ganador === 'pareja1' ? sf2p1 : sf2p2;
    try {
        const snapFinal = await getDocs(collection(db, 'final'));
        const finales = snapFinal.docs.map(d => ({ id: d.id, ...d.data() }));
        const fin = finales[0] || {};
        document.getElementById('finales').innerHTML = '' +
            '<div class="bracket-round">' +
            '<div class="bracket-round-header">Gran Final</div>' +
            '<div class="bracket-match">' +
            '<div class="bracket-match-body">' +
            '<div class="bracket-team' + (fin.ganador === 'pareja1' ? ' winner' : '') + '">' + esc(finalP1) + '</div>' +
            '<div class="bracket-vs">vs</div>' +
            '<div class="bracket-team' + (fin.ganador === 'pareja2' ? ' winner' : '') + '">' + esc(finalP2) + '</div>' +
            '</div>' +
            '<div class="bracket-score' + (!fin.score ? ' tbd' : '') + '">' + esc(fin.score || '—') + '</div>' +
            '</div>' +
            '</div>';
    } catch (e) {
        console.error('Error:', e);
    }
}

// ── Tab Switching ──
window.showTab = function(tabId) {
    document.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const tabBtn = document.querySelector('[data-tab="' + tabId + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    const content = document.getElementById(tabId);
    if (content) content.classList.add('active');
    if (tabId === 'cuartos') loadCuartos();
};

// ── Initial Load ──
async function init() {
    try {
        const [jugSnap, partSnap] = await Promise.all([
            getDocs(query(collection(db, 'jugadores'), orderBy('JG', 'desc'))),
            getDocs(query(collection(db, 'partidos_eliminatoria'), orderBy('fecha', 'desc')))
        ]);
        allJugadores = jugSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allPartidos = partSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPosiciones();
        renderResultados();
        showTab('posiciones');
    } catch (e) {
        console.error('Error loading initial data:', e);
        document.getElementById('posiciones').innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;</div><p>Error al cargar datos. Verifica la conexión.</p></div>';
    }
}

init();
