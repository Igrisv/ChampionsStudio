/* ============================================================
   Champions Studio — News / Devlog Module
   Changelog entries + rendering + filtering
   Supports dynamic entries from Supabase with static fallback
   ============================================================ */

// ── Static Fallback Data (used when Supabase is unavailable) ──
const DEVLOG_ENTRIES_STATIC = [
    {
        id: 'static-1',
        version: 'v1.2.0',
        date: '2026-04-20',
        tag: 'moba',
        tagLabel: 'MOBA',
        title: 'Sistema MOBA 3v3 — Partida Rápida',
        description: 'Se ha implementado el modo de juego principal con partidas 3v3 en tiempo real.',
        details: [
            'Mapa de 3 líneas con jungla y monstruos neutrales',
            'Sistema de oleadas de minions con mecánica de último golpe',
            'Torres y Nexo como objetivos principales',
            'HUD completo con barra de vida, maná y habilidades',
            'Sistema de niveles y progresión dentro de la partida'
        ]
    },
    {
        id: 'static-2',
        version: 'v1.1.0',
        date: '2026-04-14',
        tag: 'moba',
        tagLabel: 'MOBA',
        title: 'Nuevos Campeones: Asesino Oscuro y Tiburón Guerrero',
        description: 'Se añaden dos nuevos campeones jugables con modelos 3D únicos y habilidades temáticas.',
        details: [
            'Asesino Oscuro: asesino cuerpo a cuerpo con habilidades de sombra',
            'Tiburón Guerrero: tanque/soporte con ataques acuáticos',
            'Modelos 3D completamente nuevos con animaciones dedicadas',
            'Integración completa con el controlador de batalla existente'
        ]
    },
    {
        id: 'static-3',
        version: 'v1.0.2',
        date: '2026-04-10',
        tag: 'fix',
        tagLabel: 'Corrección',
        title: 'Correcciones de Autenticación Móvil',
        description: 'Se resolvieron problemas con el OAuth en dispositivos móviles y la integración del selector de imágenes.',
        details: [
            'Corrección del flujo de tokens OAuth en plataformas móviles',
            'Arreglo del selector de imágenes para avatares de perfil',
            'Mejora en la subida de archivos a Supabase Storage',
            'Optimización del manejo de rutas de archivos en el plugin'
        ]
    },
    {
        id: 'static-4',
        version: 'v1.0.1',
        date: '2026-04-08',
        tag: 'platform',
        tagLabel: 'Plataforma',
        title: 'Lanzamiento de la Plataforma Web',
        description: 'Primera versión de Champions Studio con login unificado, dashboard de usuario y catálogo de juegos.',
        details: [
            'Autenticación con Email, Discord y Google',
            'Panel de usuario con Game Tokens',
            'Catálogo de juegos con enlaces de descarga',
            'Sistema de noticias con filtros por proyecto'
        ]
    },
    {
        id: 'static-5',
        version: 'v1.0.0',
        date: '2026-04-07',
        tag: 'nova',
        tagLabel: 'Nova Survivor',
        title: 'Nova Survivor — Modo Roguelite',
        description: 'Primera versión del roguelite Nova Survivor con el modo de supervivencia como experiencia principal.',
        details: [
            'Sistema de combate roguelite con oleadas de enemigos',
            'Evolución de armas y sinergias',
            'Sistema de pactos de sangre (riesgo/recompensa)',
            'Escalado de corrupción global',
            'Jefes Bullet Hell con IA avanzada'
        ]
    },
    {
        id: 'static-6',
        version: 'v0.9.0',
        date: '2026-04-05',
        tag: 'nova',
        tagLabel: 'Nova Survivor',
        title: 'Sistema de Enemigos Expandido',
        description: 'Nuevos tipos de enemigos y mejoras visuales para enriquecer el combate en Nova Survivor.',
        details: [
            'Nuevos enemigos: murciélagos y golems',
            'Números de daño flotantes con colores dinámicos',
            'Screen shake y efectos de impacto',
            'Sistema de proyectiles con trails luminosos',
            'Habilidad de dash para el jugador'
        ]
    }
];

// Runtime entries array (populated from Supabase or fallback)
let devlogEntries = [...DEVLOG_ENTRIES_STATIC];

/**
 * Try to load entries from Supabase `news` table.
 * Falls back to static data if unavailable.
 */
async function loadDevlogEntries() {
    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!sb) {
        devlogEntries = [...DEVLOG_ENTRIES_STATIC];
        return;
    }

    try {
        const { data, error } = await sb.from('news').select('*').order('date', { ascending: false });
        if (error) throw error;
        if (data && data.length > 0) {
            devlogEntries = data.map(row => ({
                id: row.id,
                version: row.version || '',
                date: row.date,
                tag: row.tag,
                tagLabel: TAG_LABELS[row.tag] || row.tag,
                title: row.title,
                description: row.description,
                details: row.details || []
            }));
        } else {
            devlogEntries = [...DEVLOG_ENTRIES_STATIC];
        }
    } catch (e) {
        console.warn('News: Supabase unavailable, using static data.', e.message);
        devlogEntries = [...DEVLOG_ENTRIES_STATIC];
    }
}

const TAG_LABELS = {
    platform: 'Plataforma',
    moba: 'MOBA',
    nova: 'Nova Survivor',
    fix: 'Corrección'
};

/**
 * Render devlog entries into the timeline
 */
function renderDevlog(filter = 'all') {
    const timeline = document.getElementById('devlog-timeline');
    if (!timeline) return;

    const filtered = filter === 'all'
        ? devlogEntries
        : devlogEntries.filter(e => e.tag === filter);

    if (filtered.length === 0) {
        timeline.innerHTML = `
            <div style="text-align:center;padding:40px;color:var(--text-muted)">
                <i data-lucide="inbox" style="width:48px;height:48px;margin-bottom:12px"></i>
                <p>No hay entradas para este filtro.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    timeline.innerHTML = filtered.map((entry, i) => `
        <div class="devlog-entry" style="animation-delay:${i * 0.1}s">
            <div class="devlog-card">
                <div class="devlog-meta">
                    <span class="devlog-version">${entry.version}</span>
                    <span class="devlog-date">${formatDate(entry.date)}</span>
                    <span class="devlog-tag devlog-tag--${entry.tag}">${entry.tagLabel}</span>
                </div>
                <h3>${entry.title}</h3>
                <p>${entry.description}</p>
                ${entry.details && entry.details.length ? `
                    <ul>
                        ${entry.details.map(d => `<li>${d}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

/**
 * Set up filter buttons
 */
function initDevlog() {
    const filtersContainer = document.getElementById('devlog-filters');
    if (!filtersContainer) return;

    filtersContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;

        filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');
        renderDevlog(filter);
    });

    // Load entries then render
    loadDevlogEntries().then(() => renderDevlog('all'));
}

/**
 * Format date string to human-readable
 */
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
