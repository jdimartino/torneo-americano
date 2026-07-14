import { getDocs, collection } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db } from './firebase.js';

let allJugadores = [];
let allPartidos = [];
let allCuartos = [];
let allSemis = [];
let allFinales = [];

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function rankBadge(pos) {
    if (pos === 1) return '<span class="rank-badge gold">1</span>';
    if (pos === 2) return '<span class="rank-badge silver">2</span>';
    if (pos === 3) return '<span class="rank-badge bronze">3</span>';
    return '<span class="rank-badge">' + pos + '</span>';
}

// ── Load All Data ──
async function loadAllData() {
    try {
        const jugSnap = await getDocs(collection(db, 'jugadores'));
        allJugadores = jugSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error('Error loading jugadores:', e); }
    try {
        const partSnap = await getDocs(collection(db, 'partidos_eliminatoria'));
        allPartidos = partSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error('Error loading partidos:', e); }
    try {
        const cuartosSnap = await getDocs(collection(db, 'cuartos'));
        allCuartos = cuartosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error('Error loading cuartos:', e); }
    try {
        const semisSnap = await getDocs(collection(db, 'semifinales'));
        allSemis = semisSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error('Error loading semifinales:', e); }
    try {
        const finalesSnap = await getDocs(collection(db, 'final'));
        allFinales = finalesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error('Error loading final:', e); }
}

// ── Posiciones ──
function renderPosiciones() {
    const el = document.getElementById('posiciones');
    if (!allJugadores.length) {
        el.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">groups</span><p>Aún no hay jugadores inscritos</p></div>';
        return;
    }
    el.innerHTML =
        '<table>' +
        '<thead><tr><th class="col-pos">#</th><th><span class="material-symbols-outlined" style="font-size:0.8rem;">person</span> Jugador</th><th class="col-stat">JJ</th><th class="col-stat">GG</th></tr></thead>' +
        '<tbody>' +
        [...allJugadores].sort((a, b) => {
            const diff = (b.GG || 0) - (a.GG || 0);
            if (diff !== 0) return diff;
            return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
        }).map((j, i) =>
            '<tr>' +
            '<td class="col-pos">' + rankBadge(i + 1) + '</td>' +
            '<td>' + esc(j.nombre || '') + ' ' + esc(j.apellidos || '') + '</td>' +
            '<td class="col-stat">' + (j.JJ || 0) + '</td>' +
            '<td class="col-stat"><strong style="color:var(--primary)">' + (j.GG || 0) + '</strong></td>' +
            '</tr>'
        ).join('') +
        '</tbody>' +
        '</table>';
}

// ── Resultados ──
function renderResultados() {
    const el = document.getElementById('resultados');
    if (!allPartidos.length) {
        el.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">sports_tennis</span><p>Aún no hay partidos registrados</p></div>';
        return;
    }
    el.innerHTML =
        allPartidos.map(p =>
            '<div class="resultado-card">' +
            '<div class="r-match"><span class="material-symbols-outlined" style="font-size:1rem;color:var(--primary);">sports_tennis</span> ' + esc(p.pareja1_nombre || p.pareja1 || '') + ' <span style="color:var(--on-surface-variant-30)">vs</span> ' + esc(p.pareja2_nombre || p.pareja2 || '') + '</div>' +
            '<div class="r-meta"><span class="r-score">' + esc(p.score || '—') + '</span><span class="r-fecha">' + formatDate(p.fecha) + '</span></div>' +
            '</div>'
        ).join('');
}

// ── Cuartos ──
function renderCuartos() {
    const el = document.getElementById('cuartos');
    el.innerHTML =
        '<div class="bracket-round">' +
        '<div class="bracket-round-header"><span class="material-symbols-outlined" style="font-size:0.9rem;">emoji_events</span> Cuartos de Final</div>' +
        '<div id="cuartos-matches">' +
        (!allCuartos.length
            ? '<div class="empty-state" style="padding:1.5rem;"><span class="material-symbols-outlined">hourglass_empty</span><p>Aún no se han generado los cuartos</p></div>'
            : allCuartos.map(c =>
                '<div class="bracket-match">' +
                '<div class="bracket-match-body">' +
                '<div class="bracket-team' + (c.ganador === 'pareja1' ? ' winner' : '') + '">' +
                (c.ganador === 'pareja1' ? '<span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span> ' : '') +
                esc(c.pareja1_nombre || '—') + '</div>' +
                '<div class="bracket-vs">vs</div>' +
                '<div class="bracket-team' + (c.ganador === 'pareja2' ? ' winner' : '') + '">' +
                (c.ganador === 'pareja2' ? '<span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span> ' : '') +
                esc(c.pareja2_nombre || '—') + '</div>' +
                '</div>' +
                '<div class="bracket-score' + (!c.score ? ' tbd' : '') + '">' + esc(c.score || '—') + '</div>' +
                '</div>'
            ).join('')
        ) +
        '</div>' +
        '</div>';
}

// ── Semifinales ──
function renderSemifinales() {
    const el = document.getElementById('semifinales');
    const completed = allCuartos.filter(c => c.ganador);
    if (completed.length < 4) {
        el.innerHTML =
            '<div class="bracket-round">' +
            '<div class="bracket-round-header"><span class="material-symbols-outlined" style="font-size:0.9rem;">military_tech</span> Semifinales</div>' +
            '<div class="empty-state" style="padding:1.5rem;"><span class="material-symbols-outlined">hourglass_empty</span><p>A la espera de resultados de cuartos</p></div>' +
            '</div>';
        return;
    }
    const g1 = allCuartos.find(c => c.grupo === 1);
    const g2 = allCuartos.find(c => c.grupo === 2);
    const g3 = allCuartos.find(c => c.grupo === 3);
    const g4 = allCuartos.find(c => c.grupo === 4);
    const sf1_p1 = g1?.ganador === 'pareja1' ? g1.pareja1_nombre : g1?.pareja2_nombre || '—';
    const sf1_p2 = g2?.ganador === 'pareja1' ? g2.pareja1_nombre : g2?.pareja2_nombre || '—';
    const sf2_p1 = g3?.ganador === 'pareja1' ? g3.pareja1_nombre : g3?.pareja2_nombre || '—';
    const sf2_p2 = g4?.ganador === 'pareja1' ? g4.pareja1_nombre : g4?.pareja2_nombre || '—';
    const sf1 = allSemis.find(s => s.cruce === 1);
    const sf2 = allSemis.find(s => s.cruce === 2);
    el.innerHTML =
        '<div class="bracket-round">' +
        '<div class="bracket-round-header"><span class="material-symbols-outlined" style="font-size:0.9rem;">military_tech</span> Semifinales</div>' +
        '<div class="bracket-match">' +
        '<div class="bracket-match-body">' +
        '<div class="bracket-team' + (sf1?.ganador === 'pareja1' ? ' winner' : '') + '">' +
        (sf1?.ganador === 'pareja1' ? '<span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span> ' : '') +
        esc(sf1_p1) + '</div>' +
        '<div class="bracket-vs">vs</div>' +
        '<div class="bracket-team' + (sf1?.ganador === 'pareja2' ? ' winner' : '') + '">' +
        (sf1?.ganador === 'pareja2' ? '<span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span> ' : '') +
        esc(sf1_p2) + '</div>' +
        '</div>' +
        '<div class="bracket-score' + (!sf1?.score ? ' tbd' : '') + '">' + esc(sf1?.score || '—') + '</div>' +
        '</div>' +
        '<div class="bracket-match">' +
        '<div class="bracket-match-body">' +
        '<div class="bracket-team' + (sf2?.ganador === 'pareja1' ? ' winner' : '') + '">' +
        (sf2?.ganador === 'pareja1' ? '<span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span> ' : '') +
        esc(sf2_p1) + '</div>' +
        '<div class="bracket-vs">vs</div>' +
        '<div class="bracket-team' + (sf2?.ganador === 'pareja2' ? ' winner' : '') + '">' +
        (sf2?.ganador === 'pareja2' ? '<span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span> ' : '') +
        esc(sf2_p2) + '</div>' +
        '</div>' +
        '<div class="bracket-score' + (!sf2?.score ? ' tbd' : '') + '">' + esc(sf2?.score || '—') + '</div>' +
        '</div>' +
        '</div>';
}

// ── Final ──
function renderFinales() {
    const el = document.getElementById('finales');
    if (allCuartos.filter(c => c.ganador).length < 4 || allSemis.length < 2) {
        el.innerHTML =
            '<div class="bracket-round"><div class="bracket-round-header"><span class="material-symbols-outlined" style="font-size:0.9rem;">workspace_premium</span> Final</div>' +
            '<div class="empty-state" style="padding:1.5rem;"><span class="material-symbols-outlined">hourglass_empty</span><p>A la espera de semifinales</p></div></div>';
        return;
    }
    if (!allSemis[0].ganador || !allSemis[1].ganador) {
        el.innerHTML =
            '<div class="bracket-round"><div class="bracket-round-header"><span class="material-symbols-outlined" style="font-size:0.9rem;">workspace_premium</span> Final</div>' +
            '<div class="empty-state" style="padding:1.5rem;"><span class="material-symbols-outlined">hourglass_empty</span><p>A la espera de resultados de semifinales</p></div></div>';
        return;
    }
    const sf1p1 = allSemis[0].pareja1_nombre || '';
    const sf1p2 = allSemis[0].pareja2_nombre || '';
    const sf2p1 = allSemis[1].pareja1_nombre || '';
    const sf2p2 = allSemis[1].pareja2_nombre || '';
    const finalP1 = allSemis[0].ganador === 'pareja1' ? sf1p1 : sf1p2;
    const finalP2 = allSemis[1].ganador === 'pareja1' ? sf2p1 : sf2p2;
    const fin = allFinales[0] || {};
    el.innerHTML =
        '<div class="bracket-round">' +
        '<div class="bracket-round-header"><span class="material-symbols-outlined" style="font-size:0.9rem;">workspace_premium</span> Gran Final</div>' +
        '<div class="bracket-match">' +
        '<div class="bracket-match-body">' +
        '<div class="bracket-team' + (fin.ganador === 'pareja1' ? ' winner' : '') + '">' +
        (fin.ganador === 'pareja1' ? '<span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span> ' : '') +
        esc(finalP1 || '—') + '</div>' +
        '<div class="bracket-vs">vs</div>' +
        '<div class="bracket-team' + (fin.ganador === 'pareja2' ? ' winner' : '') + '">' +
        (fin.ganador === 'pareja2' ? '<span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span> ' : '') +
        esc(finalP2 || '—') + '</div>' +
        '</div>' +
        '<div class="bracket-score' + (!fin.score ? ' tbd' : '') + '">' + esc(fin.score || '—') + '</div>' +
        '</div>' +
        '</div>';
}

// ── Tab Switching ──
window.showTab = async function(tabId) {
    document.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const tabBtn = document.querySelector('[data-tab="' + tabId + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    const content = document.getElementById(tabId);
    if (content) content.classList.add('active');
    await loadAllData();
    switch (tabId) {
        case 'posiciones': renderPosiciones(); break;
        case 'resultados': renderResultados(); break;
        case 'cuartos': renderCuartos(); break;
        case 'semifinales': renderSemifinales(); break;
        case 'finales': renderFinales(); break;
    }
};

// ── Initial Load ──
async function init() {
    try {
        await loadAllData();
        renderPosiciones();
        renderResultados();
        renderCuartos();
        renderSemifinales();
        renderFinales();
        document.querySelector('[data-tab="posiciones"]').click();
    } catch (e) {
        console.error('Error loading initial data:', e);
        document.getElementById('posiciones').innerHTML = '<div class="empty-state"><span class="material-symbols-outlined" style="color:var(--error);">error</span><p>Error al cargar datos. Verifica la conexión.</p></div>';
    }
}

init();
