import { getDocs, collection } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db } from './firebase.js';

let allJugadores = [];
let allPartidos = [];
let allCuartos = [];
let allSemis = [];
let allFinales = [];

const loadingHTML = '<div class="panel-loading"><div class="tennis-ball-spinner"></div><div class="loading-text">Cargando datos del torneo...</div></div>';

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function fixNames(s) {
    return (s || '').replace(/ \+ /g, ' / ');
}

function shortName(j) {
    if (!j) return '';
    const firstName = (j.nombre || '').split(' ')[0];
    const firstLast = (j.apellidos || '').split(' ')[0];
    const cat = j.categoria ? ' (' + j.categoria + ')' : '';
    return firstName + ' ' + firstLast + cat;
}

function compareRanking(a, b) {
    const diff = (b.GG || 0) - (a.GG || 0);
    if (diff !== 0) return diff;
    const jj = (b.JJ || 0) - (a.JJ || 0);
    if (jj !== 0) return jj;
    return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
}

function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function rankBadge(pos) {
    if (pos <= 16) return '<span class="rank-badge qualify">' + pos + '</span>';
    return '<span class="rank-badge">' + pos + '</span>';
}

function parseScore(scoreStr) {
    const parts = (scoreStr || '').split('-').map(s => parseInt(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { games1: parts[0], games2: parts[1] };
    return null;
}

// ── Load All Data ──
// Carga en paralelo (Promise.all) y una sola vez por sesión.
let _dataLoaded = false;
async function loadAllData() {
    if (_dataLoaded) return;
    const [jugSnap, partSnap, cuartosSnap, semisSnap, finalesSnap] = await Promise.all([
        getDocs(collection(db, 'jugadores')),
        getDocs(collection(db, 'partidos_eliminatoria')),
        getDocs(collection(db, 'cuartos')),
        getDocs(collection(db, 'semifinales')),
        getDocs(collection(db, 'final'))
    ]);
    allJugadores = jugSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allPartidos  = partSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allCuartos   = cuartosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allSemis     = semisSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allFinales   = finalesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    _dataLoaded = true;
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
        '<thead><tr><th class="col-pos">#</th><th class="col-player"><span class="material-symbols-outlined" style="font-size:0.8rem;">person</span> Jugador</th><th class="col-stat">JJ</th><th class="col-stat">GG</th></tr></thead>' +
        '<tbody>' +
        [...allJugadores].sort(compareRanking).map((j, i) =>
            '<tr>' +
            '<td class="col-pos">' + rankBadge(i + 1) + '</td>' +
            '<td class="col-player">' +
                '<button class="player-link" onclick="showPlayerMatches(\'' + j.id + '\')"><span class="pl-name">' + esc(shortName(j)) + '</span><span class="pl-icon material-symbols-outlined">chevron_right</span></button>' +
                (j.cancha ? '<div style="font-size:0.6rem;color:var(--on-surface-variant-50);">Cancha ' + j.cancha + (j.lote ? ' · Lote ' + j.lote : '') + '</div>' : '') +
                '</td>' +
            '<td class="col-stat">' + (j.JJ || 0) + '</td>' +
            '<td class="col-stat"><strong style="color:var(--primary)">' + (j.GG || 0) + '</strong></td>' +
            '</tr>'
        ).join('') +
        '</tbody>' +
        '</table>' +
        '<div style="font-size:0.65rem;color:var(--on-surface-variant-40);text-align:center;margin-top:0.5rem;">JJ = Juegos Jugados &middot; GG = Juegos Ganados</div>';
}

// ── Player Match History ──
function getPlayerMatches(playerId) {
    const player = allJugadores.find(j => j.id === playerId);
    if (!player) return [];
    const playerName = shortName(player);
    const matches = [];

    allPartidos.forEach(p => {
        const inPair1 = p.p1a_id === playerId || p.p1b_id === playerId;
        const inPair2 = p.p2c_id === playerId || p.p2d_id === playerId;
        if (inPair1 || inPair2) matches.push({ ...p, matchType: 'eliminatoria', playerInPair1: inPair1 });
    });

    allCuartos.forEach(c => {
        const inPair1 = c.pareja1_id_a === playerId || c.pareja1_id_b === playerId;
        const inPair2 = c.pareja2_id_a === playerId || c.pareja2_id_b === playerId;
        if (inPair1 || inPair2) matches.push({ ...c, matchType: 'cuartos', playerInPair1: inPair1 });
    });

    allSemis.forEach(s => {
        const inPair1 = s.pareja1_nombre && s.pareja1_nombre.includes(playerName);
        const inPair2 = s.pareja2_nombre && s.pareja2_nombre.includes(playerName);
        if (inPair1 || inPair2) matches.push({ ...s, matchType: 'semifinal', playerInPair1: inPair1 });
    });

    allFinales.forEach(f => {
        const inPair1 = f.pareja1_nombre && f.pareja1_nombre.includes(playerName);
        const inPair2 = f.pareja2_nombre && f.pareja2_nombre.includes(playerName);
        if (inPair1 || inPair2) matches.push({ ...f, matchType: 'final', playerInPair1: inPair1 });
    });

    matches.sort((a, b) => {
        const da = a.fecha ? (a.fecha.toDate ? a.fecha.toDate() : new Date(a.fecha)) : new Date(0);
        const db = b.fecha ? (b.fecha.toDate ? b.fecha.toDate() : new Date(b.fecha)) : new Date(0);
        return db - da;
    });

    return matches;
}

function renderPlayerMatchItem(m) {
    const myPair = m.playerInPair1 ? 1 : 2;
    const myTeamClass = myPair === 1 ? 'team-blue' : 'team-gold';
    const oppTeamClass = myPair === 1 ? 'team-gold' : 'team-blue';
    const myName = myPair === 1 ? m.pareja1_nombre : m.pareja2_nombre;
    const oppName = myPair === 1 ? m.pareja2_nombre : m.pareja1_nombre;

    const roundLabel = m.matchType === 'eliminatoria' ? 'Eliminatoria'
        : m.matchType === 'cuartos' ? 'Cuartos de Final'
        : m.matchType === 'semifinal' ? 'Semifinal'
        : 'Gran Final';

    let s1, s2, state1, state2;
    if (m.matchType === 'eliminatoria') {
        s1 = m.games1 != null ? m.games1 : 0;
        s2 = m.games2 != null ? m.games2 : 0;
    } else {
        const parsed = parseScore(m.score);
        if (parsed) { s1 = parsed.games1; s2 = parsed.games2; }
        else { s1 = 0; s2 = 0; }
    }

    if (m.matchType === 'eliminatoria') {
        if (s1 > s2) { state1 = 'state-win'; state2 = 'state-lose'; }
        else if (s2 > s1) { state1 = 'state-lose'; state2 = 'state-win'; }
        else { state1 = 'state-tie'; state2 = 'state-tie'; }
    } else {
        if (m.ganador === 'pareja1') { state1 = 'state-win'; state2 = 'state-lose'; }
        else if (m.ganador === 'pareja2') { state1 = 'state-lose'; state2 = 'state-win'; }
        else { state1 = 'state-tie'; state2 = 'state-tie'; }
    }

    const myState = myPair === 1 ? state1 : state2;
    const oppState = myPair === 1 ? state2 : state1;
    const myScore = myPair === 1 ? s1 : s2;
    const oppScore = myPair === 1 ? s2 : s1;

    return '<div class="player-match-item resultado-card">' +
        '<div class="match-round">' + roundLabel + '</div>' +
        '<div class="match-pair-row">' +
        '<div class="match-pair-name ' + myTeamClass + ' ' + myState + '">' + esc(fixNames(myName || '')) + '</div>' +
        '<div class="match-pair-score ' + myTeamClass + ' ' + myState + '">' + myScore + '</div>' +
        '</div>' +
        '<div class="match-pair-divider"></div>' +
        '<div class="match-pair-row">' +
        '<div class="match-pair-name ' + oppTeamClass + ' ' + oppState + '">' + esc(fixNames(oppName || '')) + '</div>' +
        '<div class="match-pair-score ' + oppTeamClass + ' ' + oppState + '">' + oppScore + '</div>' +
        '</div>' +
        (m.fecha ? '<div class="r-meta"><span class="r-fecha">' + formatDate(m.fecha) + '</span></div>' : '') +
        '</div>';
}

window.showPlayerMatches = function(playerId) {
    const player = allJugadores.find(j => j.id === playerId);
    if (!player) return;
    const matches = getPlayerMatches(playerId);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal modal-wide">' +
        '<div class="player-match-header">' +
        '<span class="modal-title">Partidos de ' + esc(shortName(player)) + '</span>' +
        '<button class="modal-close-btn" id="pm-close">&times;</button>' +
        '</div>' +
        (matches.length
            ? '<div class="player-match-list">' + matches.map(renderPlayerMatchItem).join('') + '</div>'
            : '<div class="player-match-empty">Aún no tiene partidos registrados</div>'
        ) +
        '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('#pm-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
};

// ── Resultados ──
function renderResultados() {
    const el = document.getElementById('resultados');
    if (!allPartidos.length) {
        el.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">sports_tennis</span><p>Aún no hay partidos registrados</p></div>';
        return;
    }
    el.innerHTML =
        '<input type="text" id="result-search-public" class="search-input" placeholder="🔍 Buscar por nombre de jugador...">' +
        allPartidos.map(p => {
            const s1 = p.games1 != null ? p.games1 : 0;
            const s2 = p.games2 != null ? p.games2 : 0;
            let c1 = '', c2 = '';
            if (s1 > s2) { c1 = 'state-win'; c2 = 'state-lose'; }
            else if (s2 > s1) { c1 = 'state-lose'; c2 = 'state-win'; }
            else { c1 = 'state-tie'; c2 = 'state-tie'; }
            return '<div class="resultado-card">' +
                '<div class="match-pair-row">' +
                '<div class="match-pair-name team-blue ' + c1 + '">' + esc(fixNames(p.pareja1_nombre || p.pareja1 || '')) + '</div>' +
                '<div class="match-pair-score team-blue ' + c1 + '">' + s1 + '</div>' +
                '</div>' +
                '<div class="match-pair-divider"></div>' +
                '<div class="match-pair-row">' +
                '<div class="match-pair-name team-gold ' + c2 + '">' + esc(fixNames(p.pareja2_nombre || p.pareja2 || '')) + '</div>' +
                '<div class="match-pair-score team-gold ' + c2 + '">' + s2 + '</div>' +
                '</div>' +
                '<div class="r-meta"><span class="r-fecha">' + formatDate(p.fecha) + '</span></div>' +
                '</div>';
        }).join('');

    const resultSearch = document.getElementById('result-search-public');
    if (resultSearch) {
        resultSearch.addEventListener('input', () => {
            const term = resultSearch.value.toLowerCase();
            document.querySelectorAll('.resultado-card').forEach(card => {
                card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none';
            });
        });
    }
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
                esc(fixNames(c.pareja1_nombre || '—')) + '</div>' +
                '<div class="bracket-vs">vs</div>' +
                '<div class="bracket-team' + (c.ganador === 'pareja2' ? ' winner' : '') + '">' +
                (c.ganador === 'pareja2' ? '<span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span> ' : '') +
                esc(fixNames(c.pareja2_nombre || '—')) + '</div>' +
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
    const sf1_p1 = fixNames(g1?.ganador === 'pareja1' ? g1.pareja1_nombre : g1?.pareja2_nombre || '—');
    const sf1_p2 = fixNames(g2?.ganador === 'pareja1' ? g2.pareja1_nombre : g2?.pareja2_nombre || '—');
    const sf2_p1 = fixNames(g3?.ganador === 'pareja1' ? g3.pareja1_nombre : g3?.pareja2_nombre || '—');
    const sf2_p2 = fixNames(g4?.ganador === 'pareja1' ? g4.pareja1_nombre : g4?.pareja2_nombre || '—');
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
    const sf1p1 = fixNames(allSemis[0].pareja1_nombre || '');
    const sf1p2 = fixNames(allSemis[0].pareja2_nombre || '');
    const sf2p1 = fixNames(allSemis[1].pareja1_nombre || '');
    const sf2p2 = fixNames(allSemis[1].pareja2_nombre || '');
    const finalP1 = allSemis[0].ganador === 'pareja1' ? sf1p1 : sf1p2;
    const finalP2 = allSemis[1].ganador === 'pareja1' ? sf2p1 : sf2p2;
    const fin = allFinales[0] || {};
    if (fin.ganador) {
        const winnerName = fin.ganador === 'pareja1' ? finalP1 : finalP2;
        el.innerHTML =
            '<div class="bracket-round">' +
            '<div class="bracket-round-header"><span class="material-symbols-outlined" style="font-size:0.9rem;">workspace_premium</span> Gran Final</div>' +
            '<div class="champion-card">' +
            '<span class="champion-trophy">🏆</span>' +
            '<div class="champion-title">¡CAMPEONES!</div>' +
            '<div class="champion-name">' + esc(winnerName) + '</div>' +
            (fin.score ? '<div class="champion-score">Final: ' + esc(fin.score) + '</div>' : '') +
            '</div>' +
            '</div>';
    } else {
        el.innerHTML =
            '<div class="bracket-round">' +
            '<div class="bracket-round-header"><span class="material-symbols-outlined" style="font-size:0.9rem;">workspace_premium</span> Gran Final</div>' +
            '<div class="bracket-match">' +
            '<div class="bracket-match-body">' +
            '<div class="bracket-team">' + esc(finalP1 || '—') + '</div>' +
            '<div class="bracket-vs">vs</div>' +
            '<div class="bracket-team">' + esc(finalP2 || '—') + '</div>' +
            '</div>' +
            '<div class="bracket-score tbd">' + esc(fin.score || '—') + '</div>' +
            '</div>' +
            '</div>';
    }
}

// ── Tab Switching ──
// Los datos ya están cargados (loadAllData se ejecutó en init).
// El cambio de tab es instantáneo: solo renderiza la tab solicitada.
function _renderTab(tabId) {
    document.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const tabBtn = document.querySelector('[data-tab="' + tabId + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    const content = document.getElementById(tabId);
    if (content) content.classList.add('active');
    switch (tabId) {
        case 'posiciones': renderPosiciones(); break;
        case 'resultados': renderResultados(); break;
        case 'cuartos': renderCuartos(); break;
        case 'semifinales': renderSemifinales(); break;
        case 'finales': renderFinales(); break;
    }
}

window.showTab = function(tabId) {
    history.pushState({ tab: tabId }, '', '#' + tabId);
    _renderTab(tabId);
};

window.addEventListener('popstate', () => {
    const tab = (history.state && history.state.tab) || location.hash.replace('#', '') || 'posiciones';
    _renderTab(tab);
});

// ── Tab Scroll Indicator ──
function setupTabScroll() {
    document.querySelectorAll('.tab-nav-wrap').forEach(wrap => {
        const nav = wrap.querySelector('.tab-nav');
        const btn = wrap.querySelector('.tab-scroll-btn');
        if (!nav || !btn) return;
        const update = () => {
            const overflow = nav.scrollWidth > nav.clientWidth + nav.scrollLeft + 4;
            btn.classList.toggle('hidden', !overflow);
        };
        btn.addEventListener('click', () => nav.scrollBy({ left: 150, behavior: 'smooth' }));
        nav.addEventListener('scroll', update);
        window.addEventListener('resize', update);
        update();
    });
}

// ── Initial Load ──
async function init() {
    try {
        document.getElementById('posiciones').innerHTML = loadingHTML;
        await loadAllData();
        const initialTab = location.hash.replace('#', '') || 'posiciones';
        history.replaceState({ tab: initialTab }, '', '#' + initialTab);
        _renderTab(initialTab);
        setupTabScroll();
    } catch (e) {
        console.error('Error loading initial data:', e);
        document.getElementById('posiciones').innerHTML = '<div class="empty-state"><span class="material-symbols-outlined" style="color:var(--error);">error</span><p>Error al cargar datos. Verifica la conexión.</p></div>';
    }
}

init();
