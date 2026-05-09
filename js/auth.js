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
    const sb = getSupabase();
    if (!sb) {
        console.warn('Supabase not available — auth features disabled.');
        updateAuthUI();
        return;
    }

    try {
        // Check for existing session
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            currentUser = session.user;
        }

        // Listen for auth state changes
        sb.auth.onAuthStateChange((event, session) => {
            currentUser = session?.user || null;
            updateAuthUI();

            if (event === 'SIGNED_IN') {
                navigateTo('dashboard');
            } else if (event === 'SIGNED_OUT') {
                navigateTo('home');
            } else if (event === 'PASSWORD_RECOVERY') {
                navigateTo('reset-password');
                showResetUpdateForm();
            }
        });
    } catch (e) {
        console.warn('Auth session check failed:', e);
    }

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
            navAuthArea.innerHTML = `
                <a href="#profile" class="btn btn-ghost" style="padding:8px 16px; border:none;">Perfil</a>
                <a href="#redeem" class="btn btn-ghost" style="padding:8px 16px; border:none;">Códigos</a>
                <a href="#dashboard" class="btn btn-ghost" style="gap:6px">
                    <i data-lucide="user" style="width:16px;height:16px"></i>
                    Mi Cuenta
                </a>
            `;
            // Call changePage handlers on new links
            navAuthArea.querySelectorAll('a').forEach(a => {
                a.addEventListener('click', e => {
                    e.preventDefault();
                    if (typeof changePage === 'function') changePage(e);
                });
            });
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

        // Profile avatar
        setTextById('profile-avatar-display', initial);
        const profileEmail = document.getElementById('profile-email');
        if (profileEmail) profileEmail.value = email;
        const profileUsername = document.getElementById('profile-username');
        if (profileUsername && !profileUsername.value) profileUsername.value = email.split('@')[0];

        // Populate token for games
        const sb = getSupabase();
        if (sb) {
            sb.auth.getSession().then(({ data }) => {
                if (data && data.session) {
                    const tokenInput = document.getElementById('game-access-token');
                    if (tokenInput) tokenInput.value = data.session.access_token;
                }
            });
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
            options: { redirectTo: window.location.origin + window.location.pathname + '#dashboard' }
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
            options: { redirectTo: window.location.origin + window.location.pathname + '#dashboard' }
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
