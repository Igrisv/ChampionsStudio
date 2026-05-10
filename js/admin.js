/* ============================================================
   Champions Studio — Admin Module
   CRUD for news and games management
   Supabase integration with local fallback
   ============================================================ */

let isAdmin = false;

/**
 * Check if current user has admin role.
 * Reads the 'role' column from the 'profiles' table.
 */
async function checkAdminRole() {
    isAdmin = false;
    if (typeof currentUser === 'undefined' || !currentUser) return;

    try {
        const sb = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!sb) return;

        const { data, error } = await sb
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();

        if (!error && data?.role === 'admin') {
            isAdmin = true;
        }
    } catch (e) {
        console.warn('checkAdminRole error:', e);
    }

    updateAdminVisibility();
}

/**
 * Initialize admin panel — called from app.js
 */
async function initAdmin() {
    await checkAdminRole();
    updateAdminVisibility();

    // Admin News Form
    const newsForm = document.getElementById('admin-news-form');
    if (newsForm) {
        newsForm.addEventListener('submit', handleCreateNews);
    }

    // Admin Games Form
    const gamesForm = document.getElementById('admin-games-form');
    if (gamesForm) {
        gamesForm.addEventListener('submit', handleUpdateGame);
    }

    // Load existing data into admin tables
    if (isAdmin) {
        renderAdminNewsList();
        renderAdminGamesList();
    }

    // Always fetch games so they show on the public page
    await loadGamesData();
}

/**
 * Show/hide admin nav link and section
 */
function updateAdminVisibility() {
    const adminNavLink = document.getElementById('nav-admin-link');
    if (adminNavLink) {
        adminNavLink.style.display = isAdmin ? '' : 'none';
    }
}


/* ─────────────────── NEWS MANAGEMENT ─────────────────── */

async function handleCreateNews(e) {
    e.preventDefault();
    const msgEl = document.getElementById('admin-news-message');

    const entry = {
        title: document.getElementById('admin-news-title')?.value?.trim(),
        description: document.getElementById('admin-news-desc')?.value?.trim(),
        version: document.getElementById('admin-news-version')?.value?.trim() || '',
        tag: document.getElementById('admin-news-tag')?.value?.trim() || 'General',
        date: document.getElementById('admin-news-date')?.value || new Date().toISOString().split('T')[0],
        details: (document.getElementById('admin-news-details')?.value || '')
            .split('\n').map(l => l.trim()).filter(Boolean)
    };

    if (!entry.title || !entry.description) {
        showAdminMessage(msgEl, 'Completa al menos el título y la descripción.', 'error');
        return;
    }

    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (sb) {
        try {
            const { error } = await sb.from('news').insert([entry]);
            if (error) throw error;
            showAdminMessage(msgEl, '¡Noticia publicada en Supabase!', 'success');
        } catch (err) {
            // Fallback: add to local array
            addNewsLocally(entry);
            showAdminMessage(msgEl, 'Supabase no disponible — se añadió localmente esta sesión.', 'success');
        }
    } else {
        addNewsLocally(entry);
        showAdminMessage(msgEl, 'Noticia añadida localmente (sin Supabase).', 'success');
    }

    e.target.reset();
    // Refresh news and admin list
    if (typeof loadDevlogEntries === 'function') {
        await loadDevlogEntries();
    }
    renderDevlog('all');
    renderAdminNewsList();
}

function addNewsLocally(entry) {
    const newEntry = {
        id: 'local-' + Date.now(),
        version: entry.version,
        date: entry.date,
        tags: entry.tag ? entry.tag.split(',').map(t => t.trim()).filter(Boolean) : ['General'],
        title: entry.title,
        description: entry.description,
        details: entry.details
    };
    devlogEntries.unshift(newEntry);
}

async function deleteNews(id) {
    if (!confirm('¿Eliminar esta noticia?')) return;

    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (sb && !String(id).startsWith('local-') && !String(id).startsWith('static-')) {
        try {
            const { error } = await sb.from('news').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.warn('Could not delete from Supabase:', err.message);
        }
    }

    // Remove from local array
    devlogEntries = devlogEntries.filter(e => e.id !== id);
    renderDevlog('all');
    renderAdminNewsList();
}

function renderAdminNewsList() {
    const container = document.getElementById('admin-news-list');
    if (!container) return;

    if (devlogEntries.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">No hay noticias.</p>';
        return;
    }

    container.innerHTML = devlogEntries.map(entry => `
        <div class="admin-list-item">
            <div class="admin-list-info">
                ${(entry.tags || []).map(t => `<span class="devlog-tag" style="background: rgba(147, 51, 234, 0.15); color: #c084fc; border: 1px solid rgba(147, 51, 234, 0.3); text-transform: uppercase; font-size: 0.7rem; padding: 3px 8px; border-radius: 20px; font-weight: 700;">${t}</span>`).join(' ')}
                <strong>${entry.title}</strong>
                <span class="admin-list-date">${entry.date}</span>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteNews('${entry.id}')">
                <i data-lucide="trash-2" style="width:14px;height:14px"></i>
            </button>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

/* ─────────────────── GAMES MANAGEMENT ─────────────────── */

// Local games data (fallback)
const localDefaults = [
    {
        id: 'game-moba',
        name: 'Game of Champions',
        description: 'Un MOBA frenético 3v3 diseñado para batallas épicas.',
        download_url: '#',
        version: '1.0.0',
        status: 'available',
        platform: 'PC · Windows',
        size: '~350 MB'
    },
    {
        id: 'game-nova',
        name: 'Nova Survivor',
        description: 'Roguelite implacable de supervivencia de hordas.',
        download_url: '',
        version: '',
        status: 'coming_soon',
        platform: 'PC / Móvil',
        size: 'Próximamente'
    }
];

let gamesData = [ ...localDefaults ];

async function loadGamesData() {
    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!sb) return;

    try {
        const { data, error } = await sb.from('games').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
            // Merge DB data with local fallbacks by index, ALWAYS preserving the DB's true ID (UUID)
            gamesData = data.map((dbGame, idx) => {
                const localFallback = localDefaults[idx] || {};
                return {
                    id: dbGame.id, // Always use real DB id
                    name: dbGame.name || localFallback.name || `Juego ${idx + 1}`,
                    description: dbGame.description || localFallback.description || '',
                    download_url: dbGame.download_url || localFallback.download_url || '',
                    version: dbGame.version || localFallback.version || '',
                    status: dbGame.status || localFallback.status || 'coming_soon',
                    platform: dbGame.platform || localFallback.platform || '',
                    size: dbGame.size || localFallback.size || '',
                    image_url: dbGame.image_url || localFallback.image_url || null,
                    download_info: dbGame.download_info || localFallback.download_info || null
                };
            });
        }
    } catch (e) {
        console.warn('Games: Supabase unavailable, using local data.', e.message);
    }
    
    // Always render public games
    renderPublicGames();
}

async function handleUpdateGame(e) {
    e.preventDefault();
    const msgEl = document.getElementById('admin-games-message');
    const gameId = document.getElementById('admin-game-select')?.value;

    if (!gameId) {
        showAdminMessage(msgEl, 'Selecciona un juego primero.', 'error');
        return;
    }

    const updates = {
        name: document.getElementById('admin-game-name')?.value?.trim(),
        description: document.getElementById('admin-game-desc')?.value?.trim(),
        download_url: document.getElementById('admin-game-url')?.value?.trim(),
        version: document.getElementById('admin-game-version')?.value?.trim(),
        status: document.getElementById('admin-game-status')?.value,
        platform: document.getElementById('admin-game-platform')?.value?.trim(),
        size: document.getElementById('admin-game-size')?.value?.trim(),
        image_url: document.getElementById('admin-game-image')?.value?.trim() || null,
        download_info: document.getElementById('admin-game-info')?.value?.trim() || null
    };

    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (sb) {
        try {
            const { data, error } = await sb.from('games').update(updates).eq('id', gameId).select();
            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('Supabase no actualizó nada. Posible problema de permisos (RLS) o ID no coincide.');
            }
            updateGameLocally(gameId, updates);
            showAdminMessage(msgEl, '¡Juego actualizado en Supabase!', 'success');
        } catch (err) {
            updateGameLocally(gameId, updates);
            showAdminMessage(msgEl, 'Supabase falló — actualizado localmente.', 'success');
        }
    } else {
        updateGameLocally(gameId, updates);
        showAdminMessage(msgEl, 'Juego actualizado localmente.', 'success');
    }

    renderAdminGamesList();
    renderPublicGames();
}

function updateGameLocally(id, updates) {
    const idx = gamesData.findIndex(g => g.id === id);
    if (idx !== -1) {
        gamesData[idx] = { ...gamesData[idx], ...updates };
    }
}

function renderAdminGamesList() {
    const container = document.getElementById('admin-games-list');
    if (!container) return;

    container.innerHTML = gamesData.map(game => {
        const isAvailable = game.status === 'available' || game.status === 'avaliable' || String(game.status).toLowerCase() === 'disponible';
        return `
        <div class="admin-list-item">
            <div class="admin-list-info">
                <span class="game-tag" style="background:${isAvailable ? 'rgba(62,207,142,0.1)' : 'rgba(245,166,35,0.1)'}; color:${isAvailable ? 'var(--accent-green)' : 'var(--accent-gold)'}; padding:3px 8px; border-radius:4px; font-size:0.7rem; font-weight:600;">
                    ${isAvailable ? 'DISPONIBLE' : 'PRÓXIMAMENTE'}
                </span>
                <strong>${game.name}</strong>
                <span class="admin-list-date">${game.version || '—'}</span>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="populateGameForm('${game.id}')">
                <i data-lucide="pencil" style="width:14px;height:14px"></i>
            </button>
        </div>
    `}).join('');

    // Populate select
    const gameSelect = document.getElementById('admin-game-select');
    if (gameSelect) {
        gameSelect.innerHTML = '<option value="">Selecciona un juego...</option>' +
            gamesData.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }

    if (window.lucide) lucide.createIcons();
}

function renderPublicGames() {
    const grid = document.querySelector('.games-grid');
    if (!grid) return;

    grid.innerHTML = gamesData.map(game => {
        const safeId = game.id || '';
        const safeName = game.name || '';
        const isMoba = safeId.includes('moba') || safeName.toLowerCase().includes('moba');
        
        // Define tags based on status
        let tagsHtml = '';
        if (isMoba) {
            tagsHtml += `<span class="game-tag" style="background: rgba(0, 240, 255, 0.1); color: var(--accent-cyan); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">MOBA 3v3</span>`;
        } else {
            tagsHtml += `<span class="game-tag" style="background: rgba(244, 63, 94, 0.1); color: var(--accent-magenta); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">ROGUELITE</span>`;
        }

        const isAvailable = game.status === 'available' || game.status === 'avaliable' || String(game.status).toLowerCase() === 'disponible';

        if (isAvailable) {
            tagsHtml += `<span class="game-tag" style="background: rgba(34, 197, 94, 0.1); color: var(--accent-green); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">DISPONIBLE</span>`;
        } else {
            tagsHtml += `<span class="game-tag" style="background: rgba(251, 191, 36, 0.1); color: var(--accent-gold); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">EN DESARROLLO</span>`;
        }

        // Define top image/icon area
        let bannerHtml = '';
        if (game.image_url) {
            bannerHtml = `<img src="${game.image_url}" alt="${game.name}" class="download-hero-banner" style="position: relative; object-fit: cover; height: 180px;">`;
        } else if (isMoba) {
            bannerHtml = `<img src="assets/hero-banner.png" alt="${game.name}" class="download-hero-banner" style="position: relative; object-fit: cover; height: 180px;">`;
        } else {
            bannerHtml = `
            <div style="background: linear-gradient(135deg, #1a0f2e, #4a0f2e); width: 100%; height: 180px; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="swords" style="width: 48px; height: 48px; color: rgba(255,255,255,0.2);"></i>
            </div>`;
        }

        // Define footer action
        let actionHtml = '';
        if (isAvailable) {
            actionHtml = `
            <a href="${game.download_url || '#'}" id="download-exe-btn" class="download-btn-main" ${game.download_url ? 'download' : ''}>
                <i data-lucide="download"></i> Descargar Juego
            </a>`;
            if (game.download_info) {
                actionHtml += `<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding-top:10px; margin-bottom:0;">${game.download_info}</p>`;
            }
        } else {
            actionHtml = `
            <button class="download-btn-main" style="background: var(--surface-light); color: var(--text-muted); cursor: not-allowed; justify-content: center; width: 100%;">
                <i data-lucide="clock"></i> Próximamente
            </button>`;
        }

        return `
            <div class="download-hero" style="margin-bottom: 0; display: flex; flex-direction: column;">
                ${bannerHtml}
                <div class="download-hero-content" style="flex: 1; display: flex; flex-direction: column;">
                    <div class="game-tags" style="display: flex; gap: 8px; margin-bottom: 12px;">
                        ${tagsHtml}
                    </div>
                    <h3>${game.name}</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.95rem; flex: 1;">${game.description}</p>
                    <div class="version-info" style="margin-bottom: 20px;">
                        ${game.platform} · <span>${game.size}</span> ${game.version ? `(v${game.version})` : ''}
                    </div>
                    ${actionHtml}
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function populateGameForm(gameId) {
    const game = gamesData.find(g => g.id === gameId);
    if (!game) return;

    document.getElementById('admin-game-select').value = gameId;
    document.getElementById('admin-game-name').value = game.name || '';
    document.getElementById('admin-game-desc').value = game.description || '';
    document.getElementById('admin-game-url').value = game.download_url || '';
    document.getElementById('admin-game-version').value = game.version || '';
    document.getElementById('admin-game-status').value = game.status || 'coming_soon';
    document.getElementById('admin-game-platform').value = game.platform || '';
    document.getElementById('admin-game-size').value = game.size || '';
    document.getElementById('admin-game-image').value = game.image_url || '';
    document.getElementById('admin-game-info').value = game.download_info || '';

    // Scroll to form
    document.getElementById('admin-games-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ─────────────────── PROFILE ─────────────────── */

async function initProfile() {
    if (typeof currentUser === 'undefined' || !currentUser) return;

    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    const email = currentUser.email || '';

    // Set defaults
    document.getElementById('profile-email')?.setAttribute('value', email);
    document.getElementById('profile-username')?.setAttribute('value', email.split('@')[0]);

    if (sb) {
        try {
            const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
            if (data) {
                if (data.username) {
                    document.getElementById('profile-username').value = data.username;
                    const dashUser = document.getElementById('dash-username');
                    if (dashUser) dashUser.textContent = data.username;
                }
                if (data.bio) document.getElementById('profile-bio').value = data.bio;
            }
        } catch (e) { /* profile table might not exist yet */ }
    }

    // Setup Avatar Grid
    const avatarGrid = document.getElementById('avatar-selection-grid');
    if (avatarGrid && typeof AVATAR_OPTIONS !== 'undefined') {
        const initialStr = email.charAt(0).toUpperCase();
        avatarGrid.innerHTML = AVATAR_OPTIONS.map(opt => `
            <div class="avatar-option ${opt.id === selectedAvatarId ? 'selected' : ''}" data-id="${opt.id}">
                ${opt.id === 'default' ? `<span style="font-size:1.5rem;font-weight:700">${initialStr}</span>` : `<i data-lucide="${opt.icon}"></i>`}
            </div>
        `).join('');
        avatarGrid.querySelectorAll('.avatar-option').forEach(el => {
            el.addEventListener('click', () => {
                avatarGrid.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
                el.classList.add('selected');
                selectedAvatarId = el.getAttribute('data-id');
                if (typeof applyAestheticsToAvatar === 'function') {
                    applyAestheticsToAvatar('profile-avatar-display', 'profile-frame-ring', selectedAvatarId, selectedFrameId, initialStr);
                }
            });
        });
    }

    // Setup Frame Grid
    const frameGrid = document.getElementById('frame-selection-grid');
    if (frameGrid && typeof FRAME_OPTIONS !== 'undefined') {
        const initialStr = email.charAt(0).toUpperCase();
        frameGrid.innerHTML = FRAME_OPTIONS.map(opt => `
            <div class="frame-option ${opt.id === selectedFrameId ? 'selected' : ''} ${opt.class}" data-id="${opt.id}">
                ${opt.id === 'default' ? 'Base' : ''}
            </div>
        `).join('');
        frameGrid.querySelectorAll('.frame-option').forEach(el => {
            el.addEventListener('click', () => {
                frameGrid.querySelectorAll('.frame-option').forEach(o => o.classList.remove('selected'));
                el.classList.add('selected');
                selectedFrameId = el.getAttribute('data-id');
                if (typeof applyAestheticsToAvatar === 'function') {
                    applyAestheticsToAvatar('profile-avatar-display', 'profile-frame-ring', selectedAvatarId, selectedFrameId, initialStr);
                }
            });
        });
    }
    
    if (window.lucide) lucide.createIcons();

    // Save profile
    document.getElementById('profile-save-btn')?.addEventListener('click', handleSaveProfile);
}

async function handleSaveProfile() {
    const msgEl = document.getElementById('profile-message');
    const username = document.getElementById('profile-username')?.value?.trim();
    const bio = document.getElementById('profile-bio')?.value?.trim();
    const btn = document.getElementById('profile-save-btn');

    if (!username) {
        showAdminMessage(msgEl, 'El nombre de usuario no puede estar vacío.', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Guardando...';

    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (sb) {
        try {
            const { error } = await sb.from('profiles').upsert({
                id: currentUser.id,
                username: username,
                bio: bio,
                avatar_id: typeof selectedAvatarId !== 'undefined' ? selectedAvatarId : 'default',
                frame_id: typeof selectedFrameId !== 'undefined' ? selectedFrameId : 'default',
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
            showAdminMessage(msgEl, '¡Perfil actualizado!', 'success');

            // Live update dashboard UI
            const dashUser = document.getElementById('dash-username');
            if (dashUser) dashUser.textContent = username;
            
            if (typeof applyAestheticsToAvatar === 'function') {
                const initialStr = (currentUser.email || '').charAt(0).toUpperCase();
                applyAestheticsToAvatar('dash-avatar', 'dash-frame-ring', typeof selectedAvatarId !== 'undefined' ? selectedAvatarId : 'default', typeof selectedFrameId !== 'undefined' ? selectedFrameId : 'default', initialStr);
            }
            
        } catch (err) {
            showAdminMessage(msgEl, 'Error al guardar: ' + err.message, 'error');
        }
    } else {
        showAdminMessage(msgEl, 'Perfil guardado localmente (sin Supabase).', 'success');
    }

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save" style="width:16px;height:16px"></i> Guardar Cambios';
    if (window.lucide) lucide.createIcons();
}

/* ─────────────────── CODE REDEMPTION ─────────────────── */

function initRedeem() {
    document.getElementById('redeem-btn')?.addEventListener('click', handleRedeemCode);
    document.getElementById('redeem-code-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleRedeemCode();
    });
}

async function handleRedeemCode() {
    const code = document.getElementById('redeem-code-input')?.value?.trim().toUpperCase();
    const msgEl = document.getElementById('redeem-message');
    const btn = document.getElementById('redeem-btn');

    if (!code) {
        showAdminMessage(msgEl, 'Ingresa un código para canjear.', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Validando...';

    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (sb) {
        try {
            // Check if code exists and is not used
            const { data, error } = await sb.from('codes')
                .select('*')
                .eq('code', code)
                .single();

            if (error || !data) {
                showAdminMessage(msgEl, 'Código inválido o no encontrado.', 'error');
            } else if (data.redeemed_by) {
                showAdminMessage(msgEl, 'Este código ya fue canjeado.', 'error');
            } else {
                // Mark as redeemed
                await sb.from('codes').update({
                    redeemed_by: currentUser.id,
                    redeemed_at: new Date().toISOString()
                }).eq('id', data.id);

                showAdminMessage(msgEl, `¡Código canjeado! Recompensa: ${data.reward || 'Beneficio exclusivo'}`, 'success');
            }
        } catch (err) {
            showAdminMessage(msgEl, 'Error de conexión: ' + err.message, 'error');
        }
    } else {
        // Demo mode without Supabase
        if (code === 'CHAMPIONS2026') {
            showAdminMessage(msgEl, '¡Código canjeado! Recompensa: Skin Neón Especial 🎉', 'success');
        } else {
            showAdminMessage(msgEl, 'Código inválido. Intenta con CHAMPIONS2026 (demo).', 'error');
        }
    }

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="gift" style="width:16px;height:16px"></i> Canjear Código';
    if (window.lucide) lucide.createIcons();
    document.getElementById('redeem-code-input').value = '';
}

/* ─────────────────── HELPERS ─────────────────── */

function showAdminMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'form-message visible ' + (type === 'error' ? 'error' : 'success');
    setTimeout(() => { el.className = 'form-message'; }, 5000);
}
