import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, orderBy, writeBatch, increment } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let allJugadores = [];
let jugadorSearchTerm = '';
let allPartidos = [];
let allCuartos = [];
let allSemis = [];
let allFinales = [];
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
        case 'draw': renderDraw(); break;
        case 'resultados': renderResultados(); break;
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
        '<button class="collapse-toggle" id="j-toggle-form" type="button" aria-expanded="false">' +
        '<span class="collapse-toggle-left"><span class="material-symbols-outlined" style="font-size:1.1rem;color:var(--primary);">person_add</span> Nuevo Jugador</span>' +
        '<span class="material-symbols-outlined chevron">expand_more</span>' +
        '</button>' +
        '<div id="j-form-body" style="display:none;">' +
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
        '</div>' +
        '<div class="admin-section-title"><span class="material-symbols-outlined" style="font-size:0.9rem;">groups</span> Jugadores Inscritos</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem;">' +
        '<input type="file" id="csv-file-input" accept=".csv" style="display:none;">' +
        '<button class="btn btn-outline" id="btn-import-csv"><span class="material-symbols-outlined" style="font-size:1rem;">upload_file</span> Importar CSV</button>' +
        '<span id="csv-file-name" style="font-size:0.75rem;color:var(--on-surface-variant-30);"></span>' +
        '</div>' +
        '<div id="csv-preview" style="display:none;"></div>' +
        '<div class="search-bar"><span class="material-symbols-outlined search-icon">search</span><input type="text" id="jugador-search" placeholder="Buscar por nombre, categoría, email..." value="' + esc(jugadorSearchTerm) + '"></div>' +
        '<div id="jugadores-list"></div>';

    document.getElementById('j-toggle-form').addEventListener('click', () => {
        const open = document.getElementById('j-form-body').style.display !== 'none';
        toggleJugadorForm(!open);
    });
    document.getElementById('btn-add-jugador').onclick = addJugador;
    document.getElementById('jugador-search').addEventListener('input', (e) => {
        jugadorSearchTerm = e.target.value;
        renderJugadoresList();
    });
    document.getElementById('btn-import-csv').addEventListener('click', () => {
        document.getElementById('csv-file-input').click();
    });
    document.getElementById('csv-file-input').addEventListener('change', handleCSVFile);
    renderJugadoresList();
}

function toggleJugadorForm(open) {
    const body = document.getElementById('j-form-body');
    const btn = document.getElementById('j-toggle-form');
    if (!body || !btn) return;
    body.style.display = open ? 'block' : 'none';
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
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
            ' · GG: ' + (j.GG || 0) +
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
        JJ: 0, GG: 0
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
    toggleJugadorForm(true);
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
// CSV IMPORT
// ═══════════════════════════════════════════
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += ch; }
    }
    result.push(current.trim());
    return result;
}

function handleCSVFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const nameEl = document.getElementById('csv-file-name');
    if (nameEl) nameEl.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast('El CSV está vacío', 'error'); return; }
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
        const colMap = {
            nombre: headers.findIndex(h => h.includes('nombre')),
            apellidos: headers.findIndex(h => h.includes('apellido')),
            numero_accion: headers.findIndex(h => h.includes('socio') || h.includes('accion')),
            categoria: headers.findIndex(h => h.includes('categ')),
            telefono: headers.findIndex(h => h.includes('telefono') || h.includes('teléfono')),
            email: headers.findIndex(h => h.includes('correo') || h.includes('email'))
        };
        if (colMap.nombre === -1 || colMap.email === -1) {
            toast('El CSV no tiene las columnas esperadas (Nombres, Correo)', 'error'); return;
        }
        const existingEmails = new Set(allJugadores.map(j => (j.email || '').toLowerCase().trim()));
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            const email = (cols[colMap.email] || '').toLowerCase().trim();
            if (!email) continue;
            rows.push({
                nombre: (cols[colMap.nombre] || '').trim(),
                apellidos: (colMap.apellidos !== -1 ? (cols[colMap.apellidos] || '') : '').trim(),
                numero_accion: (colMap.numero_accion !== -1 ? (cols[colMap.numero_accion] || '') : '').trim(),
                categoria: (colMap.categoria !== -1 ? (cols[colMap.categoria] || '') : '').trim(),
                telefono: (colMap.telefono !== -1 ? (cols[colMap.telefono] || '') : '').trim(),
                email: email,
                _exists: existingEmails.has(email)
            });
        }
        const nuevos = rows.filter(r => !r._exists);
        const existentes = rows.filter(r => r._exists);
        showCSVPreview(rows, nuevos, existentes);
    };
    reader.readAsText(file);
    e.target.value = '';
}

function showCSVPreview(all, nuevos, existentes) {
    const el = document.getElementById('csv-preview');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML =
        '<div class="card">' +
        '<h3><span class="material-symbols-outlined" style="font-size:1.1rem;color:var(--secondary);">upload_file</span> Preview Importación CSV</h3>' +
        '<div style="display:flex;gap:1rem;margin-bottom:0.75rem;flex-wrap:wrap;">' +
        '<span class="badge badge-success"><span class="material-symbols-outlined" style="font-size:0.6rem;">add_circle</span> ' + nuevos.length + ' nuevos</span>' +
        '<span class="badge"><span class="material-symbols-outlined" style="font-size:0.6rem;">check_circle</span> ' + existentes.length + ' ya existen</span>' +
        '</div>' +
        (nuevos.length ? '<div style="max-height:200px;overflow-y:auto;margin-bottom:0.75rem;">' +
            nuevos.map(j =>
                '<div style="font-size:0.8rem;padding:0.3rem 0;border-bottom:1px solid var(--white-5);color:var(--text);">' +
                esc(j.nombre) + ' ' + esc(j.apellidos) + ' — <span style="color:var(--on-surface-variant-30);">' + esc(j.email) + '</span>' +
                '</div>'
            ).join('') + '</div>' : '') +
        (existentes.length ? '<details style="margin-bottom:0.75rem;"><summary style="font-size:0.8rem;color:var(--on-surface-variant-30);cursor:pointer;">Ver ' + existentes.length + ' existentes</summary><div style="max-height:150px;overflow-y:auto;">' +
            existentes.map(j =>
                '<div style="font-size:0.75rem;padding:0.25rem 0;color:var(--on-surface-variant-30);">' +
                esc(j.nombre) + ' ' + esc(j.apellidos) + ' — ' + esc(j.email) +
                '</div>'
            ).join('') + '</details></details>' : '') +
        '<div class="btn-group-spaced">' +
        (nuevos.length ? '<button class="btn btn-primary" id="btn-confirm-import"><span class="material-symbols-outlined" style="font-size:1rem;">file_upload</span> Importar ' + nuevos.length + ' nuevos</button>' : '') +
        '<button class="btn btn-outline" id="btn-cancel-import"><span class="material-symbols-outlined" style="font-size:1rem;">close</span> Cancelar</button>' +
        '</div>' +
        '</div>';

    if (nuevos.length) {
        document.getElementById('btn-confirm-import').addEventListener('click', () => confirmCSVImport(nuevos));
    }
    document.getElementById('btn-cancel-import').addEventListener('click', () => { el.style.display = 'none'; el.innerHTML = ''; });
}

async function confirmCSVImport(nuevos) {
    showLoading('Importando ' + nuevos.length + ' jugadores...');
    try {
        const batch = writeBatch(db);
        nuevos.forEach(j => {
            const ref = doc(collection(db, 'jugadores'));
            batch.set(ref, {
                nombre: j.nombre,
                apellidos: j.apellidos,
                categoria: j.categoria,
                telefono: j.telefono,
                email: j.email,
                numero_accion: j.numero_accion,
                pago_recibido: false,
                JJ: 0, GG: 0
            });
        });
        await batch.commit();
        toast(nuevos.length + ' jugadores importados', 'success');
        document.getElementById('csv-preview').style.display = 'none';
        document.getElementById('csv-preview').innerHTML = '';
        document.getElementById('csv-file-name').textContent = '';
        await refreshData();
    } catch (e) {
        toast('Error al importar', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════════
// DRAW (parejas sin score)
// ═══════════════════════════════════════════
let editingDrawId = null;
let drawScore1 = 0;
let drawScore2 = 0;

function renderDraw() {
    const panel = document.getElementById('panel-draw');
    const activos = allJugadores.filter(j => j.pago_recibido);
    const opts = activos.map(j => '<option value="' + j.id + '">' + esc(j.nombre) + ' ' + esc(j.apellidos) + '</option>').join('');

    const isEditing = !!editingDrawId;
    const ep = isEditing ? allPartidos.find(x => x.id === editingDrawId) : null;

    if (isEditing && ep && ep.games1 !== null) {
        drawScore1 = ep.games1 || 0;
        drawScore2 = ep.games2 || 0;
    } else {
        drawScore1 = 0;
        drawScore2 = 0;
    }

    const showScore = isEditing && ep && ep.games1 !== null;

    panel.innerHTML =
        '<div class="card">' +
        '<button class="collapse-toggle" id="d-toggle-form" type="button" aria-expanded="' + (isEditing ? 'true' : 'false') + '">' +
        '<span class="collapse-toggle-left"><span class="material-symbols-outlined" style="font-size:1.1rem;color:var(--primary);">sports_tennis</span> ' + (isEditing ? 'Editar Partido' : 'Nuevo Partido') + '</span>' +
        '<span class="material-symbols-outlined chevron">' + (isEditing ? 'expand_less' : 'expand_more') + '</span>' +
        '</button>' +
        '<div id="d-form-body" style="display:' + (isEditing ? 'block' : 'none') + ';">' +
        '<div class="match-form">' +
        '<div class="pair-label team-a"><span class="material-symbols-outlined" style="font-size:0.8rem;">circle</span> Pareja 1</div>' +
        '<div class="pair-row">' +
        '<select id="d-p1a"><option value="">— Jugador A —</option>' + opts + '</select>' +
        '<select id="d-p1b"><option value="">— Jugador B —</option>' + opts + '</select>' +
        '</div>' +
        '<div class="pair-label team-b"><span class="material-symbols-outlined" style="font-size:0.8rem;">circle</span> Pareja 2</div>' +
        '<div class="pair-row">' +
        '<select id="d-p2c"><option value="">— Jugador C —</option>' + opts + '</select>' +
        '<select id="d-p2d"><option value="">— Jugador D —</option>' + opts + '</select>' +
        '</div>' +
        (showScore ?
        '<div class="score-display-card">' +
        '<div class="score-row">' +
        '<span class="team-dot blue"></span>' +
        '<span class="team-name blue">Pareja 1</span>' +
        '<div class="score-control">' +
        '<button class="score-btn team-blue" onclick="changeDrawScore(1,-1)">−</button>' +
        '<span class="score-value blue" id="ds1">' + drawScore1 + '</span>' +
        '<button class="score-btn team-blue" onclick="changeDrawScore(1,1)">+</button>' +
        '</div>' +
        '</div>' +
        '<div class="score-row">' +
        '<span class="team-dot gold"></span>' +
        '<span class="team-name gold">Pareja 2</span>' +
        '<div class="score-control">' +
        '<button class="score-btn team-gold" onclick="changeDrawScore(2,-1)">−</button>' +
        '<span class="score-value gold" id="ds2">' + drawScore2 + '</span>' +
        '<button class="score-btn team-gold" onclick="changeDrawScore(2,1)">+</button>' +
        '</div>' +
        '</div>' +
        '<div class="score-label" id="ds-label"><span class="material-symbols-outlined" style="font-size:0.75rem;">sports_score</span> Score: ' + drawScore1 + '-' + drawScore2 + '</div>' +
        '</div>' : '') +
        '<div class="btn-group-spaced" style="margin-top:0.75rem;">' +
        '<button class="btn btn-primary" id="btn-save-draw"><span class="material-symbols-outlined" style="font-size:1rem;">' + (isEditing ? 'save' : 'add') + '</span> ' + (isEditing ? 'Actualizar' : 'Crear Parejas') + '</button>' +
        (isEditing ? '<button class="btn btn-outline" id="btn-cancel-draw"><span class="material-symbols-outlined" style="font-size:1rem;">close</span> Cancelar</button>' : '') +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="admin-section-title"><span class="material-symbols-outlined" style="font-size:0.9rem;">sports_tennis</span> Partidos DRAW (' + allPartidos.length + ')</div>' +
        (!allPartidos.length ? '<div class="empty-state" style="padding:1.5rem;"><span class="material-symbols-outlined">sports_tennis</span><p>No hay partidos en el DRAW</p></div>' : '') +
        allPartidos.map(p =>
            '<div class="match-item">' +
            '<div class="match-info">' +
            '<div class="match-teams"><span class="material-symbols-outlined" style="font-size:0.85rem;color:var(--primary);">sports_tennis</span> ' + esc(p.pareja1_nombre || '') + ' <span style="color:var(--on-surface-variant-30)">vs</span> ' + esc(p.pareja2_nombre || '') + '</div>' +
            '<div class="match-meta">' + (p.score ? '<span class="match-score">' + esc(p.score) + '</span> · ' : '') + (p.fecha ? new Date(p.fecha.toDate ? p.fecha.toDate() : p.fecha).toLocaleDateString('es-AR') : '') + '</div>' +
            '</div>' +
            '<div class="btn-group">' +
            '<button class="btn btn-sm btn-outline" data-edit-draw="' + p.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">edit</span></button>' +
            '<button class="btn btn-sm btn-danger" data-del-draw="' + p.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">delete</span></button>' +
            '</div>' +
            '</div>'
        ).join('');

    if (isEditing && ep) {
        setTimeout(() => {
            document.getElementById('d-p1a').value = ep.p1a_id || '';
            document.getElementById('d-p1b').value = ep.p1b_id || '';
            document.getElementById('d-p2c').value = ep.p2c_id || '';
            document.getElementById('d-p2d').value = ep.p2d_id || '';
        }, 50);
    }

    document.getElementById('d-toggle-form').addEventListener('click', () => {
        const open = document.getElementById('d-form-body').style.display !== 'none';
        toggleDrawForm(!open);
    });
    document.getElementById('btn-save-draw').addEventListener('click', saveDrawPartido);
    if (isEditing) {
        document.getElementById('btn-cancel-draw').addEventListener('click', () => { editingDrawId = null; renderDraw(); });
    }
    panel.querySelectorAll('[data-edit-draw]').forEach(b => b.addEventListener('click', () => { editingDrawId = b.dataset.editDraw; renderDraw(); }));
    panel.querySelectorAll('[data-del-draw]').forEach(b => b.addEventListener('click', () => deleteDrawPartido(b.dataset.delDraw)));
}

window.changeDrawScore = function(team, delta) {
    if (team === 1) { drawScore1 = Math.max(0, drawScore1 + delta); document.getElementById('ds1').textContent = drawScore1; }
    else { drawScore2 = Math.max(0, drawScore2 + delta); document.getElementById('ds2').textContent = drawScore2; }
    document.getElementById('ds-label').innerHTML = '<span class="material-symbols-outlined" style="font-size:0.75rem;">sports_score</span> Score: ' + drawScore1 + '-' + drawScore2;
};

function toggleDrawForm(open) {
    const body = document.getElementById('d-form-body');
    const btn = document.getElementById('d-toggle-form');
    if (!body || !btn) return;
    body.style.display = open ? 'block' : 'none';
    btn.classList.toggle('open', open);
    btn.querySelector('.chevron').textContent = open ? 'expand_less' : 'expand_more';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

async function saveDrawPartido() {
    const p1a = document.getElementById('d-p1a').value;
    const p1b = document.getElementById('d-p1b').value;
    const p2c = document.getElementById('d-p2c').value;
    const p2d = document.getElementById('d-p2d').value;
    if (!p1a || !p1b || !p2c || !p2d) { toast('Seleccioná los 4 jugadores', 'error'); return; }
    const pareja1_nombre = getPlayerName(p1a) + ' + ' + getPlayerName(p1b);
    const pareja2_nombre = getPlayerName(p2c) + ' + ' + getPlayerName(p2d);

    if (editingDrawId) {
        const old = allPartidos.find(p => p.id === editingDrawId);
        const batch = writeBatch(db);
        if (old && old.games1 !== null) {
            batch.update(doc(db, 'jugadores', old.p1a_id), { GG: increment(-old.games1) });
            batch.update(doc(db, 'jugadores', old.p1b_id), { GG: increment(-old.games1) });
            batch.update(doc(db, 'jugadores', old.p2c_id), { GG: increment(-old.games2) });
            batch.update(doc(db, 'jugadores', old.p2d_id), { GG: increment(-old.games2) });
        }
        const hasScore = document.getElementById('ds1');
        const g1 = hasScore ? drawScore1 : null;
        const g2 = hasScore ? drawScore2 : null;
        const scoreStr = hasScore ? drawScore1 + '-' + drawScore2 : '';
        batch.update(doc(db, 'partidos_eliminatoria', editingDrawId), {
            p1a_id: p1a, p1b_id: p1b, p2c_id: p2c, p2d_id: p2d,
            pareja1_nombre, pareja2_nombre, score: scoreStr, games1: g1, games2: g2, fecha: new Date()
        });
        showLoading('Actualizando partido...');
        try {
            await batch.commit();
            editingDrawId = null;
            toast('Partido actualizado', 'success');
            await refreshData();
        } catch (e) {
            toast('Error al actualizar', 'error');
            console.error(e);
        } finally {
            hideLoading();
        }
    } else {
        const ref = doc(collection(db, 'partidos_eliminatoria'));
        await addDoc(collection(db, 'partidos_eliminatoria'), {
            p1a_id: p1a, p1b_id: p1b, p2c_id: p2c, p2d_id: p2d,
            pareja1_nombre, pareja2_nombre, score: '', games1: null, games2: null, fecha: new Date()
        });
        toast('Parejas creadas en el DRAW', 'success');
        await refreshData();
    }
}

async function deleteDrawPartido(id) {
    const p = allPartidos.find(x => x.id === id);
    if (!p) return;
    const msg = (p.score && p.games1 !== null)
        ? '⚠️ Este partido tiene score registrado. Se eliminará completamente del DRAW y de Resultados. Se descontarán JJ y GG de los jugadores. ¿Querés crearlo de nuevo en el DRAW para que aparezca en Resultados. ¿Confirmar eliminación?'
        : '¿Eliminar este partido del DRAW?';
    if (!confirm(msg)) return;
    showLoading('Eliminando partido...');
    try {
        const batch = writeBatch(db);
        if (p.p1a_id) batch.update(doc(db, 'jugadores', p.p1a_id), { GG: increment(-(p.games1 || 0)), JJ: increment(-1) });
        if (p.p1b_id) batch.update(doc(db, 'jugadores', p.p1b_id), { GG: increment(-(p.games1 || 0)), JJ: increment(-1) });
        if (p.p2c_id) batch.update(doc(db, 'jugadores', p.p2c_id), { GG: increment(-(p.games2 || 0)), JJ: increment(-1) });
        if (p.p2d_id) batch.update(doc(db, 'jugadores', p.p2d_id), { GG: increment(-(p.games2 || 0)), JJ: increment(-1) });
        batch.delete(doc(db, 'partidos_eliminatoria', id));
        await batch.commit();
        if (editingDrawId === id) editingDrawId = null;
        toast('Partido eliminado', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al eliminar', 'error');
        console.error(e);
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════════
// RESULTADOS (score inline por partido)
// ═══════════════════════════════════════════
let resultScores = {};

function renderResultados() {
    const panel = document.getElementById('panel-resultados');

    if (!allPartidos.length) {
        panel.innerHTML = '<div class="empty-state" style="padding:2rem;"><span class="material-symbols-outlined">sports_tennis</span><p>No hay partidos en el DRAW. Creá las parejas primero en la pestaña DRAW.</p></div>';
        return;
    }

    resultScores = {};
    allPartidos.forEach(p => {
        resultScores[p.id] = { s1: p.games1 || 0, s2: p.games2 || 0 };
    });

    panel.innerHTML =
        '<div class="admin-section-title"><span class="material-symbols-outlined" style="font-size:0.9rem;">sports_score</span> Resultados Eliminatoria (' + allPartidos.length + ')</div>' +
        allPartidos.map(p => {
            const rs = resultScores[p.id];
            const hasScore = p.score && p.games1 !== null;
            return '<div class="card">' +
                '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">' +
                '<div style="flex:1;">' +
                '<div style="font-size:0.82rem;color:var(--team);margin-bottom:0.15rem;">' + esc(p.pareja1_nombre || '') + '</div>' +
                '<div style="font-size:0.65rem;color:var(--on-surface-variant-30);text-transform:uppercase;font-weight:600;margin-bottom:0.15rem;">vs</div>' +
                '<div style="font-size:0.82rem;color:var(--secondary);">' + esc(p.pareja2_nombre || '') + '</div>' +
                '</div>' +
                '<button class="btn btn-sm btn-danger" data-del-result="' + p.id + '" style="align-self:flex-start;"><span class="material-symbols-outlined" style="font-size:0.8rem;">delete</span></button>' +
                '</div>' +
                '<div class="score-display-card">' +
                '<div class="score-row">' +
                '<span class="team-dot blue"></span>' +
                '<span class="team-name blue">Pareja 1</span>' +
                '<div class="score-control">' +
                '<button class="score-btn team-blue" data-rs-id="' + p.id + '" data-team="1" data-delta="-1">−</button>' +
                '<span class="score-value blue" id="rs1-' + p.id + '">' + rs.s1 + '</span>' +
                '<button class="score-btn team-blue" data-rs-id="' + p.id + '" data-team="1" data-delta="1">+</button>' +
                '</div>' +
                '</div>' +
                '<div class="score-row">' +
                '<span class="team-dot gold"></span>' +
                '<span class="team-name gold">Pareja 2</span>' +
                '<div class="score-control">' +
                '<button class="score-btn team-gold" data-rs-id="' + p.id + '" data-team="2" data-delta="-1">−</button>' +
                '<span class="score-value gold" id="rs2-' + p.id + '">' + rs.s2 + '</span>' +
                '<button class="score-btn team-gold" data-rs-id="' + p.id + '" data-team="2" data-delta="1">+</button>' +
                '</div>' +
                '</div>' +
                '<div class="score-label" id="rs-label-' + p.id + '"><span class="material-symbols-outlined" style="font-size:0.75rem;">sports_score</span> Score: ' + rs.s1 + '-' + rs.s2 + '</div>' +
                '</div>' +
                '<div class="btn-group-spaced">' +
                '<button class="btn btn-primary btn-sm" data-save-result="' + p.id + '"><span class="material-symbols-outlined" style="font-size:0.8rem;">' + (hasScore ? 'update' : 'save') + '</span> ' + (hasScore ? 'Actualizar Resultado' : 'Registrar Resultado') + '</button>' +
                '</div>' +
                '</div>';
        }).join('');

    panel.querySelectorAll('[data-rs-id]').forEach(b => {
        b.addEventListener('click', () => {
            const id = b.dataset.rsId;
            const team = parseInt(b.dataset.team);
            const delta = parseInt(b.dataset.delta);
            const rs = resultScores[id];
            if (!rs) return;
            if (team === 1) rs.s1 = Math.max(0, rs.s1 + delta);
            else rs.s2 = Math.max(0, rs.s2 + delta);
            document.getElementById('rs1-' + id).textContent = rs.s1;
            document.getElementById('rs2-' + id).textContent = rs.s2;
            document.getElementById('rs-label-' + id).innerHTML = '<span class="material-symbols-outlined" style="font-size:0.75rem;">sports_score</span> Score: ' + rs.s1 + '-' + rs.s2;
        });
    });

    panel.querySelectorAll('[data-save-result]').forEach(b => b.addEventListener('click', () => saveResultado(b.dataset.saveResult)));
    panel.querySelectorAll('[data-del-result]').forEach(b => b.addEventListener('click', () => deleteDrawPartido(b.dataset.delResult)));
}

async function saveResultado(id) {
    const rs = resultScores[id];
    if (!rs) return;
    if (rs.s1 === 0 && rs.s2 === 0) { toast('Ingresá un score válido', 'error'); return; }
    const scoreStr = rs.s1 + '-' + rs.s2;
    const p = allPartidos.find(x => x.id === id);
    const batch = writeBatch(db);

    if (p && p.games1 !== null) {
        batch.update(doc(db, 'jugadores', p.p1a_id), { GG: increment(-p.games1) });
        batch.update(doc(db, 'jugadores', p.p1b_id), { GG: increment(-p.games1) });
        batch.update(doc(db, 'jugadores', p.p2c_id), { GG: increment(-p.games2) });
        batch.update(doc(db, 'jugadores', p.p2d_id), { GG: increment(-p.games2) });
    }

    if (p && p.games1 === null) {
        batch.update(doc(db, 'jugadores', p.p1a_id), { JJ: increment(1) });
        batch.update(doc(db, 'jugadores', p.p1b_id), { JJ: increment(1) });
        batch.update(doc(db, 'jugadores', p.p2c_id), { JJ: increment(1) });
        batch.update(doc(db, 'jugadores', p.p2d_id), { JJ: increment(1) });
    }

    batch.update(doc(db, 'jugadores', p.p1a_id), { GG: increment(rs.s1) });
    batch.update(doc(db, 'jugadores', p.p1b_id), { GG: increment(rs.s1) });
    batch.update(doc(db, 'jugadores', p.p2c_id), { GG: increment(rs.s2) });
    batch.update(doc(db, 'jugadores', p.p2d_id), { GG: increment(rs.s2) });

    batch.update(doc(db, 'partidos_eliminatoria', id), {
        score: scoreStr, games1: rs.s1, games2: rs.s2, fecha: new Date()
    });

    showLoading('Guardando resultado...');
    try {
        await batch.commit();
        toast('Resultado guardado', 'success');
        await refreshData();
    } catch (e) {
        toast('Error al guardar resultado', 'error');
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
            '<p style="font-size:0.82rem;color:var(--on-surface-variant-60);margin-bottom:0.75rem;">Empareja a los 16 mejores jugadores según GG.</p>' +
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
        const sorted = [...allJugadores].sort((a, b) => (b.GG || 0) - (a.GG || 0));
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
