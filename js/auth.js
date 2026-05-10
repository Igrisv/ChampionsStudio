/* ============================================================
   Game of Champions — Auth Module
   Supabase authentication + Discord OAuth integration
   ============================================================ */

// ── Supabase Config ──
const SUPABASE_URL = 'https://fqnysilvsedbhojwgbhe.supabase.co';
const SUPABASE_ANON = 'sb_publishable_nFDdquSCRrNJd3sjGvIW1A_TPdayEg0';

// ── Auth State ──
let supabaseClient = null;
let currentUser = null;
let isAuthInitialized = false;

// ── Aesthetics State ──
const AVATAR_OPTIONS = [
    { id: 'default', icon: 'user' },
    { id: 'sword', icon: 'swords' },
    { id: 'shield', icon: 'shield' },
    { id: 'crown', icon: 'crown' },
    { id: 'flame', icon: 'flame' },
    { id: 'zap', icon: 'zap' },
    { id: 'skull', icon: 'skull' },
    { id: 'ghost', icon: 'ghost' },
    { id: 'Gamepad2', icon: 'gamepad-2' }
];

const FRAME_OPTIONS = [
    { id: 'default', class: 'frame-default' },
    { id: 'neon', class: 'frame-neon' },
    { id: 'gold', class: 'frame-gold' }
];

let selectedAvatarId = 'default';
let selectedFrameId = 'default';
let isOAuthLanding = false;

/**
 * Initialize Supabase client (called once on page load).
 * Wrapped in try/catch so navigation still works even if Supabase CDN fails.
 */
function getSupabase() {
    if (supabaseClient) return supabaseClient;
    try {
        if (window.supabase && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
        }
    } catch (e) {
        console.warn('Supabase init failed:', e);
    }
    return supabaseClient;
}

/**
 * Initialize auth – check session and set up listeners.
 * Safe to call even if Supabase isn't available.
 */
async function initAuth() {
    // ── Step 1: Snapshot the URL BEFORE Supabase touches it ──
    // Implicit flow puts token in #access_token=... (hash).
    // PKCE flow puts code in ?code=... (query string).
    // We capture this NOW — Supabase rewrites the URL during getSession().
    isOAuthLanding = (
        window.location.search.includes('code=') ||
        window.location.hash.includes('access_token=')
    );

    const sb = getSupabase();
    if (!sb) {
        console.warn('Supabase not available — auth features disabled.');
        updateAuthUI();
        return;
    }

    try {
        // ── Step 2: getSession() exchanges the OAuth token internally ──
        // After this call, window.location.hash will be cleaned by Supabase.
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            currentUser = session.user;
        }

        // ── Step 3: If this was an OAuth landing with a valid session, redirect NOW ──
        // We do this directly because SIGNED_IN may never fire on implicit flow —
        // Supabase fires INITIAL_SESSION instead when the token is already in the URL.
        if (isOAuthLanding && session) {
            isOAuthLanding = false;
            isAuthInitialized = true;
            updateAuthUI();
            setupAuthForms();
            navigateTo('dashboard');
            return;
        }

        // ── Step 4: Listen for future auth events (non-OAuth flows) ──
        sb.auth.onAuthStateChange((event, session) => {
            currentUser = session?.user || null;
            updateAuthUI();

            // Get the current page cleanly — strip any OAuth token fragments
            const currentPage = (window.location.hash || '#home')
                .replace('#', '')
                .split(/[?&#]/)[0];

            if (event === 'SIGNED_IN') {
                // Normal login flow (email/password clicked login button)
                if (['login', 'register', 'home', ''].includes(currentPage)) {
                    navigateTo('dashboard');
                }
            } else if (event === 'SIGNED_OUT') {
                if (['dashboard', 'profile', 'redeem', 'admin'].includes(currentPage)) {
                    navigateTo('home');
                }
            } else if (event === 'PASSWORD_RECOVERY') {
                navigateTo('reset-password');
                if (typeof showResetUpdateForm === 'function') showResetUpdateForm();
            }
            // INITIAL_SESSION and TOKEN_REFRESHED → ignored for routing.
        });
    } catch (e) {
        console.warn('Auth session check failed:', e);
    }

    isAuthInitialized = true;
    if (typeof handleRoute === 'function') handleRoute();
    updateAuthUI();
    setupAuthForms();
}

/**
 * Update UI based on auth state (navbar, hero CTA, etc.)
 */
function updateAuthUI() {
    const navAuthArea = document.getElementById('nav-auth-area');
    const navAdminLink = document.getElementById('nav-admin-link');
    const heroCta = document.getElementById('hero-cta-login');

    if (currentUser) {
        // ── Logged in ──
        if (navAuthArea) {
            const email = currentUser.email || '—';
            const initial = email.charAt(0).toUpperCase();

            navAuthArea.innerHTML = `
                <a href="#redeem" class="btn btn-ghost" style="padding:8px 16px; border:none;" id="nav-redeem-link">Códigos</a>
                <a href="#dashboard" class="btn btn-ghost" style="gap:6px; padding:8px 16px; border:none;" id="nav-dashboard-link">
                    <i data-lucide="layout-dashboard" style="width:16px;height:16px"></i>
                    Mi Cuenta
                </a>

                <div class="nav-avatar-wrap" id="nav-avatar-wrap">
                    <button class="nav-avatar-btn" id="nav-avatar-btn" aria-label="Menú de perfil">
                        ${initial}
                    </button>
                    <div class="nav-avatar-dropdown" id="nav-avatar-dropdown">
                        <div class="nav-dropdown-header">Mi Cuenta</div>
                        <a href="#profile" class="nav-dropdown-item" id="dd-profile">
                            <i data-lucide="user-circle"></i>
                            Mi Perfil
                        </a>
                        <a href="#dashboard" class="nav-dropdown-item" id="dd-dashboard">
                            <i data-lucide="layout-dashboard"></i>
                            Mi Cuenta
                        </a>
                        <a href="#redeem" class="nav-dropdown-item" id="dd-redeem">
                            <i data-lucide="ticket"></i>
                            Códigos
                        </a>
                        <div class="nav-dropdown-divider"></div>
                        <button class="nav-dropdown-item danger" id="dd-logout">
                            <i data-lucide="log-out"></i>
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            `;

            // Wire dropdown toggle
            const avatarBtn = document.getElementById('nav-avatar-btn');
            const dropdown = document.getElementById('nav-avatar-dropdown');
            if (avatarBtn && dropdown) {
                avatarBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('open');
                });
                // Close on outside click
                document.addEventListener('click', (e) => {
                    if (!document.getElementById('nav-avatar-wrap')?.contains(e.target)) {
                        dropdown.classList.remove('open');
                    }
                });
            }

            // Wire dropdown nav items
            ['dd-profile', 'dd-dashboard', 'dd-redeem', 'nav-redeem-link', 'nav-dashboard-link'].forEach(id => {
                document.getElementById(id)?.addEventListener('click', (e) => {
                    e.preventDefault();
                    const href = e.currentTarget.getAttribute('href');
                    if (href) navigateTo(href.replace('#', ''));
                    dropdown?.classList.remove('open');
                });
            });

            // Wire logout
            document.getElementById('dd-logout')?.addEventListener('click', () => {
                handleLogout();
            });

            if (window.lucide) lucide.createIcons();
        }


        // Check admin role (async — updates nav-admin-link when resolved)
        if (typeof checkAdminRole === 'function') checkAdminRole();

        if (heroCta) {
            heroCta.href = '#dashboard';
            heroCta.innerHTML = `
                <i data-lucide="layout-dashboard" style="width:20px;height:20px"></i>
                Mi Dashboard
            `;
        }

        // Populate dashboard data
        const email = currentUser.email || '—';
        const initial = email.charAt(0).toUpperCase();
        const createdAt = new Date(currentUser.created_at).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        setTextById('dash-avatar', initial);
        setTextById('dash-username', email.split('@')[0]);
        setTextById('dash-email', email);
        setTextById('dash-info-email', email);
        setTextById('dash-info-since', createdAt);

        // Read profile aesthetics
        const sb = getSupabase();
        if (sb) {
            sb.from('profiles').select('*').eq('id', currentUser.id).single().then(({ data }) => {
                if (data) {
                    if (data.username) {
                        setTextById('dash-username', data.username);
                        const pName = document.getElementById('profile-username');
                        if (pName && !pName.value) pName.value = data.username;
                    }

                    selectedAvatarId = data.avatar_id || 'default';
                    selectedFrameId = data.frame_id || 'default';

                    applyAestheticsToAvatar('dash-avatar', 'dash-frame-ring', selectedAvatarId, selectedFrameId, initial);
                    applyAestheticsToAvatar('profile-avatar-display', 'profile-frame-ring', selectedAvatarId, selectedFrameId, initial);
                }
            });

            // Populate token for games
            sb.auth.getSession().then(({ data }) => {
                if (data && data.session) {
                    const tokenInput = document.getElementById('game-access-token');
                    if (tokenInput) tokenInput.value = data.session.access_token;
                }
            });
        } else {
            applyAestheticsToAvatar('dash-avatar', 'dash-frame-ring', 'default', 'default', initial);
            applyAestheticsToAvatar('profile-avatar-display', 'profile-frame-ring', 'default', 'default', initial);
        }

        // Re-init modules that depend on auth
        if (typeof initProfile === 'function') initProfile();
        if (typeof initAdmin === 'function') initAdmin(); // async — updates admin panel when resolved

    } else {
        // ── Logged out ──
        if (navAuthArea) {
            navAuthArea.innerHTML = `
                <a href="#login" class="btn btn-ghost">Iniciar Sesión</a>
                <a href="#register" class="btn btn-primary">Registrarse</a>
            `;
        }
        // Hide admin
        if (navAdminLink) navAdminLink.style.display = 'none';

        if (heroCta) {
            heroCta.href = '#register';
            heroCta.innerHTML = `
                <i data-lucide="user-plus" style="width:20px;height:20px"></i>
                Crear Cuenta
            `;
        }
    }

    // Re-render Lucide icons for dynamically inserted DOM
    if (window.lucide) lucide.createIcons();
}

/** Helper to safely set text content */
function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/** Helper to apply avatar and frame visuals */
function applyAestheticsToAvatar(avatarElId, frameElId, avatarId, frameId, textFallback) {
    const avatarEl = document.getElementById(avatarElId);
    const frameEl = document.getElementById(frameElId);
    
    if (avatarEl) {
        if (avatarId === 'default' || !avatarId) {
            avatarEl.innerHTML = textFallback;
        } else {
            const aOpt = AVATAR_OPTIONS.find(a => a.id === avatarId);
            if (aOpt) {
                avatarEl.innerHTML = `<i data-lucide="${aOpt.icon}"></i>`;
                if (window.lucide) lucide.createIcons();
            } else {
                avatarEl.innerHTML = textFallback;
            }
        }
    }

    if (frameEl) {
        // Reset classes
        frameEl.className = 'profile-frame';
        const fOpt = FRAME_OPTIONS.find(f => f.id === frameId);
        if (fOpt && fOpt.id !== 'default') {
            frameEl.classList.add(fOpt.class);
        }
    }
}

/**
 * Set up all form event listeners
 */
function setupAuthForms() {
    // ── Toggle password visibility ──
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            const icon = btn.querySelector('i, svg');
            if (input.type === 'password') {
                input.type = 'text';
                if (icon) icon.setAttribute('data-lucide', 'eye-off');
            } else {
                input.type = 'password';
                if (icon) icon.setAttribute('data-lucide', 'eye');
            }
            lucide.createIcons();
        });
    });

    // ── Login ──
    document.getElementById('login-btn')?.addEventListener('click', handleLogin);
    document.getElementById('login-password')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleLogin();
    });

    // ── Register validation ──
    document.getElementById('reg-password')?.addEventListener('input', validateRegister);
    document.getElementById('reg-confirm')?.addEventListener('input', validateRegister);
    document.getElementById('register-btn')?.addEventListener('click', handleRegister);
    document.getElementById('reg-confirm')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleRegister();
    });

    // ── Reset password ──
    document.getElementById('reset-request-btn')?.addEventListener('click', handleResetRequest);
    document.getElementById('new-password')?.addEventListener('input', validateResetPassword);
    document.getElementById('confirm-new-password')?.addEventListener('input', validateResetPassword);
    document.getElementById('reset-update-btn')?.addEventListener('click', handleResetUpdate);

    // ── Social Login ──
    document.getElementById('discord-login-btn')?.addEventListener('click', handleDiscordLogin);
    document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);

    // ── Dashboard actions ──
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('dash-change-pass-btn')?.addEventListener('click', () => navigateTo('reset-password'));
    document.getElementById('dash-discord-link-btn')?.addEventListener('click', handleDiscordLink);

    document.getElementById('copy-token-btn')?.addEventListener('click', () => {
        const tokenInput = document.getElementById('game-access-token');
        if (tokenInput && tokenInput.value) {
            navigator.clipboard.writeText(tokenInput.value);
            const btn = document.getElementById('copy-token-btn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check" style="width:16px;height:16px"></i> Copiado!';
            if (window.lucide) lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                if (window.lucide) lucide.createIcons();
            }, 2000);
        }
    });
}

/* ─────────────────────────── HANDLERS ─────────────────────────── */

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const msgDiv = document.getElementById('login-message');

    if (!email || !password) {
        showFormMessage(msgDiv, 'Por favor completa todos los campos.', 'error');
        return;
    }

    const sb = getSupabase();
    if (!sb) { showFormMessage(msgDiv, 'El servicio de autenticación no está disponible.', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Ingresando...';

    try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Set user immediately and navigate — don't wait solely on onAuthStateChange
        if (data?.session?.user) {
            currentUser = data.session.user;
        }
        btn.textContent = 'Iniciar Sesión';
        btn.disabled = false;
        updateAuthUI();
        navigateTo('dashboard');
    } catch (err) {
        showFormMessage(msgDiv, 'Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Iniciar Sesión';
    }
}

async function handleRegister() {
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const btn = document.getElementById('register-btn');
    const msgDiv = document.getElementById('register-message');

    if (!email || !password) {
        showFormMessage(msgDiv, 'Por favor completa todos los campos.', 'error');
        return;
    }

    const sb = getSupabase();
    if (!sb) { showFormMessage(msgDiv, 'El servicio de autenticación no está disponible.', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creando cuenta...';

    try {
        const { error } = await sb.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin + window.location.pathname + '#dashboard'
            }
        });
        if (error) throw error;
        showFormMessage(msgDiv, '¡Cuenta creada! Revisa tu correo para confirmar.', 'success');
        btn.textContent = 'Crear Cuenta';
    } catch (err) {
        showFormMessage(msgDiv, 'Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Crear Cuenta';
    }
}

function validateRegister() {
    const pass = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const btn = document.getElementById('register-btn');

    const hasLength = pass.length >= 8;
    const hasNumber = /\d/.test(pass);
    const matches = pass === confirm && pass.length > 0;

    updateReqIcon('reg-req-length', hasLength);
    updateReqIcon('reg-req-number', hasNumber);
    updateReqIcon('reg-req-match', matches);

    if (btn) btn.disabled = !(hasLength && hasNumber && matches);
}

async function handleResetRequest() {
    const email = document.getElementById('reset-email').value.trim();
    const btn = document.getElementById('reset-request-btn');
    const msgDiv = document.getElementById('reset-message');

    if (!email) { showFormMessage(msgDiv, 'Ingresa tu correo electrónico.', 'error'); return; }

    const sb = getSupabase();
    if (!sb) { showFormMessage(msgDiv, 'Servicio no disponible.', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Enviando...';

    try {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname + '#reset-password'
        });
        if (error) throw error;
        showFormMessage(msgDiv, '¡Enlace enviado! Revisa tu bandeja de entrada.', 'success');
        btn.textContent = 'Enlace Enviado';
    } catch (err) {
        showFormMessage(msgDiv, 'Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Enviar Enlace';
    }
}

function showResetUpdateForm() {
    const reqForm = document.getElementById('reset-request-form');
    const updForm = document.getElementById('reset-update-form');
    if (reqForm) reqForm.style.display = 'none';
    if (updForm) updForm.style.display = 'block';
}

async function handleResetUpdate() {
    const password = document.getElementById('new-password').value;
    const btn = document.getElementById('reset-update-btn');
    const msgDiv = document.getElementById('reset-update-message');

    const sb = getSupabase();
    if (!sb) { showFormMessage(msgDiv, 'Servicio no disponible.', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Procesando...';

    try {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        document.getElementById('reset-update-form').style.display = 'none';
        document.getElementById('reset-success').style.display = 'block';
    } catch (err) {
        showFormMessage(msgDiv, 'Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Actualizar Contraseña';
    }
}

function validateResetPassword() {
    const pass = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-new-password').value;
    const btn = document.getElementById('reset-update-btn');

    const hasLength = pass.length >= 8;
    const hasNumber = /\d/.test(pass);
    const matches = pass === confirm && pass.length > 0;

    updateReqIcon('reset-req-length', hasLength);
    updateReqIcon('reset-req-number', hasNumber);
    updateReqIcon('reset-req-match', matches);

    if (btn) btn.disabled = !(hasLength && hasNumber && matches);
}

async function handleDiscordLogin() {
    const sb = getSupabase();
    if (!sb) return;
    try {
        const { error } = await sb.auth.signInWithOAuth({
            provider: 'discord',
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
    } catch (err) {
        const msgDiv = document.getElementById('login-message');
        showFormMessage(msgDiv, 'Error al conectar con Discord: ' + err.message, 'error');
    }
}

async function handleGoogleLogin() {
    const sb = getSupabase();
    if (!sb) return;
    try {
        const { error } = await sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
    } catch (err) {
        const msgDiv = document.getElementById('login-message');
        showFormMessage(msgDiv, 'Error al conectar con Google: ' + err.message, 'error');
    }
}

function handleDiscordLink() {
    const statusEl = document.getElementById('discord-link-status');
    if (!statusEl) return;

    // Check for auth code in URL (returned from Discord OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const authCode = urlParams.get('code') || hashParams.get('access_token');

    if (authCode) {
        statusEl.textContent = 'Sincronizando con el cliente del juego...';
        statusEl.style.color = 'var(--accent-cyan)';

        const img = new Image();
        img.onload = () => {
            statusEl.textContent = '✅ ¡Cuenta vinculada con el juego!';
            statusEl.style.color = 'var(--accent-green)';
        };
        img.onerror = () => {
            statusEl.textContent = '✅ Transmisión enviada al juego.';
            statusEl.style.color = 'var(--accent-green)';
        };
        img.src = `http://127.0.0.1:8080/auth?code=${authCode}`;
    } else {
        statusEl.textContent = 'ℹ️ Inicia el juego y usa el botón "Vincular Discord" desde ahí para recibir el código.';
        statusEl.style.color = 'var(--accent-gold)';
    }
}

async function handleLogout() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    currentUser = null;
    updateAuthUI();
    navigateTo('home');
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

function showFormMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'form-message visible ' + (type === 'error' ? 'error' : 'success');
}

function updateReqIcon(id, isValid) {
    const el = document.getElementById(id);
    if (!el) return;
    const icon = el.querySelector('i, svg');
    if (!icon) return;

    if (isValid) {
        el.classList.add('valid');
        icon.setAttribute('data-lucide', 'check-circle-2');
    } else {
        el.classList.remove('valid');
        icon.setAttribute('data-lucide', 'circle-dashed');
    }
    lucide.createIcons();
}
