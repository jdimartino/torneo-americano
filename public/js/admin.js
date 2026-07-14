import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  collection, getDocs, addDoc, updateDoc, doc, deleteDoc,
  query, orderBy, writeBatch, increment
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ── State ──
let allJugadores = [];
let allPartidos = [];
let allCuartos = [];
let allSemis = [];
let allFinales = [];
let editingPartidoId = null;
let editingCuartoId = null;

// ── Toast ──
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

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ── Auth ──
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('login-container-wrapper').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        loadData();
    } else {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('login-container-wrapper').style.display = 'block';
        document.getElementById('admin-panel').style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
        toast(e.message, 'error');
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
});

// ── Tab Navigation ──
window.showPanel = function(panelId) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(el => el.classList.remove('active'));
    const btn = document.querySelector('[data-panel="' + panelId + '"]');
    if (btn) btn.classList.add('active');
    const content = document.getElementById('panel-' + panelId);
    if (content) content.classList.add('active');
    renderPanel(panelId);
};

// ── Load All Data ──
async function loadData() {
    try {
        const [j, p, c, s, f] = await Promise.all([
            getDocs(query(collection(db, 'jugadores'), orderBy('apellidos'))),
            getDocs(query(collection(db, 'partidos_eliminatoria'), orderBy('fecha', 'desc'))),
            getDocs(query(collection(db, 'cuartos'), orderBy('grupo'))),
            getDocs(query(collection(db, 'semifinales'), orderBy('cruce'))),
            getDocs(collection(db, 'final'))
        ]);
        allJugadores = j.docs.map(d => ({ id: d.id, ...d.data() }));
        allPartidos = p.docs.map(d => ({ id: d.id, ...d.data() }));
        allCuartos = c.docs.map(d => ({ id: d.id, ...d.data() }));
        allSemis = s.docs.map(d => ({ id: d.id, ...d.data() }));
        allFinales = f.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('Error loading data:', e);
    }
}

async function refreshData() {
    await loadData();
    const active = document.querySelector('.admin-panel.active');
    if (active) {
        const panelId = active.id.replace('panel-', '');
        renderPanel(panelId);
    }
}

// ── Render Panel ──
function renderPanel(panelId) {
    switch (panelId) {
        case 'jugadores': renderJugadores(); break;
        case 'eliminatoria': renderEliminatoria(); break;
        case 'cuartos-admin': renderCuartosAdmin(); break;
        case 'semis-admin': renderSemisAdmin(); break;
        case 'final-admin': renderFinalAdmin(); break;
    }
}

// ═══════════════════════════════════════
// PANEL: JUGADORES INSCRITOS
// ═══════════════════════════════════════
function renderJugadores() {
    const panel = document.getElementById('panel-jugadores');
    panel.innerHTML = '' +
        '<div class="card">' +
        '<h3>Nuevo Jugador</h3>' +
        '<div class="form-row">' +
        '<div class="form-group"><input type="text" id="j-nombre" placeholder="Nombres"></div>' +
        '<div class="form-group"><input type="text" id="j-apellidos" placeholder="Apellidos"></div>' +
        '</div>' +
        '<div class="form-group"><input type="text" id="j-categoria" placeholder="Categoría"></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><input type="tel" id="j-telefono" placeholder="Teléfono"></div>' +
        '<div class="form-group"><input type="email" id="j-email" placeholder="Email"></div>' +
        '</div>' +
        '<div class="form-group"><input type="text" id="j-accion" placeholder="Número de acción del club"></div>' +
        '<div class="checkbox-group"><input type="checkbox" id="j-pago"><label for="j-pago">Pago Recibido</label></div>' +
        '<button class="btn btn-primary btn-block" id="btn-add-jugador">Agregar Jugador</button>' +
        '</div>' +
        '<div class="admin-section-title">Jugadores Inscritos (' + allJugadores.length + ')</div>' +
        allJugadores.map(j => '' +
            '<div class="player-card">' +
            '<div class="player-main">' +
            '<div class="player-name">' + esc(j.nombre) + ' ' + esc(j.apellidos) + '</div>' +
            '<div class="player-meta">' +
            esc(j.categoria || '') + (j.categoria ? ' · ' : '') +
            esc(j.telefono || '') + (j.telefono ? ' · ' : '') +
            esc(j.email || '') +
            '</div>' +
            '<div class="player-stats">JJ: ' + (j.JJ || 0) + ' · JG: ' + (j.JG || 0) +
            ' · Acción: ' + (j.numero_accion || '—') +
            '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<span class="badge ' + (j.pago_recibido ? 'badge-success' : 'badge-danger') + '">' + (j.pago_recibido ? 'Pago OK' : 'Sin pago') + '</span>' +
            '<button class="btn btn-sm btn-outline" data-edit-jugador="' + j.id + '">Editar</button>' +
            '<button class="btn btn-sm btn-danger" data-del-jugador="' + j.id + '">×</button>' +
            '</div>' +
            '</div>' +
        '').join('');

    document.getElementById('btn-add-jugador').addEventListener('click', addJugador);
    panel.querySelectorAll('[data-edit-jugador]').forEach(b => {
        b.addEventListener('click', () => editJugador(b.dataset.editJugador));
    });
    panel.querySelectorAll('[data-del-jugador]').forEach(b => {
        b.addEventListener('click', () => deleteJugador(b.dataset.delJugador));
    });
}

async function addJugador() {
    const data = {
        nombre: document.getElementById('j-nombre').value.trim(),
        apellidos: document.getElementById('j-apellidos').value.trim(),
        categoria: document.getElementById('j-categoria').value.trim(),
        telefono: document.getElementById('j-telefono').value.trim(),
        email: document.getElementById('j-email').value.trim(),
        numero_accion: document.getElementById('j-accion').value.trim(),
        pago_recibido: document.getElementById('j-pago').checked,
        JJ: 0,
        JG: 0
    };
    if (!data.nombre || !data.apellidos) { toast('Nombre y apellidos requeridos', 'error'); return; }
    await addDoc(collection(db, 'jugadores'), data);
    toast('Jugador agregado', 'success');
    await refreshData();
}

function editJugador(id) {
    const j = allJugadores.find(x => x.id === id);
    if (!j) return;
    document.getElementById('j-nombre').value = j.nombre || '';
    document.getElementById('j-apellidos').value = j.apellidos || '';
    document.getElementById('j-categoria').value = j.categoria || '';
    document.getElementById('j-telefono').value = j.telefono || '';
    document.getElementById('j-email').value = j.email || '';
    document.getElementById('j-accion').value = j.numero_accion || '';
    document.getElementById('j-pago').checked = j.pago_recibido || false;
    const btn = document.getElementById('btn-add-jugador');
    btn.textContent = 'Guardar Cambios';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-warning');
    btn.onclick = async () => {
        await updateDoc(doc(db, 'jugadores', id), {
            nombre: document.getElementById('j-nombre').value.trim(),
            apellidos: document.getElementById('j-apellidos').value.trim(),
            categoria: document.getElementById('j-categoria').value.trim(),
            telefono: document.getElementById('j-telefono').value.trim(),
            email: document.getElementById('j-email').value.trim(),
            numero_accion: document.getElementById('j-accion').value.trim(),
            pago_recibido: document.getElementById('j-pago').checked
        });
        toast('Jugador actualizado', 'success');
        await refreshData();
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteJugador(id) {
    if (!confirm('¿Eliminar este jugador?')) return;
    await deleteDoc(doc(db, 'jugadores', id));
    toast('Jugador eliminado', 'success');
    await refreshData();
}

// ═══════════════════════════════════════
// PANEL: FASE ELIMINATORIA
// ═══════════════════════════════════════
function renderEliminatoria() {
    const panel = document.getElementById('panel-eliminatoria');
    const activos = allJugadores.filter(j => j.pago_recibido);
    const opts = activos.map(j => '<option value="' + j.id + '">' + esc(j.nombre) + ' ' + esc(j.apellidos) + '</option>').join('');

    panel.innerHTML = '' +
        '<div class="match-form">' +
        '<h3>' + (editingPartidoId ? 'Editar Partido' : 'Nuevo Partido') + '</h3>' +
        '<div class="pair-label">Pareja 1</div>' +
        '<div class="pair-row">' +
        '<select id="el-p1a"><option value="">— Jugador A —</option>' + opts + '</select>' +
        '<select id="el-p1b"><option value="">— Jugador B —</option>' + opts + '</select>' +
        '</div>' +
        '<div class="pair-label">Pareja 2</div>' +
        '<div class="pair-row">' +
        '<select id="el-p2c"><option value="">— Jugador C —</option>' + opts + '</select>' +
        '<select id="el-p2d"><option value="">— Jugador D —</option>' + opts + '</select>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Score</label><input type="text" id="el-score" placeholder="Ej: 4-2"></div>' +
        '</div>' +
        '<div class="btn-group-spaced">' +
        '<button class="btn btn-primary" id="btn-save-partido">' + (editingPartidoId ? 'Actualizar Partido' : 'Registrar Partido') + '</button>' +
        (editingPartidoId ? '<button class="btn btn-outline" id="btn-cancel-edit">Cancelar</button>' : '') +
        '</div>' +
        '</div>' +
        '<div class="admin-section-title">Partidos Registrados (' + allPartidos.length + ')</div>' +
        (allPartidos.length ? '' : '<div class="empty-state"><p>Aún no hay partidos registrados</p></div>') +
        allPartidos.map(p => '' +
            '<div class="match-item">' +
            '<div class="match-info">' +
            '<div class="match-teams">' + esc(p.pareja1_nombre || '') + ' vs ' + esc(p.pareja2_nombre || '') + '</div>' +
            '<div class="match-meta">Score: ' + esc(p.score || '—') + ' · ' + (p.fecha ? new Date(p.fecha.toDate ? p.fecha.toDate() : p.fecha).toLocaleDateString('es-AR') : '') + '</div>' +
            '</div>' +
            '<div class="btn-group">' +
            '<button class="btn btn-sm btn-outline" data-edit-partido="' + p.id + '">Editar</button>' +
            '<button class="btn btn-sm btn-danger" data-del-partido="' + p.id + '">×</button>' +
            '</div>' +
            '</div>' +
        '').join('');

    document.getElementById('btn-save-partido').addEventListener('click', () => savePartido());
    if (editingPartidoId) {
        document.getElementById('btn-cancel-edit').addEventListener('click', () => { editingPartidoId = null; renderEliminatoria(); });
    }
    panel.querySelectorAll('[data-edit-partido]').forEach(b => {
        b.addEventListener('click', () => startEditPartido(b.dataset.editPartido));
    });
    panel.querySelectorAll('[data-del-partido]').forEach(b => {
        b.addEventListener('click', () => deletePartido(b.dataset.delPartido));
    });
}

function parseScore(scoreStr) {
    const parts = (scoreStr || '').split('-').map(s => parseInt(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { games1: parts[0], games2: parts[1] };
    }
    return null;
}

function getPlayerName(id) {
    const j = allJugadores.find(x => x.id === id);
    return j ? (j.nombre + ' ' + j.apellidos) : '';
}

async function savePartido() {
    const p1a = document.getElementById('el-p1a').value;
    const p1b = document.getElementById('el-p1b').value;
    const p2c = document.getElementById('el-p2c').value;
    const p2d = document.getElementById('el-p2d').value;
    const scoreStr = document.getElementById('el-score').value.trim();
    const score = parseScore(scoreStr);

    if (!p1a || !p1b || !p2c || !p2d) { toast('Seleccioná los 4 jugadores', 'error'); return; }
    if (!score) { toast('Score inválido (ej: 4-2)', 'error'); return; }

    const pareja1_nombre = getPlayerName(p1a) + ' + ' + getPlayerName(p1b);
    const pareja2_nombre = getPlayerName(p2c) + ' + ' + getPlayerName(p2d);

    const batch = writeBatch(db);

    if (editingPartidoId) {
        const old = allPartidos.find(p => p.id === editingPartidoId);
        if (old && old.games1 !== undefined) {
            const oldScore = { games1: old.games1 || 0, games2: old.games2 || 0 };
            batch.update(doc(db, 'jugadores', old.p1a_id), { JG: increment(-oldScore.games1) });
            batch.update(doc(db, 'jugadores', old.p1b_id), { JG: increment(-oldScore.games1) });
            batch.update(doc(db, 'jugadores', old.p2c_id), { JG: increment(-oldScore.games2) });
            batch.update(doc(db, 'jugadores', old.p2d_id), { JG: increment(-oldScore.games2) });
        }
        batch.update(doc(db, 'partidos_eliminatoria', editingPartidoId), {
            p1a_id: p1a, p1b_id: p1b, p2c_id: p2c, p2d_id: p2d,
            pareja1_nombre, pareja2_nombre,
            score: scoreStr, games1: score.games1, games2: score.games2,
            fecha: new Date()
        });
    } else {
        const ref = doc(collection(db, 'partidos_eliminatoria'));
        batch.set(ref, {
            p1a_id: p1a, p1b_id: p1b, p2c_id: p2c, p2d_id: p2d,
            pareja1_nombre, pareja2_nombre,
            score: scoreStr, games1: score.games1, games2: score.games2,
            fecha: new Date()
        });
    }

    batch.update(doc(db, 'jugadores', p1a), { JG: increment(score.games1), JJ: increment(editingPartidoId ? 0 : 1) });
    batch.update(doc(db, 'jugadores', p1b), { JG: increment(score.games1), JJ: increment(editingPartidoId ? 0 : 1) });
    batch.update(doc(db, 'jugadores', p2c), { JG: increment(score.games2), JJ: increment(editingPartidoId ? 0 : 1) });
    batch.update(doc(db, 'jugadores', p2d), { JG: increment(score.games2), JJ: increment(editingPartidoId ? 0 : 1) });

    await batch.commit();
    editingPartidoId = null;
    toast(editingPartidoId ? 'Partido actualizado' : 'Partido registrado', 'success');
    await refreshData();
}

function startEditPartido(id) {
    const p = allPartidos.find(x => x.id === id);
    if (!p) return;
    editingPartidoId = id;
    renderEliminatoria();
    setTimeout(() => {
        document.getElementById('el-p1a').value = p.p1a_id || '';
        document.getElementById('el-p1b').value = p.p1b_id || '';
        document.getElementById('el-p2c').value = p.p2c_id || '';
        document.getElementById('el-p2d').value = p.p2d_id || '';
        document.getElementById('el-score').value = p.score || '';
    }, 50);
}

async function deletePartido(id) {
    if (!confirm('¿Eliminar este partido? Se descontarán JJ y JG de los 4 jugadores.')) return;
    const p = allPartidos.find(x => x.id === id);
    if (!p) return;
    const batch = writeBatch(db);
    if (p.p1a_id) batch.update(doc(db, 'jugadores', p.p1a_id), { JG: increment(-(p.games1 || 0)), JJ: increment(-1) });
    if (p.p1b_id) batch.update(doc(db, 'jugadores', p.p1b_id), { JG: increment(-(p.games1 || 0)), JJ: increment(-1) });
    if (p.p2c_id) batch.update(doc(db, 'jugadores', p.p2c_id), { JG: increment(-(p.games2 || 0)), JJ: increment(-1) });
    if (p.p2d_id) batch.update(doc(db, 'jugadores', p.p2d_id), { JG: increment(-(p.games2 || 0)), JJ: increment(-1) });
    batch.delete(doc(db, 'partidos_eliminatoria', id));
    await batch.commit();
    toast('Partido eliminado', 'success');
    await refreshData();
}

// ═══════════════════════════════════════
// PANEL: CUARTOS DE FINAL
// ═══════════════════════════════════════
function renderCuartosAdmin() {
    const panel = document.getElementById('panel-cuartos-admin');

    if (!allCuartos.length) {
        panel.innerHTML = '' +
            '<div class="card">' +
            '<h3>Generar Cuartos de Final</h3>' +
            '<p style="font-size:0.85rem;color:var(--text-light);margin-bottom:0.75rem;">Empareja a los 16 mejores jugadores según JG.</p>' +
            '<button class="btn btn-primary btn-block" id="btn-generar-cuartos">Generar Cuartos</button>' +
            '</div>' +
            '<div class="empty-state"><div class="empty-icon">&#127934;</div><p>Aún no se han generado los cuartos</p></div>';
        document.getElementById('btn-generar-cuartos').addEventListener('click', generarCuartos);
        return;
    }

    panel.innerHTML = '' +
        '<div class="card">' +
        '<h3>Generar Cuartos de Final</h3>' +
        '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem;">Los cuartos ya están generados. Podés regenerarlos si hay cambios en posiciones.</p>' +
        '<button class="btn btn-outline btn-block" id="btn-regenerar-cuartos" style="margin-top:0.5rem;">Regenerar Cuartos</button>' +
        '</div>' +
        '<div class="admin-section-title">Cuartos de Final</div>' +
        allCuartos.map(c => '' +
            '<div class="card">' +
            '<div class="bracket-round-header" style="border-radius:6px 6px 0 0;">Grupo ' + c.grupo + '</div>' +
            '<div style="padding:0.5rem;">' +
            '<div class="bracket-team">' + esc(c.pareja1_nombre || '—') + '</div>' +
            '<div class="bracket-vs">vs</div>' +
            '<div class="bracket-team">' + esc(c.pareja2_nombre || '—') + '</div>' +
            '</div>' +
            '<div style="padding:0 0.5rem 0.5rem;">' +
            '<div class="form-row" style="align-items:center;">' +
            '<div class="form-group" style="margin-bottom:0;"><input type="text" id="c-score-' + c.id + '" placeholder="Score" value="' + esc(c.score || '') + '" style="max-width:80px;"></div>' +
            '<select id="c-ganador-' + c.id + '" style="flex:1;padding:0.5rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.8rem;">' +
            '<option value="">— Ganador —</option>' +
            '<option value="pareja1"' + (c.ganador === 'pareja1' ? ' selected' : '') + '>' + esc(c.pareja1_nombre || 'Pareja 1') + '</option>' +
            '<option value="pareja2"' + (c.ganador === 'pareja2' ? ' selected' : '') + '>' + esc(c.pareja2_nombre || 'Pareja 2') + '</option>' +
            '</select>' +
            '</div>' +
            '<div class="btn-group-spaced">' +
            '<button class="btn btn-sm btn-primary" data-save-cuarto="' + c.id + '">Guardar</button>' +
            '<button class="btn btn-sm btn-danger" data-del-cuarto="' + c.id + '">Eliminar</button>' +
            '</div>' +
            '</div>' +
            '</div>' +
        '').join('');

    if (!allCuartos[0]) return;
    document.getElementById('btn-regenerar-cuartos').addEventListener('click', async () => {
        if (!confirm('¿Regenerar cuartos? Se eliminarán los actuales.')) return;
        await regenerarCuartos();
    });
    panel.querySelectorAll('[data-save-cuarto]').forEach(b => {
        b.addEventListener('click', () => saveCuarto(b.dataset.saveCuarto));
    });
    panel.querySelectorAll('[data-del-cuarto]').forEach(b => {
        b.addEventListener('click', () => deleteCuarto(b.dataset.delCuarto));
    });
}

async function generarCuartos() {
    const sorted = [...allJugadores].sort((a, b) => (b.JG || 0) - (a.JG || 0));
    if (sorted.length < 16) {
        toast('Se necesitan al menos 16 jugadores con partidos para generar cuartos', 'error');
        return;
    }
    const top16 = sorted.slice(0, 16);
    const grupos = [
        { grupo: 1, p1a: top16[0], p1b: top16[15], p2a: top16[7], p2b: top16[8] },
        { grupo: 2, p1a: top16[4], p1b: top16[11], p2a: top16[3], p2b: top16[12] },
        { grupo: 3, p1a: top16[1], p1b: top16[14], p2a: top16[6], p2b: top16[9] },
        { grupo: 4, p1a: top16[5], p1b: top16[10], p2a: top16[2], p2b: top16[13] }
    ];
    const batch = writeBatch(db);
    for (const g of grupos) {
        const ref = doc(collection(db, 'cuartos'));
        batch.set(ref, {
            grupo: g.grupo,
            pareja1_id_a: g.p1a.id, pareja1_id_b: g.p1b.id,
            pareja1_nombre: g.p1a.nombre + ' ' + g.p1a.apellidos + ' + ' + g.p1b.nombre + ' ' + g.p1b.apellidos,
            pareja2_id_a: g.p2a.id, pareja2_id_b: g.p2b.id,
            pareja2_nombre: g.p2a.nombre + ' ' + g.p2a.apellidos + ' + ' + g.p2b.nombre + ' ' + g.p2b.apellidos,
            score: '',
            ganador: ''
        });
    }
    await batch.commit();
    toast('Cuartos generados', 'success');
    await refreshData();
}

async function regenerarCuartos() {
    const batch = writeBatch(db);
    allCuartos.forEach(c => batch.delete(doc(db, 'cuartos', c.id)));
    await batch.commit();
    await refreshData();
    await generarCuartos();
}

async function saveCuarto(id) {
    const score = document.getElementById('c-score-' + id).value.trim();
    const ganador = document.getElementById('c-ganador-' + id).value;
    await updateDoc(doc(db, 'cuartos', id), { score, ganador });
    toast('Cuarto guardado', 'success');
    await refreshData();
    const completedCt = allCuartos.filter(c => c.score).length;
    if (completedCt === 4) await generarSemis();
}

async function deleteCuarto(id) {
    if (!confirm('¿Eliminar este cuarto?')) return;
    await deleteDoc(doc(db, 'cuartos', id));
    toast('Cuarto eliminado', 'success');
    await refreshData();
}

// ═══════════════════════════════════════
// PANEL: SEMIFINALES
// ═══════════════════════════════════════
async function generarSemis() {
    const cuartosCompletos = allCuartos.filter(c => c.ganador);
    if (cuartosCompletos.length < 4) return;
    const g1 = allCuartos.find(c => c.grupo === 1);
    const g2 = allCuartos.find(c => c.grupo === 2);
    const g3 = allCuartos.find(c => c.grupo === 3);
    const g4 = allCuartos.find(c => c.grupo === 4);
    if (!g1 || !g2 || !g3 || !g4) return;
    const sf1_p1 = g1.ganador === 'pareja1' ? g1.pareja1_nombre : g1.pareja2_nombre;
    const sf1_p2 = g2.ganador === 'pareja1' ? g2.pareja1_nombre : g2.pareja2_nombre;
    const sf2_p1 = g3.ganador === 'pareja1' ? g3.pareja1_nombre : g3.pareja2_nombre;
    const sf2_p2 = g4.ganador === 'pareja1' ? g4.pareja1_nombre : g4.pareja2_nombre;
    const batch = writeBatch(db);
    allSemis.forEach(s => batch.delete(doc(db, 'semifinales', s.id)));
    const ref1 = doc(collection(db, 'semifinales'));
    const ref2 = doc(collection(db, 'semifinales'));
    batch.set(ref1, { cruce: 1, pareja1_nombre: sf1_p1, pareja2_nombre: sf1_p2, score: '', ganador: '' });
    batch.set(ref2, { cruce: 2, pareja1_nombre: sf2_p1, pareja2_nombre: sf2_p2, score: '', ganador: '' });
    await batch.commit();
}

async function renderSemisAdmin() {
    const panel = document.getElementById('panel-semis-admin');
    if (!allSemis.length) {
        panel.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127934;</div><p>A la espera de que se completen los cuartos</p></div>';
        return;
    }
    panel.innerHTML = '' +
        '<div class="admin-section-title">Semifinales</div>' +
        allSemis.map(s => '' +
            '<div class="card">' +
            '<div class="bracket-round-header" style="border-radius:6px 6px 0 0;">Semifinal ' + s.cruce + '</div>' +
            '<div style="padding:0.5rem;">' +
            '<div class="bracket-team">' + esc(s.pareja1_nombre || '—') + '</div>' +
            '<div class="bracket-vs">vs</div>' +
            '<div class="bracket-team">' + esc(s.pareja2_nombre || '—') + '</div>' +
            '</div>' +
            '<div style="padding:0 0.5rem 0.5rem;">' +
            '<div class="form-row" style="align-items:center;">' +
            '<div class="form-group" style="margin-bottom:0;"><input type="text" id="s-score-' + s.id + '" placeholder="Score" value="' + esc(s.score || '') + '" style="max-width:80px;"></div>' +
            '<select id="s-ganador-' + s.id + '" style="flex:1;padding:0.5rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.8rem;">' +
            '<option value="">— Ganador —</option>' +
            '<option value="pareja1"' + (s.ganador === 'pareja1' ? ' selected' : '') + '>' + esc(s.pareja1_nombre || 'Pareja 1') + '</option>' +
            '<option value="pareja2"' + (s.ganador === 'pareja2' ? ' selected' : '') + '>' + esc(s.pareja2_nombre || 'Pareja 2') + '</option>' +
            '</select>' +
            '</div>' +
            '<div class="btn-group-spaced">' +
            '<button class="btn btn-sm btn-primary" data-save-semi="' + s.id + '">Guardar</button>' +
            '<button class="btn btn-sm btn-danger" data-del-semi="' + s.id + '">Eliminar</button>' +
            '</div>' +
            '</div>' +
            '</div>' +
        '').join('');

    panel.querySelectorAll('[data-save-semi]').forEach(b => {
        b.addEventListener('click', () => saveSemi(b.dataset.saveSemi));
    });
    panel.querySelectorAll('[data-del-semi]').forEach(b => {
        b.addEventListener('click', () => deleteSemi(b.dataset.delSemi));
    });
}

async function saveSemi(id) {
    const score = document.getElementById('s-score-' + id).value.trim();
    const ganador = document.getElementById('s-ganador-' + id).value;
    await updateDoc(doc(db, 'semifinales', id), { score, ganador });
    toast('Semifinal guardada', 'success');
    await refreshData();
    if (allSemis.every(s => s.ganador || s.id === id)) await refreshData().then(() => {
        if (allSemis.every(s => s.ganador)) generarFinal();
    });
}

async function deleteSemi(id) {
    if (!confirm('¿Eliminar esta semifinal?')) return;
    await deleteDoc(doc(db, 'semifinales', id));
    toast('Semifinal eliminada', 'success');
    await refreshData();
}

// ═══════════════════════════════════════
// PANEL: FINAL
// ═══════════════════════════════════════
async function generarFinal() {
    if (allSemis.length < 2) return;
    if (!allSemis[0].ganador || !allSemis[1].ganador) return;
    const sf1p1 = allSemis[0].pareja1_nombre;
    const sf1p2 = allSemis[0].pareja2_nombre;
    const sf2p1 = allSemis[1].pareja1_nombre;
    const sf2p2 = allSemis[1].pareja2_nombre;
    const fP1 = allSemis[0].ganador === 'pareja1' ? sf1p1 : sf1p2;
    const fP2 = allSemis[1].ganador === 'pareja1' ? sf2p1 : sf2p2;
    const batch = writeBatch(db);
    allFinales.forEach(f => batch.delete(doc(db, 'final', f.id)));
    const ref = doc(collection(db, 'final'));
    batch.set(ref, { pareja1_nombre: fP1, pareja2_nombre: fP2, score: '', ganador: '' });
    await batch.commit();
    await refreshData();
}

async function renderFinalAdmin() {
    const panel = document.getElementById('panel-final-admin');
    if (!allSemis.length || !allSemis.every(s => s.ganador)) {
        panel.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127942;</div><p>A la espera de que se completen las semifinales</p></div>';
        return;
    }
    if (!allFinales.length) {
        await generarFinal();
        await refreshData();
    }
    if (!allFinales.length) {
        panel.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127942;</div><p>A la espera de la final</p></div>';
        return;
    }
    const f = allFinales[0];
    panel.innerHTML = '' +
        '<div class="card">' +
        '<div class="bracket-round-header" style="border-radius:6px 6px 0 0;">Gran Final</div>' +
        '<div style="padding:0.5rem;">' +
        '<div class="bracket-team">' + esc(f.pareja1_nombre || '—') + '</div>' +
        '<div class="bracket-vs">vs</div>' +
        '<div class="bracket-team">' + esc(f.pareja2_nombre || '—') + '</div>' +
        '</div>' +
        '<div style="padding:0 0.5rem 0.5rem;">' +
        '<div class="form-row" style="align-items:center;">' +
        '<div class="form-group" style="margin-bottom:0;"><input type="text" id="f-score-' + f.id + '" placeholder="Score" value="' + esc(f.score || '') + '" style="max-width:80px;"></div>' +
        '<select id="f-ganador-' + f.id + '" style="flex:1;padding:0.5rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.8rem;">' +
        '<option value="">— Ganador —</option>' +
        '<option value="pareja1"' + (f.ganador === 'pareja1' ? ' selected' : '') + '>' + esc(f.pareja1_nombre || 'Pareja 1') + '</option>' +
        '<option value="pareja2"' + (f.ganador === 'pareja2' ? ' selected' : '') + '>' + esc(f.pareja2_nombre || 'Pareja 2') + '</option>' +
        '</select>' +
        '</div>' +
        '<div class="btn-group-spaced">' +
        '<button class="btn btn-sm btn-primary" data-save-final="' + f.id + '">Guardar</button>' +
        '<button class="btn btn-sm btn-danger" data-del-final="' + f.id + '">Eliminar</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    panel.querySelector('[data-save-final]').addEventListener('click', () => saveFinal(f.id));
    panel.querySelector('[data-del-final]').addEventListener('click', () => deleteFinal(f.id));
}

async function saveFinal(id) {
    const score = document.getElementById('f-score-' + id).value.trim();
    const ganador = document.getElementById('f-ganador-' + id).value;
    await updateDoc(doc(db, 'final', id), { score, ganador });
    toast('Final guardada', 'success');
    await refreshData();
}

async function deleteFinal(id) {
    if (!confirm('¿Eliminar la final?')) return;
    await deleteDoc(doc(db, 'final', id));
    toast('Final eliminada', 'success');
    await refreshData();
}
