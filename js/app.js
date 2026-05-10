/* ============================================================
   Game of Champions — SPA Router & App Shell
   Hash-based navigation with auth-aware routing
   ============================================================ */

// ── All section IDs that map to hash routes ──
const SECTIONS  = ['home', 'login', 'register', 'reset-password', 'devlog', 'downloads', 'dashboard', 'profile', 'redeem', 'admin'];
const PROTECTED = ['dashboard', 'profile', 'redeem', 'admin'];
const AUTH_ONLY = ['login', 'register'];

/**
 * Navigate to a section by changing the hash
 */
function navigateTo(sectionId) {
    window.location.hash = sectionId;
}

/**
 * Core router — read the hash, show the right section
 */
function handleRoute() {
    let hash = (window.location.hash || '#home').replace('#', '');
    console.log('[Router] -> handleRoute processing:', hash);

    // Let Supabase silently handle callback tokens
    if (hash.includes('access_token') || hash.includes('type=recovery')) {
        console.log('[Router] -> Yielding routing to Supabase for token injection.');
        return;
    }

    // Strip query-string noise
    hash = hash.split('?')[0].split('&')[0];

    // Fallback to home for unknown hashes
    if (!SECTIONS.includes(hash)) hash = 'home';

    // Auth guards (only if auth module is loaded)
    if (typeof currentUser !== 'undefined') {
        const initialized = typeof isAuthInitialized !== 'undefined' ? isAuthInitialized : true;
        
        if (PROTECTED.includes(hash)) {
            if (!initialized) return; // Wait until auth fully loads before redirecting
            if (!currentUser) {
                hash = 'login';
                window.location.hash = hash;
                return;
            }
        }
        if (AUTH_ONLY.includes(hash)) {
            if (!initialized) return; // Wait to see if we should skip login
            if (currentUser) {
                hash = 'dashboard';
                window.location.hash = hash;
                return;
            }
        }
    }

    // Toggle sections
    SECTIONS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === hash);
    });

    // Highlight active nav link
    document.querySelectorAll('[data-nav]').forEach(link => {
        const isActive = link.getAttribute('href') === '#' + hash;
        link.classList.toggle('active', isActive);
    });

    // Close mobile nav if open
    const navLinks = document.getElementById('nav-links');
    if (navLinks) navLinks.classList.remove('open');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Refresh icons that might have been added dynamically
    if (window.lucide) lucide.createIcons();
}

/**
 * Boot the whole app
 */
function initApp() {
    // Render Lucide icons already in the HTML
    if (window.lucide) lucide.createIcons();

    // ── Start the router FIRST (doesn't depend on auth) ──
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    // ── Then init auth (async, non-blocking) ──
    if (typeof initAuth === 'function') {
        initAuth().catch(err => console.warn('Auth init error:', err));
    }

    // ── Devlog ──
    if (typeof initDevlog === 'function') {
        initDevlog();
    }

    // ── Admin Module ──
    if (typeof initAdmin === 'function') {
        initAdmin();
    }

    // ── Profile ──
    if (typeof initProfile === 'function') {
        initProfile();
    }

    // ── Redeem ──
    if (typeof initRedeem === 'function') {
        initRedeem();
    }

    // ── Navbar scroll effect ──
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar?.classList.toggle('scrolled', window.scrollY > 20);
    });

    // ── Mobile hamburger toggle ──
    const navToggle = document.getElementById('nav-toggle');
    const navLinks  = document.getElementById('nav-links');
    navToggle?.addEventListener('click', () => navLinks?.classList.toggle('open'));

    // Close mobile nav when a link is tapped
    navLinks?.querySelectorAll('a').forEach(a =>
        a.addEventListener('click', () => navLinks.classList.remove('open'))
    );

    // ── Global click handler for all hash links (SPA routing) ──
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (link) {
            e.preventDefault();
            window.location.hash = link.getAttribute('href');
        }
    });

    // ── Particle background ──
    initParticles();
}

/* ─────────────────────────── PARTICLES ─────────────────────────── */

function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0.4';
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let particles = [];

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        createParticles();
    }

    function createParticles() {
        const count = Math.min(Math.floor((canvas.width * canvas.height) / 25000), 60);
        particles = Array.from({ length: count }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size:    Math.random() * 1.5 + 0.5,
            speedX:  (Math.random() - 0.5) * 0.3,
            speedY:  (Math.random() - 0.5) * 0.3,
            opacity: Math.random() * 0.5 + 0.1
        }));
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,242,255,${p.opacity})`;
            ctx.fill();

            p.x += p.speedX;
            p.y += p.speedY;
            if (p.x < 0) p.x = canvas.width;  if (p.x > canvas.width)  p.x = 0;
            if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        }

        // Subtle connecting lines
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0,242,255,${0.06 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', initApp);
