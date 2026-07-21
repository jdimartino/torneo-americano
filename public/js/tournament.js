import { db } from './firebase.js';
import {
    getDocs, addDoc, updateDoc, deleteDoc, doc, collection,
    query, orderBy, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
    torneosCol, torneoRef, getActiveTournamentId, getActiveTournament,
    getActiveTournamentIds, setActiveTournament, setActiveTournamentConfig,
    setSelectedTournament, addActiveTournament, removeActiveTournament, col,
    getBracketConfig, updateBracketConfig
} from './tournamentRefs.js';

let allTournaments = [];

export async function loadTournaments() {
    try {
        const snap = await getDocs(query(torneosCol(), orderBy('fechaCreacion', 'desc')));
        allTournaments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('Error loading tournaments:', e);
        allTournaments = [];
    }
    return allTournaments;
}

export function getTournaments() {
    return allTournaments;
}

export async function createTournament(name, bracketConfig) {
    const data = {
        name,
        status: 'active',
        fechaCreacion: new Date(),
        bracketConfig: bracketConfig || {
            clasificados: 16,
            grupos: 4,
            rondas: [
                { nombre: 'Cuartos', cantidad: 4, jugadoresPorPartido: 4 },
                { nombre: 'Semifinales', cantidad: 2, jugadoresPorPartido: 2 },
                { nombre: 'Final', cantidad: 1, jugadoresPorPartido: 2 }
            ]
        }
    };
    const ref = await addDoc(torneosCol(), data);
    await addActiveTournament(ref.id);
    setActiveTournament(ref.id, { id: ref.id, ...data });
    return { id: ref.id, ...data };
}

export async function switchTournament(id) {
    const snap = await getDocs(torneosCol());
    for (const d of snap.docs) {
        if (d.id === id) {
            const data = d.data();
            await setSelectedTournament(id);
            setActiveTournament(id, { id, ...data });
            return { id, ...data };
        }
    }
    return null;
}

export async function closeTournament(id) {
    await updateDoc(torneoRef(id), { status: 'closed' });
    await removeActiveTournament(id);
    if (getActiveTournamentId() === id) {
        const remaining = getActiveTournamentIds();
        if (remaining.length > 0) {
            await switchTournament(remaining[0]);
        } else {
            setActiveTournament(null, null);
        }
    }
}

export async function deleteTournament(id) {
    const batch = writeBatch(db);
    const subcols = ['jugadores', 'partidos_eliminatoria', 'cuartos', 'semifinales', 'final'];
    for (const sub of subcols) {
        const snap = await getDocs(collection(db, 'torneos', id, sub));
        snap.docs.forEach(d => batch.delete(doc(db, 'torneos', id, sub, d.id)));
    }
    batch.delete(torneoRef(id));
    await batch.commit();

    await removeActiveTournament(id);

    if (getActiveTournamentId() === id) {
        const remaining = getActiveTournamentIds();
        if (remaining.length > 0) {
            await switchTournament(remaining[0]);
        } else {
            setActiveTournament(null, null);
            await setActiveTournamentConfig(null);
        }
    }
}

function renderDefaultBracket(clasificados, grupos) {
    const c = clasificados || 16;
    const g = grupos || 4;
    return `
    <div class="form-row" style="gap:1rem;">
        <div class="form-group" style="flex:1;">
            <label>Clasificados a cuartos</label>
            <input type="number" id="t-bracket-clasificados" value="${c}" min="4" max="64">
        </div>
        <div class="form-group" style="flex:1;">
            <label>Grupos</label>
            <input type="number" id="t-bracket-grupos" value="${g}" min="2" max="8">
        </div>
    </div>
    <div style="font-size:0.75rem;color:var(--on-surface-variant-40);margin-top:0.25rem;">
        Rondas: Cuartos (${g}) → Semifinales (2) → Final (1)
    </div>`;
}

export async function renderTournamentPanel() {
    const panel = document.getElementById('panel-torneos');
    if (!panel) return;
    await loadTournaments();
    const active = getActiveTournament();
    const activeId = getActiveTournamentId();
    const activeIds = getActiveTournamentIds();

    let html = `
    <div class="card">
        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.75rem;">
            <span class="material-symbols-outlined" style="font-size:1.1rem;color:var(--primary);">add_circle</span>
            <span style="font-family:Lexend;font-weight:600;font-size:0.9rem;color:var(--on-surface);">Crear Torneo Nuevo</span>
        </div>
        <div class="form-group">
            <label>Nombre del torneo</label>
            <input type="text" id="t-name" placeholder="Ej: Torneo Femenino Agosto 2026">
        </div>
        ${renderDefaultBracket()}
        <button class="btn btn-primary" id="btn-create-tournament" style="margin-top:0.75rem;">
            <span class="material-symbols-outlined" style="font-size:1rem;">add</span> Crear Torneo
        </button>
    </div>`;

    if (active && activeId) {
        const bc = getBracketConfig();
        let cuartosCount = 0;
        try {
            const cuartosSnap = await getDocs(col('cuartos'));
            cuartosCount = cuartosSnap.size;
        } catch (e) { /* ignore */ }
        const locked = cuartosCount > 0;

        html += `
        <div class="admin-section-title">
            <span class="material-symbols-outlined" style="font-size:0.9rem;">settings</span> Configuración del Torneo
        </div>
        <div class="card">
            <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.75rem;">
                <span class="material-symbols-outlined" style="font-size:0.9rem;color:var(--primary);">tune</span>
                <span style="font-family:Lexend;font-weight:600;font-size:0.85rem;color:var(--on-surface);">${esc(active.name)}</span>
            </div>
            ${locked ?
                '<div style="font-size:0.75rem;color:var(--secondary);margin-bottom:0.75rem;"><span class="material-symbols-outlined" style="font-size:0.8rem;">info</span> Ya hay cuartos creados. Eliminá los cuartos para cambiar la configuración.</div>' : ''}
            <div class="form-row" style="gap:1rem;">
                <div class="form-group" style="flex:1;">
                    <label>Clasificados a cuartos</label>
                    <input type="number" id="t-edit-clasificados" value="${bc.clasificados}" min="4" max="64" ${locked ? 'disabled' : ''}>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Grupos</label>
                    <input type="number" id="t-edit-grupos" value="${bc.grupos}" min="2" max="8" ${locked ? 'disabled' : ''}>
                </div>
            </div>
            ${!locked ? `
            <div class="btn-group-spaced" style="margin-top:0.75rem;">
                <button class="btn btn-primary" id="btn-save-bracket-config">
                    <span class="material-symbols-outlined" style="font-size:1rem;">save</span> Guardar Configuración
                </button>
            </div>` : ''}
        </div>`;
    }

    const activeTournaments = allTournaments.filter(t => activeIds.includes(t.id));
    const closedTournaments = allTournaments.filter(t => !activeIds.includes(t.id));

    if (activeTournaments.length > 0) {
        html += `
        <div class="admin-section-title">
            <span class="material-symbols-outlined" style="font-size:0.9rem;">emoji_events</span> Torneos Activos (${activeTournaments.length})
        </div>`;
        activeTournaments.forEach(t => {
            const isCurrent = t.id === activeId;
            html += `
            <div class="card" style="${isCurrent ? 'border-left:3px solid var(--primary);' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-family:Lexend;font-weight:600;font-size:0.85rem;color:var(--on-surface);">
                            ${esc(t.name)} ${isCurrent ? '← viendo' : ''}
                        </div>
                        <div style="font-size:0.65rem;color:var(--on-surface-variant-40);margin-top:0.15rem;">
                            <span class="badge badge-success">Activo</span>
                            · Creado: ${t.fechaCreacion ? new Date(t.fechaCreacion.seconds ? t.fechaCreacion.seconds * 1000 : t.fechaCreacion).toLocaleDateString('es-AR') : '—'}
                        </div>
                    </div>
                    <div style="display:flex;gap:0.3rem;">
                        ${!isCurrent ? `<button class="btn btn-sm btn-primary" data-switch-tournament="${t.id}"><span class="material-symbols-outlined" style="font-size:0.8rem;">swap_horiz</span></button>` : ''}
                        <button class="btn btn-sm btn-outline" data-close-tournament="${t.id}" title="Archivar este torneo"><span class="material-symbols-outlined" style="font-size:0.8rem;">lock</span></button>
                        <button class="btn btn-sm btn-danger" data-delete-tournament="${t.id}"><span class="material-symbols-outlined" style="font-size:0.8rem;">delete</span></button>
                    </div>
                </div>
            </div>`;
        });
    }

    if (closedTournaments.length > 0) {
        html += `
        <div class="admin-section-title">
            <span class="material-symbols-outlined" style="font-size:0.9rem;">archive</span> Torneos Archivados (${closedTournaments.length})
        </div>`;
        closedTournaments.forEach(t => {
            html += `
            <div class="card" style="opacity:0.6;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-family:Lexend;font-weight:600;font-size:0.85rem;color:var(--on-surface);">${esc(t.name)}</div>
                        <div style="font-size:0.65rem;color:var(--on-surface-variant-40);margin-top:0.15rem;">
                            <span class="badge">Cerrado</span>
                        </div>
                    </div>
                    <div style="display:flex;gap:0.3rem;">
                        <button class="btn btn-sm btn-danger" data-delete-tournament="${t.id}"><span class="material-symbols-outlined" style="font-size:0.8rem;">delete</span></button>
                    </div>
                </div>
            </div>`;
        });
    }

    panel.innerHTML = html;

    document.getElementById('btn-create-tournament')?.addEventListener('click', async () => {
        const name = document.getElementById('t-name').value.trim();
        if (!name) { toast('Ingresá un nombre', 'error'); return; }
        const clasificados = parseInt(document.getElementById('t-bracket-clasificados').value) || 16;
        const grupos = parseInt(document.getElementById('t-bracket-grupos').value) || 4;
        showLoading('Creando torneo...');
        try {
            await createTournament(name, { clasificados, grupos });
            toast('Torneo creado', 'success');
            await refreshData();
        } catch (e) {
            toast('Error al crear torneo', 'error');
            console.error(e);
        } finally {
            hideLoading();
        }
    });

    document.getElementById('btn-save-bracket-config')?.addEventListener('click', async () => {
        const clasificados = parseInt(document.getElementById('t-edit-clasificados').value) || 16;
        const grupos = parseInt(document.getElementById('t-edit-grupos').value) || 4;
        showLoading('Guardando configuración...');
        try {
            await updateBracketConfig({ clasificados, grupos });
            toast('Configuración guardada', 'success');
            await refreshData();
        } catch (e) {
            toast('Error al guardar', 'error');
            console.error(e);
        } finally {
            hideLoading();
        }
    });

    panel.querySelectorAll('[data-switch-tournament]').forEach(b => {
        b.addEventListener('click', async () => {
            showLoading('Cambiando torneo...');
            try {
                await switchTournament(b.dataset.switchTournament);
                toast('Torneo cambiado', 'success');
                await refreshData();
            } catch (e) {
                toast('Error al cambiar torneo', 'error');
            } finally {
                hideLoading();
            }
        });
    });

    panel.querySelectorAll('[data-close-tournament]').forEach(b => {
        b.addEventListener('click', async () => {
            if (!confirm('¿Archivar este torneo? Quedará guardado pero no estará activo.')) return;
            try {
                await closeTournament(b.dataset.closeTournament);
                toast('Torneo archivado', 'success');
                await refreshData();
            } catch (e) {
                toast('Error al archivar', 'error');
            }
        });
    });

    panel.querySelectorAll('[data-delete-tournament]').forEach(b => {
        b.addEventListener('click', async () => {
            if (!confirm('¿Eliminar este torneo y TODOS sus datos? Esta acción no se puede deshacer.')) return;
            showLoading('Eliminando torneo...');
            try {
                await deleteTournament(b.dataset.deleteTournament);
                toast('Torneo eliminado', 'success');
                await refreshData();
            } catch (e) {
                toast('Error al eliminar', 'error');
            } finally {
                hideLoading();
            }
        });
    });
}

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}
