import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, orderBy, writeBatch, increment } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let allJugadores = [];
let jugadorSearchTerm = '';
let allPartidos = [];
let allCuartos = [];
let allSemis = [];
let allFinales = [];
let editingPartidoId = null;
let score1 = 0;
let score2 = 0;
let dataLoaded = false;

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

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

function showLoading(msg) {
    let overlay = document.getElementById('global-loading');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-loading';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-content"><div class="tennis-ball-spinner"></div><div class="loading-text"></div></div>';
        document.body.appendChild(overlay);
    }
    overlay.querySelector('.loading-text').textContent = msg || 'Procesando...';
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('global-loading');
    if (overlay) overlay.style.display = 'none';
}

function panelLoading(panel, msg) {
    panel.innerHTML = '<div class="panel-loading"><div class="tennis-ball-spinner"></div><div class="loading-text">' + (msg || 'Cargando...') + '</div></div>';
}

function getPlayerName(id) {
    const j = allJugadores.find(x => x.id === id);
    return j ? (j.nombre + ' ' + j.apellidos) : '';
}

function parseScore(scoreStr) {
    const parts = (scoreStr || '').split('-').map(s => parseInt(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { games1: parts[0], games2: parts[1] };
    return null;
}

// ── Auth ──
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('login-container-wrapper').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        panelLoading(document.getElementById('panel-jugadores'), 'Cargando jugadores...');
        await loadData();
        dataLoaded = true;
        renderPanel('jugadores');
    } else {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('login-container-wrapper').style.display = 'block';
        document.getElementById('admin-panel').style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errDiv = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    if (!email || !password) { errDiv.textContent = 'Ingresá email y contraseña'; errDiv.style.display = 'block'; return; }
    errDiv.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.1rem;animation:spin 1s linear infinite;">progress_activity</span> Ingresando...';
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
        console.error('Login error:', e.code, e.message);
        const msgs = {
            'auth/invalid-credential': 'Email o contraseña incorrectos',
            'auth/user-not-found': 'No existe una cuenta con ese email',
            'auth/wrong-password': 'Contraseña incorrecta',
            'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos',
            'auth/network-request-failed': 'Error de conexión',
            'auth/invalid-email': 'Email inválido'
        };
        errDiv.textContent = msgs[e.code] || e.message;
        errDiv.style.display = 'block';
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.1rem;">login</span> Ingresar';
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => { await signOut(auth); });

// ── Tab Navigation ──
window.showPanel = function(panelId) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(el => el.classList.remove('active'));
    const btn = document.querySelector('[data-panel="' + panelId + '"]');
    if (btn) btn.classList.add('active');
    const content = document.getElementById('panel-' + panelId);
    if (content) content.classList.add('active');
    if (!dataLoaded) return;
    renderPanel(panelId);
};

// ── Data ──
async function loadData() {
    try {
        const [j, p, c, s, f] = await Promise.all([
            getDocs(query(collection(db, 'jugadores'), orderBy('nombre'))),
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
    } catch (e) { console.error(e); }
}

async function refreshData() {
    await loadData();
    const active = document.querySelector('.admin-panel.active');
    if (active) renderPanel(active.id.replace('panel-', ''));
}

function renderPanel(panelId) {
    switch (panelId) {
        case 'jugadores': renderJugadores(); break;
        case 'eliminatoria': renderEliminatoria(); break;
        case 'cuartos-admin': renderCuartosAdmin(); break;
        case 'semis-admin': renderSemisAdmin(); break;
        case 'final-admin': renderFinalAdmin(); break;
    }
}

// ═══════════════════════════════════════════
// JUGADORES
// ═══════════════════════════════════════════
function renderJugadores() {
    const panel = document.getElementById('panel-jugadores');
    panel.innerHTML =
        '<div class="card">' +
        '<h3><span class="material-symbols-outlined" style="font-size:1.1rem;color:var(--primary);">person_add</span> Nuevo Jugador</h3>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Nombres</label><input type="text" id="j-nombre" placeholder="Nombres"></div>' +
        '<div class="form-group"><label>Apellidos</label><input type="text" id="j-apellidos" placeholder="Apellidos"></div>' +
        '</div>' +
        '<div class="form-group"><label>Categoría</label><input type="text" id="j-categoria" placeholder="Categoría"></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Teléfono</label><input type="tel" id="j-telefono" placeholder="Teléfono"></div>' +
        '<div class="form-group"><label>Email</label><input type="email" id="j-email" placeholder="Email"></div>' +
        '</div>' +
        '<div class="form-group"><label>N° Acción Club</label><input type="text" id="j-accion" placeholder="Número de acción del club"></div>' +
        '<div class="checkbox-group"><input type="checkbox" id="j-pago"><label for="j-pago"><span class="material-symbols-outlined" style="font-size:1rem;color:var(--primary);">payments</span> Pago Recibido</label></div>' +
        '<button class="btn btn-primary btn-block" id="btn-add-jugador"><span class="material-symbols-outlined" style="font-size:1rem;">person_add</span> Agregar Jugador</button>' +
        '</div>' +
        '<div class="admin-section-title"><span class="material-symbols-outlined" style="font-size:0.9rem;">groups</span> Jugadores Inscritos</div>' +
        '<div class="search-bar"><span class="material-symbols-outlined search-icon">search</span><input type="text" id="jugador-search" placeholder="Buscar por nombre, categoría, email..." value="' + esc(jugadorSearchTerm) + '"></div>' +
        '<div id="jugadores-list"></div>';

    document.getElementById('btn-add-jugador').addEventListener('click', addJugador);
    document.getElementById('jugador-search').addEventListener('input', (e) => {
        jugadorSearchTerm = e.target.value;
        renderJugadoresList();
    });
    renderJugadoresList();
}

function renderJugadoresList() {
    const listEl = document.getElementById('jugadores-list');
    if (!listEl) return;
    const sorted = [...allJugadores].sort((a, b) => {
        const nA = (a.nombre || '').toLowerCase();
        const nB = (b.nombre || '').toLowerCase();
        if (nA !== nB) return nA.localeCompare(nB);
        return (a.apellidos || '').toLowerCase().localeCompare((b.apellidos || '').toLowerCase());
    });
    const term = jugadorSearchTerm.toLowerCase();
    const filtered = term ? sorted.filter(j => {
        const haystack = [j.nombre, j.apellidos, j.categoria, j.telefono, j.email, j.numero_accion].join(' ').toLowerCase();
        return haystack.includes(term);
    }) : sorted;

    const title = document.querySelector('#panel-jugadores .admin-section-title');
    if (title) {
        title.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.9rem;">groups</span> Jugadores Inscritos (' + filtered.length + (term ? ' de ' + allJugadores.length : '') + ')';
    }

    listEl.innerHTML =
        (!filtered.length ? '<div class="empty-state" style="padding:1.5rem;"><span class="material-symbols-outlined">' + (term ? 'search_off' : 'group_off') + '</span><p>' + (term ? 'No se encontraron resultados' : 'No hay jugadores inscritos') + '</p></div>' : '') +
        filtered.map(j =>
            '<div class="player-card">' +
            '<div class="player-main">' +
            '<div class="player-name">' + esc(j.nombre) + ' ' + esc(j.apellidos) + '</div>' +
            '<div class="player-meta">' +
            (j.categoria ? '<span class="material-symbols-outlined" style="font-size:0.75rem;">label</span> ' + esc(j.categoria) + ' · ' : '') +
            (j.telefono ? '<span class="material-symbols-outlined" style="font-size:0.75rem;">phone</span> ' + esc(j.telefono) + ' · ' : '') +
            (j.email ? '<span class="material-symbols-outlined" style="font-size:0.75rem;">email</span> ' + esc(j.email) : '') +
            '</div>' +
            '<div class="player-stats">' +
            '<span class="material-symbols-outlined" style="font-size:0.7rem;">sports_tennis</span> JJ: ' + (j.JJ || 0) +
            ' · JG: ' + (j.JG || 0) +
            ' · <span class="material-symbols-outlined" style="font-size:0.7rem;">confirmation_number</span> ' + (j.numero_accion || '—') +
            '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:0.4rem;">' +
            '<span class="badge ' + (j.pago_recibido ? 'badge-success' : 'badge-danger') + '">' + (j.pago_recibido ? '<span class="material-symbols-outlined" style="font-size:0.6rem;">check</span> Pago' : '<span class="material-symbols-outlined" style="font-size:0.6rem;">close</span> Sin pago') + '</span>' +
            '<button class="btn btn-sm btn-outline" data-edit-jugador="' + j.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">edit</span></button>' +
            '<button class="btn btn-sm btn-danger" data-del-jugador="' + j.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">delete</span></button>' +
            '</div>' +
            '</div>'
        ).join('');

    listEl.querySelectorAll('[data-edit-jugador]').forEach(b => b.addEventListener('click', () => editJugador(b.dataset.editJugador)));
    listEl.querySelectorAll('[data-del-jugador]').forEach(b => b.addEventListener('click', () => deleteJugador(b.dataset.delJugador)));
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
        JJ: 0, JG: 0
    };
    if (!data.nombre || !data.apellidos) { toast('Nombre y apellidos requeridos', 'error'); return; }
    showLoading('Agregando jugador...');
    try {
        await addDoc(collection(db, 'jugadores'), data);
        toast('Jugador agregado', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al agregar jugador', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
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
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem;">save</span> Guardar Cambios';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-warning');
    btn.onclick = async () => {
        showLoading('Guardando cambios...');
        try {
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
        } catch (e) {
            toast('Error al actualizar', 'error');
            console.error(e);
        } finally {
            hideLoading();
        }
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteJugador(id) {
    if (!confirm('¿Eliminar este jugador?')) return;
    showLoading('Eliminando jugador...');
    try {
        await deleteDoc(doc(db, 'jugadores', id));
        toast('Jugador eliminado', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al eliminar', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════════
// ELIMINATORIA (+/- SCORE)
// ═══════════════════════════════════════════
function renderEliminatoria() {
    const panel = document.getElementById('panel-eliminatoria');
    const activos = allJugadores.filter(j => j.pago_recibido);
    const opts = activos.map(j => '<option value="' + j.id + '">' + esc(j.nombre) + ' ' + esc(j.apellidos) + '</option>').join('');

    if (editingPartidoId) {
        const p = allPartidos.find(x => x.id === editingPartidoId);
        if (p) { score1 = p.games1 || 0; score2 = p.games2 || 0; }
    } else {
        score1 = 0;
        score2 = 0;
    }

    panel.innerHTML =
        '<div class="match-form">' +
        '<h3><span class="material-symbols-outlined" style="font-size:1.1rem;color:var(--primary);">sports_tennis</span> ' + (editingPartidoId ? 'Editar Partido' : 'Nuevo Partido') + '</h3>' +
        '<div class="pair-label team-a"><span class="material-symbols-outlined" style="font-size:0.8rem;">circle</span> Pareja 1</div>' +
        '<div class="pair-row">' +
        '<select id="el-p1a"><option value="">— Jugador A —</option>' + opts + '</select>' +
        '<select id="el-p1b"><option value="">— Jugador B —</option>' + opts + '</select>' +
        '</div>' +
        '<div class="pair-label team-b"><span class="material-symbols-outlined" style="font-size:0.8rem;">circle</span> Pareja 2</div>' +
        '<div class="pair-row">' +
        '<select id="el-p2c"><option value="">— Jugador C —</option>' + opts + '</select>' +
        '<select id="el-p2d"><option value="">— Jugador D —</option>' + opts + '</select>' +
        '</div>' +
        '<div class="score-display-card">' +
        '<div class="score-row">' +
        '<span class="team-dot blue"></span>' +
        '<span class="team-name blue">Pareja 1</span>' +
        '<div class="score-control">' +
        '<button class="score-btn team-blue" onclick="changeScore(1,-1)">−</button>' +
        '<span class="score-value blue" id="sv1">' + score1 + '</span>' +
        '<button class="score-btn team-blue" onclick="changeScore(1,1)">+</button>' +
        '</div>' +
        '</div>' +
        '<div class="score-row">' +
        '<span class="team-dot gold"></span>' +
        '<span class="team-name gold">Pareja 2</span>' +
        '<div class="score-control">' +
        '<button class="score-btn team-gold" onclick="changeScore(2,-1)">−</button>' +
        '<span class="score-value gold" id="sv2">' + score2 + '</span>' +
        '<button class="score-btn team-gold" onclick="changeScore(2,1)">+</button>' +
        '</div>' +
        '</div>' +
        '<div class="score-label"><span class="material-symbols-outlined" style="font-size:0.75rem;">sports_score</span> Score: ' + score1 + '-' + score2 + '</div>' +
        '</div>' +
        '<div class="btn-group-spaced">' +
        '<button class="btn btn-primary" id="btn-save-partido"><span class="material-symbols-outlined" style="font-size:1rem;">save</span> ' + (editingPartidoId ? 'Actualizar' : 'Registrar Partido') + '</button>' +
        (editingPartidoId ? '<button class="btn btn-outline" id="btn-cancel-edit"><span class="material-symbols-outlined" style="font-size:1rem;">close</span> Cancelar</button>' : '') +
        '</div>' +
        '</div>' +
        '<div class="admin-section-title"><span class="material-symbols-outlined" style="font-size:0.9rem;">history</span> Partidos Registrados (' + allPartidos.length + ')</div>' +
        (allPartidos.length ? '' : '<div class="empty-state" style="padding:1.5rem;"><span class="material-symbols-outlined">sports_tennis</span><p>No hay partidos registrados</p></div>') +
        allPartidos.map(p =>
            '<div class="match-item">' +
            '<div class="match-info">' +
            '<div class="match-teams"><span class="material-symbols-outlined" style="font-size:0.85rem;color:var(--primary);">sports_tennis</span> ' + esc(p.pareja1_nombre || '') + ' <span style="color:var(--on-surface-variant-30)">vs</span> ' + esc(p.pareja2_nombre || '') + '</div>' +
            '<div class="match-meta"><span class="match-score">' + esc(p.score || '—') + '</span> · ' + (p.fecha ? new Date(p.fecha.toDate ? p.fecha.toDate() : p.fecha).toLocaleDateString('es-AR') : '') + '</div>' +
            '</div>' +
            '<div class="btn-group">' +
            '<button class="btn btn-sm btn-outline" data-edit-partido="' + p.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">edit</span></button>' +
            '<button class="btn btn-sm btn-danger" data-del-partido="' + p.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">delete</span></button>' +
            '</div>' +
            '</div>'
        ).join('');

    if (editingPartidoId) {
        setTimeout(() => {
            const p = allPartidos.find(x => x.id === editingPartidoId);
            if (p) {
                document.getElementById('el-p1a').value = p.p1a_id || '';
                document.getElementById('el-p1b').value = p.p1b_id || '';
                document.getElementById('el-p2c').value = p.p2c_id || '';
                document.getElementById('el-p2d').value = p.p2d_id || '';
            }
        }, 50);
    }

    document.getElementById('btn-save-partido').addEventListener('click', savePartido);
    if (editingPartidoId) {
        document.getElementById('btn-cancel-edit').addEventListener('click', () => { editingPartidoId = null; renderEliminatoria(); });
    }
    panel.querySelectorAll('[data-edit-partido]').forEach(b => b.addEventListener('click', () => startEditPartido(b.dataset.editPartido)));
    panel.querySelectorAll('[data-del-partido]').forEach(b => b.addEventListener('click', () => deletePartido(b.dataset.delPartido)));
}

window.changeScore = function(team, delta) {
    if (team === 1) { score1 = Math.max(0, score1 + delta); document.getElementById('sv1').textContent = score1; }
    else { score2 = Math.max(0, score2 + delta); document.getElementById('sv2').textContent = score2; }
    document.querySelector('.score-label').innerHTML = '<span class="material-symbols-outlined" style="font-size:0.75rem;">sports_score</span> Score: ' + score1 + '-' + score2;
};

async function savePartido() {
    const p1a = document.getElementById('el-p1a').value;
    const p1b = document.getElementById('el-p1b').value;
    const p2c = document.getElementById('el-p2c').value;
    const p2d = document.getElementById('el-p2d').value;
    if (!p1a || !p1b || !p2c || !p2d) { toast('Seleccioná los 4 jugadores', 'error'); return; }
    if (score1 === 0 && score2 === 0) { toast('Ingresá el score', 'error'); return; }
    const scoreStr = score1 + '-' + score2;
    const pareja1_nombre = getPlayerName(p1a) + ' + ' + getPlayerName(p1b);
    const pareja2_nombre = getPlayerName(p2c) + ' + ' + getPlayerName(p2d);
    const batch = writeBatch(db);

    if (editingPartidoId) {
        const old = allPartidos.find(p => p.id === editingPartidoId);
        if (old && old.games1 !== undefined) {
            batch.update(doc(db, 'jugadores', old.p1a_id), { JG: increment(-old.games1) });
            batch.update(doc(db, 'jugadores', old.p1b_id), { JG: increment(-old.games1) });
            batch.update(doc(db, 'jugadores', old.p2c_id), { JG: increment(-old.games2) });
            batch.update(doc(db, 'jugadores', old.p2d_id), { JG: increment(-old.games2) });
        }
        batch.update(doc(db, 'partidos_eliminatoria', editingPartidoId), {
            p1a_id: p1a, p1b_id: p1b, p2c_id: p2c, p2d_id: p2d,
            pareja1_nombre, pareja2_nombre, score: scoreStr, games1: score1, games2: score2, fecha: new Date()
        });
    } else {
        const ref = doc(collection(db, 'partidos_eliminatoria'));
        batch.set(ref, {
            p1a_id: p1a, p1b_id: p1b, p2c_id: p2c, p2d_id: p2d,
            pareja1_nombre, pareja2_nombre, score: scoreStr, games1: score1, games2: score2, fecha: new Date()
        });
    }

    batch.update(doc(db, 'jugadores', p1a), { JG: increment(score1), JJ: increment(editingPartidoId ? 0 : 1) });
    batch.update(doc(db, 'jugadores', p1b), { JG: increment(score1), JJ: increment(editingPartidoId ? 0 : 1) });
    batch.update(doc(db, 'jugadores', p2c), { JG: increment(score2), JJ: increment(editingPartidoId ? 0 : 1) });
    batch.update(doc(db, 'jugadores', p2d), { JG: increment(score2), JJ: increment(editingPartidoId ? 0 : 1) });

    showLoading(editingPartidoId ? 'Actualizando partido...' : 'Registrando partido...');
    try {
        await batch.commit();
        const wasEditing = !!editingPartidoId;
        editingPartidoId = null;
        toast(wasEditing ? 'Partido actualizado' : 'Partido registrado', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al guardar partido', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

function startEditPartido(id) {
    editingPartidoId = id;
    renderEliminatoria();
}

async function deletePartido(id) {
    if (!confirm('¿Eliminar este partido? Se descontarán JJ y JG.')) return;
    const p = allPartidos.find(x => x.id === id);
    if (!p) return;
    showLoading('Eliminando partido...');
    try {
        const batch = writeBatch(db);
        if (p.p1a_id) batch.update(doc(db, 'jugadores', p.p1a_id), { JG: increment(-(p.games1 || 0)), JJ: increment(-1) });
        if (p.p1b_id) batch.update(doc(db, 'jugadores', p.p1b_id), { JG: increment(-(p.games1 || 0)), JJ: increment(-1) });
        if (p.p2c_id) batch.update(doc(db, 'jugadores', p.p2c_id), { JG: increment(-(p.games2 || 0)), JJ: increment(-1) });
        if (p.p2d_id) batch.update(doc(db, 'jugadores', p.p2d_id), { JG: increment(-(p.games2 || 0)), JJ: increment(-1) });
        batch.delete(doc(db, 'partidos_eliminatoria', id));
        await batch.commit();
        toast('Partido eliminado', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al eliminar partido', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════════
// CUARTOS
// ═══════════════════════════════════════════
function renderCuartosAdmin() {
    const panel = document.getElementById('panel-cuartos-admin');
    if (!allCuartos.length) {
        panel.innerHTML =
            '<div class="card">' +
            '<h3><span class="material-symbols-outlined" style="font-size:1.1rem;color:var(--secondary);">emoji_events</span> Generar Cuartos de Final</h3>' +
            '<p style="font-size:0.82rem;color:var(--on-surface-variant-60);margin-bottom:0.75rem;">Empareja a los 16 mejores jugadores según JG.</p>' +
            '<button class="btn btn-primary btn-block" id="btn-generar-cuartos"><span class="material-symbols-outlined" style="font-size:1rem;">auto_awesome</span> Generar Cuartos</button>' +
            '</div>';
        document.getElementById('btn-generar-cuartos').addEventListener('click', generarCuartos);
        return;
    }
    panel.innerHTML =
        '<div class="card">' +
        '<h3><span class="material-symbols-outlined" style="font-size:1.1rem;color:var(--secondary);">emoji_events</span> Cuartos de Final</h3>' +
        '<button class="btn btn-outline btn-block" id="btn-regenerar-cuartos"><span class="material-symbols-outlined" style="font-size:0.9rem;">refresh</span> Regenerar Cuartos</button>' +
        '</div>' +
        allCuartos.map(c =>
            '<div class="card">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">' +
            '<span class="material-symbols-outlined" style="font-size:0.9rem;color:var(--secondary);">emoji_events</span>' +
            '<span style="font-family:Lexend;font-weight:600;font-size:0.85rem;color:var(--on-surface-variant);">Grupo ' + c.grupo + '</span>' +
            '</div>' +
            '<div style="font-size:0.82rem;color:var(--team);margin-bottom:0.15rem;">' + esc(c.pareja1_nombre || '—') + '</div>' +
            '<div style="font-size:0.65rem;color:var(--on-surface-variant-30);text-transform:uppercase;font-weight:600;margin-bottom:0.25rem;">vs</div>' +
            '<div style="font-size:0.82rem;color:var(--secondary);margin-bottom:0.75rem;">' + esc(c.pareja2_nombre || '—') + '</div>' +
            '<div class="form-row" style="align-items:center;">' +
            '<div class="form-group" style="margin-bottom:0;"><label>Score</label><input type="text" id="c-score-' + c.id + '" placeholder="4-2" value="' + esc(c.score || '') + '" style="max-width:80px;"></div>' +
            '<div class="form-group" style="margin-bottom:0;"><label>Ganador</label><select id="c-ganador-' + c.id + '">' +
            '<option value="">— Seleccionar —</option>' +
            '<option value="pareja1"' + (c.ganador === 'pareja1' ? ' selected' : '') + '>' + esc(c.pareja1_nombre || 'Pareja 1') + '</option>' +
            '<option value="pareja2"' + (c.ganador === 'pareja2' ? ' selected' : '') + '>' + esc(c.pareja2_nombre || 'Pareja 2') + '</option>' +
            '</select></div>' +
            '</div>' +
            '<div class="btn-group-spaced">' +
            '<button class="btn btn-sm btn-primary" data-save-cuarto="' + c.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">save</span> Guardar</button>' +
            '<button class="btn btn-sm btn-danger" data-del-cuarto="' + c.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">delete</span></button>' +
            '</div>' +
            '</div>'
        ).join('');

    document.getElementById('btn-regenerar-cuartos')?.addEventListener('click', async () => {
        if (!confirm('¿Regenerar cuartos? Se eliminarán los actuales.')) return;
        await regenerarCuartos();
    });
    panel.querySelectorAll('[data-save-cuarto]').forEach(b => b.addEventListener('click', () => saveCuarto(b.dataset.saveCuarto)));
    panel.querySelectorAll('[data-del-cuarto]').forEach(b => b.addEventListener('click', () => deleteCuarto(b.dataset.delCuarto)));
}

async function generarCuartos() {
    showLoading('Generando cuartos...');
    try {
        const sorted = [...allJugadores].sort((a, b) => (b.JG || 0) - (a.JG || 0));
        if (sorted.length < 16) { toast('Se necesitan al menos 16 jugadores', 'error'); hideLoading(); return; }
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
                score: '', ganador: ''
            });
        }
        await batch.commit();
        toast('Cuartos generados', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al generar cuartos', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

async function regenerarCuartos() {
    showLoading('Regenerando cuartos...');
    try {
        const batch = writeBatch(db);
        allCuartos.forEach(c => batch.delete(doc(db, 'cuartos', c.id)));
        await batch.commit();
        await refreshData();
        await generarCuartos();
    } catch (e) {
        toast('Error al regenerar', 'error');
        console.error(e);
        hideLoading();
    }
}

async function saveCuarto(id) {
    const score = document.getElementById('c-score-' + id).value.trim();
    const ganador = document.getElementById('c-ganador-' + id).value;
    showLoading('Guardando cuarto...');
    try {
        await updateDoc(doc(db, 'cuartos', id), { score, ganador });
        toast('Cuarto guardado', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al guardar', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

async function deleteCuarto(id) {
    if (!confirm('¿Eliminar este cuarto?')) return;
    showLoading('Eliminando cuarto...');
    try {
        await deleteDoc(doc(db, 'cuartos', id));
        toast('Cuarto eliminado', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al eliminar', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════════
// SEMIFINALES
// ═══════════════════════════════════════════
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

function renderSemisAdmin() {
    const panel = document.getElementById('panel-semis-admin');
    if (!allSemis.length) {
        panel.innerHTML = '<div class="empty-state" style="padding:2rem;"><span class="material-symbols-outlined">hourglass_empty</span><p>A la espera de que se completen los cuartos</p></div>';
        return;
    }
    panel.innerHTML =
        '<div class="admin-section-title"><span class="material-symbols-outlined" style="font-size:0.9rem;">military_tech</span> Semifinales</div>' +
        allSemis.map(s =>
            '<div class="card">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">' +
            '<span class="material-symbols-outlined" style="font-size:0.9rem;color:var(--team);">military_tech</span>' +
            '<span style="font-family:Lexend;font-weight:600;font-size:0.85rem;color:var(--on-surface-variant);">Semifinal ' + s.cruce + '</span>' +
            '</div>' +
            '<div style="font-size:0.82rem;color:var(--team);margin-bottom:0.15rem;">' + esc(s.pareja1_nombre || '—') + '</div>' +
            '<div style="font-size:0.65rem;color:var(--on-surface-variant-30);text-transform:uppercase;font-weight:600;margin-bottom:0.25rem;">vs</div>' +
            '<div style="font-size:0.82rem;color:var(--secondary);margin-bottom:0.75rem;">' + esc(s.pareja2_nombre || '—') + '</div>' +
            '<div class="form-row" style="align-items:center;">' +
            '<div class="form-group" style="margin-bottom:0;"><label>Score</label><input type="text" id="s-score-' + s.id + '" placeholder="4-2" value="' + esc(s.score || '') + '" style="max-width:80px;"></div>' +
            '<div class="form-group" style="margin-bottom:0;"><label>Ganador</label><select id="s-ganador-' + s.id + '">' +
            '<option value="">— Seleccionar —</option>' +
            '<option value="pareja1"' + (s.ganador === 'pareja1' ? ' selected' : '') + '>' + esc(s.pareja1_nombre || 'Pareja 1') + '</option>' +
            '<option value="pareja2"' + (s.ganador === 'pareja2' ? ' selected' : '') + '>' + esc(s.pareja2_nombre || 'Pareja 2') + '</option>' +
            '</select></div>' +
            '</div>' +
            '<div class="btn-group-spaced">' +
            '<button class="btn btn-sm btn-primary" data-save-semi="' + s.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">save</span> Guardar</button>' +
            '<button class="btn btn-sm btn-danger" data-del-semi="' + s.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">delete</span></button>' +
            '</div>' +
            '</div>'
        ).join('');

    panel.querySelectorAll('[data-save-semi]').forEach(b => b.addEventListener('click', () => saveSemi(b.dataset.saveSemi)));
    panel.querySelectorAll('[data-del-semi]').forEach(b => b.addEventListener('click', () => deleteSemi(b.dataset.delSemi)));
}

async function saveSemi(id) {
    const score = document.getElementById('s-score-' + id).value.trim();
    const ganador = document.getElementById('s-ganador-' + id).value;
    showLoading('Guardando semifinal...');
    try {
        await updateDoc(doc(db, 'semifinales', id), { score, ganador });
        toast('Semifinal guardada', 'success');
        await refreshData();
        if (allSemis.every(s => s.ganador)) await generarFinal();
    } catch (e) {
        toast('Error al guardar', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

async function deleteSemi(id) {
    if (!confirm('¿Eliminar esta semifinal?')) return;
    showLoading('Eliminando semifinal...');
    try {
        await deleteDoc(doc(db, 'semifinales', id));
        toast('Semifinal eliminada', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al eliminar', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════════
// FINAL
// ═══════════════════════════════════════════
async function generarFinal() {
    if (allSemis.length < 2 || !allSemis[0].ganador || !allSemis[1].ganador) return;
    const fP1 = allSemis[0].ganador === 'pareja1' ? allSemis[0].pareja1_nombre : allSemis[0].pareja2_nombre;
    const fP2 = allSemis[1].ganador === 'pareja1' ? allSemis[1].pareja1_nombre : allSemis[1].pareja2_nombre;
    const batch = writeBatch(db);
    allFinales.forEach(f => batch.delete(doc(db, 'final', f.id)));
    const ref = doc(collection(db, 'final'));
    batch.set(ref, { pareja1_nombre: fP1, pareja2_nombre: fP2, score: '', ganador: '' });
    await batch.commit();
    await refreshData();
}

function renderFinalAdmin() {
    const panel = document.getElementById('panel-final-admin');
    if (!allSemis.length || !allSemis.every(s => s.ganador)) {
        panel.innerHTML = '<div class="empty-state" style="padding:2rem;"><span class="material-symbols-outlined">hourglass_empty</span><p>A la espera de que se completen las semifinales</p></div>';
        return;
    }
    if (!allFinales.length) {
        generarFinal().then(() => renderFinalAdmin());
        return;
    }
    const f = allFinales[0];
    panel.innerHTML =
        '<div class="card">' +
        '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">' +
        '<span class="material-symbols-outlined" style="font-size:1rem;color:var(--secondary);">workspace_premium</span>' +
        '<span style="font-family:Lexend;font-weight:600;font-size:0.85rem;color:var(--on-surface-variant);">Gran Final</span>' +
        '</div>' +
        '<div style="font-size:0.82rem;color:var(--team);margin-bottom:0.15rem;">' + esc(f.pareja1_nombre || '—') + '</div>' +
        '<div style="font-size:0.65rem;color:var(--on-surface-variant-30);text-transform:uppercase;font-weight:600;margin-bottom:0.25rem;">vs</div>' +
        '<div style="font-size:0.82rem;color:var(--secondary);margin-bottom:0.75rem;">' + esc(f.pareja2_nombre || '—') + '</div>' +
        '<div class="form-row" style="align-items:center;">' +
        '<div class="form-group" style="margin-bottom:0;"><label>Score</label><input type="text" id="f-score-' + f.id + '" placeholder="4-2" value="' + esc(f.score || '') + '" style="max-width:80px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>Ganador</label><select id="f-ganador-' + f.id + '">' +
        '<option value="">— Seleccionar —</option>' +
        '<option value="pareja1"' + (f.ganador === 'pareja1' ? ' selected' : '') + '>' + esc(f.pareja1_nombre || 'Pareja 1') + '</option>' +
        '<option value="pareja2"' + (f.ganador === 'pareja2' ? ' selected' : '') + '>' + esc(f.pareja2_nombre || 'Pareja 2') + '</option>' +
        '</select></div>' +
        '</div>' +
        '<div class="btn-group-spaced">' +
        '<button class="btn btn-sm btn-primary" data-save-final="' + f.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">save</span> Guardar</button>' +
        '<button class="btn btn-sm btn-danger" data-del-final="' + f.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">delete</span></button>' +
        '</div>' +
        '</div>';

    panel.querySelector('[data-save-final]').addEventListener('click', async () => {
        const score = document.getElementById('f-score-' + f.id).value.trim();
        const ganador = document.getElementById('f-ganador-' + f.id).value;
        showLoading('Guardando final...');
        try {
            await updateDoc(doc(db, 'final', f.id), { score, ganador });
            toast('Final guardada', 'success');
            await refreshData();
        } catch (e) {
            toast('Error al guardar', 'error');
            console.error(e);
        } finally {
            hideLoading();
        }
    });
    panel.querySelector('[data-del-final]').addEventListener('click', async () => {
        if (!confirm('¿Eliminar la final?')) return;
        showLoading('Eliminando final...');
        try {
            await deleteDoc(doc(db, 'final', f.id));
            toast('Final eliminada', 'success');
            await refreshData();
        } catch (e) {
            toast('Error al eliminar', 'error');
            console.error(e);
        } finally {
            hideLoading();
        }
    });
}
