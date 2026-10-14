/* ══════════════════════════════════════════════════════════
   SHARED LAYOUT — top bar + site footer

   Injects the navigation into #siteHeader and the footer into
   #siteFooter. Pages without those placeholders (eventsh, the
   in-game helper window) get no chrome — only the i18n pass.

   The ONLY variation handled here is logged-in vs logged-out.
   Everything else (links, icons, order) is identical on every
   page by construction.
══════════════════════════════════════════════════════════ */

// ── Single source of truth for the invite. Global so pages can link to
//    it without repeating the URL. ──
var MU_DISCORD_URL = 'https://discord.gg/your-invite';

// ── Global logout, used by the injected button ──
function doLogout() {
    sessionStorage.removeItem('mu_auth');
    sessionStorage.removeItem('mu_user');
    window.location.href = '/login';
}

// ── Apply translations to the whole document ──
function applyTranslations(lang) {
    var t = (window.muTranslations && (window.muTranslations[lang] || window.muTranslations.en)) || {};

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
        var key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        var key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });
    // Tooltips need translating too — data-i18n only ever touches textContent.
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
        var key = el.getAttribute('data-i18n-title');
        if (t[key]) el.title = t[key];
    });

    var en = document.getElementById('en-btn');
    var pt = document.getElementById('pt-btn');
    if (en) en.classList.toggle('active', lang === 'en');
    if (pt) pt.classList.toggle('active', lang === 'pt');

    document.documentElement.lang = lang;
}

// ── Default language switcher. Pages that also need to re-render
//    their own dynamic content override this after layout.js runs. ──
function setLanguage(lang) {
    localStorage.setItem('preferred-lang', lang);
    applyTranslations(lang);

    var c = window.muContent && (window.muContent[lang] || window.muContent.en);
    var dl = document.getElementById('downloadNavBtn');
    if (c && dl) dl.href = c.downloadUrl;
}

(function () {
    var DISCORD_URL = MU_DISCORD_URL;

    var lang       = localStorage.getItem('preferred-lang') || 'en';
    var isLoggedIn = !!sessionStorage.getItem('mu_auth');
    var path       = location.pathname.replace(/\/+$/, '') || '/';
    var isHome     = path === '/';

    // Only decides whether the administration link is shown - every administration request is
    // checked by the API itself, so a player who edits this value gets nothing but a refusal.
    var isAdmin = false;
    try {
        isAdmin = isLoggedIn && (JSON.parse(sessionStorage.getItem('mu_user') || '{}').state === 'Administrator');
    } catch (e) {}

    var dict    = (window.muTranslations && (window.muTranslations[lang] || window.muTranslations.en)) || {};
    var content = (window.muContent && (window.muContent[lang] || window.muContent.en)) || {};

    function t(key, fallback) { return dict[key] || fallback; }

    // ── Builders ──────────────────────────────────────────
    function navItem(href, icon, key, fallback) {
        var cls = 'nav-item' + (path === href ? ' nav-active' : '');
        return '<a href="' + href + '" class="' + cls + '">' +
                   '<i class="' + icon + '"></i>' +
                   '<span data-i18n="' + key + '">' + t(key, fallback) + '</span>' +
               '</a>';
    }

    function dropItem(href, icon, key, fallback, subKey, subFallback, extra) {
        return '<a href="' + href + '" class="dropdown-item"' + (extra || '') + '>' +
                   '<i class="' + icon + '"></i>' +
                   '<div class="dropdown-item-text">' +
                       '<strong data-i18n="' + key + '">' + t(key, fallback) + '</strong>' +
                       '<small data-i18n="' + subKey + '">' + t(subKey, subFallback) + '</small>' +
                   '</div>' +
               '</a>';
    }

    function dropdown(icon, key, fallback, children, ownedPaths) {
        var isActive = ownedPaths.indexOf(path) !== -1;
        // The caret sits inside the label wrapper so the nav item keeps a
        // single flex child (.nav-item is flex-direction: column).
        return '<div class="nav-item nav-dropdown' + (isActive ? ' nav-active' : '') + '">' +
                   '<i class="' + icon + '"></i>' +
                   '<span class="nav-label">' +
                       '<span data-i18n="' + key + '">' + t(key, fallback) + '</span>' +
                       '<i class="fa-solid fa-caret-down nav-caret"></i>' +
                   '</span>' +
                   '<div class="dropdown-panel">' + children + '</div>' +
               '</div>';
    }

    function footerLink(href, key, fallback) {
        return '<a href="' + href + '" class="nav-link">' +
                   '<span data-i18n="' + key + '">' + t(key, fallback) + '</span>' +
               '</a>';
    }

    // ── Account dropdown — the one logged-in/out variation ──
    var accountChildren = isLoggedIn
        ? dropItem('/account', 'fa-solid fa-user', 'navMyAccount', 'My Account',
                   'navMyAccountSub', 'View your characters & vault') +
          '<div class="dropdown-sep"></div>' +
          dropItem('/changepass', 'fa-solid fa-key', 'navChangePass', 'Change Password',
                   'navChangePassSub', 'Update your credentials') +
          (isAdmin
              ? '<div class="dropdown-sep"></div>' +
                dropItem('/shop-admin', 'fa-solid fa-screwdriver-wrench', 'navShopAdmin', 'Shop Admin',
                         'navShopAdminSub', 'Packages, orders and refunds')
              : '')
        : dropItem('/login', 'fa-solid fa-right-to-bracket', 'navLogin', 'Login',
                   'navLoginSub', 'Access your account') +
          dropItem('/register', 'fa-solid fa-user-plus', 'navRegister', 'Register',
                   'navRegisterSub', 'Create a new account') +
          dropItem('/changepass', 'fa-solid fa-key', 'navChangePass', 'Change Password',
                   'navChangePassSub', 'Update your credentials');

    var infoChildren =
        dropItem((isHome ? '' : '/') + '#ratesStrip', 'fa-solid fa-server',
                 'infoServerInfo', 'Server Info', 'infoServerInfoSub', 'Rates and version') +
        dropItem('/rules', 'fa-solid fa-scroll', 'infoRules', 'Server Rules',
                 'infoRulesSub', 'Rules and policies') +
        dropItem(DISCORD_URL, 'fa-brands fa-discord', 'infoDiscord', 'Discord',
                 'infoDiscordSub', 'Join our community', ' target="_blank" rel="noopener"') +
        dropItem('/bugreport', 'fa-solid fa-bug', 'infoBug', 'Report a Bug',
                 'infoBugSub', 'Help us improve');

    // Language dropdown. Options keep the <code>-btn ids because page
    // scripts toggle their "active" class directly.
    var LANGS = [
        { code: 'en', name: 'English' },
        { code: 'pt', name: 'Português' },
    ].filter(function (l) { return window.muTranslations && window.muTranslations[l.code]; });

    var langSwitch =
        '<div class="lang-select" id="langSelect">' +
            '<button type="button" class="lang-btn" id="langBtn" aria-haspopup="true" aria-expanded="false">' +
                '<i class="fa-solid fa-globe"></i>' +
                '<span id="langCurrent">' + lang.toUpperCase() + '</span>' +
                '<i class="fa-solid fa-chevron-down lang-caret"></i>' +
            '</button>' +
            '<div class="lang-panel" role="menu">' +
                LANGS.map(function (l) {
                    return '<button type="button" role="menuitem" id="' + l.code + '-btn" data-lang="' + l.code + '"' +
                               (l.code === lang ? ' class="active"' : '') + '>' +
                               '<span class="lang-code">' + l.code.toUpperCase() + '</span>' +
                               '<span class="lang-name">' + l.name + '</span>' +
                               '<i class="fa-solid fa-check lang-check"></i>' +
                           '</button>';
                }).join('') +
            '</div>' +
        '</div>';

    var logoutBtn = isLoggedIn
        ? '<button class="btn-logout" onclick="doLogout()">' +
              '<i class="fa-solid fa-right-from-bracket"></i>' +
              '<span data-i18n="logout">' + t('logout', 'Logout') + '</span>' +
          '</button>'
        : '';

    var authBtns = isLoggedIn
        ? ''
        : '<a href="/login" class="auth-btn auth-login' + (path === '/login' ? ' current' : '') + '" data-i18n-title="navLogin" title="' + t('navLogin', 'Login') + '">' +
              '<i class="fa-solid fa-right-to-bracket"></i>' +
              '<span data-i18n="navLogin">' + t('navLogin', 'Login') + '</span>' +
          '</a>' +
          '<a href="/register" class="auth-btn auth-play' + (path === '/register' ? ' current' : '') + '" data-i18n-title="navSignUp" title="' + t('navSignUp', 'Sign Up') + '">' +
              '<i class="fa-solid fa-user-plus"></i>' +
              '<span data-i18n="navSignUp">' + t('navSignUp', 'Sign Up') + '</span>' +
          '</a>';

    // Hidden on desktop by CSS; the only control for the nav on phones.
    var navToggle =
        '<button type="button" class="nav-toggle" id="navToggle" ' +
                'aria-controls="topNav" aria-expanded="false" aria-label="' + t('navMenu', 'Menu') + '">' +
            '<i class="fa-solid fa-bars"></i>' +
        '</button>';

    // ── Top bar ───────────────────────────────────────────
    var header =
        '<header class="top-bar">' +
            '<a href="/" class="top-logo" title="Home"><img src="images/logo.png" alt="Mu Nightmare"></a>' +
            '<nav class="top-nav" id="topNav">' +
                navItem('/', 'fa-solid fa-house', 'navHome', 'Home') +
                '<a href="' + (content.downloadUrl || '#') + '" id="downloadNavBtn" ' +
                    'class="nav-item nav-download" target="_blank" rel="noopener">' +
                    '<i class="fa-solid fa-download"></i>' +
                    '<span data-i18n="navDownload">' + t('navDownload', 'Download') + '</span>' +
                '</a>' +
                dropdown('fa-solid fa-user-shield', 'navAccount', 'Account', accountChildren,
                         ['/login', '/register', '/changepass', '/account', '/shop-admin']) +
                navItem('/stats', 'fa-solid fa-trophy', 'navStats', 'Rankings') +
                navItem('/events', 'fa-solid fa-calendar-days', 'navEvents', 'Events') +
                navItem('/shop', 'fa-solid fa-skull', 'navShop', 'Nightmare Shop') +
                navItem('/marketplace', 'fa-solid fa-store', 'navMarketplace', 'Marketplace') +
                dropdown('fa-solid fa-circle-info', 'navInfo', 'Info', infoChildren,
                         ['/rules', '/bugreport']) +
            '</nav>' +
            '<div class="top-right">' + authBtns + logoutBtn + langSwitch + '</div>' +
            navToggle +
        '</header>';

    // ── Site footer ───────────────────────────────────────
    var footer =
        '<footer class="site-footer">' +
            '<nav class="footer-nav">' +
                footerLink('/', 'navHome', 'Home') +
                (isLoggedIn
                    ? footerLink('/account', 'navMyAccount', 'My Account')
                    : footerLink('/login', 'navLogin', 'Login') +
                      footerLink('/register', 'navRegister', 'Register')) +
                footerLink('/stats', 'navStats', 'Rankings') +
                footerLink('/events', 'navEvents', 'Events') +
                footerLink('/shop', 'navShop', 'Nightmare Shop') +
                footerLink('/marketplace', 'navMarketplace', 'Marketplace') +
                footerLink('/rules', 'infoRules', 'Server Rules') +
            '</nav>' +
        '</footer>';

    var headerSlot = document.getElementById('siteHeader');
    var footerSlot = document.getElementById('siteFooter');
    if (headerSlot) headerSlot.outerHTML = header;
    if (footerSlot) footerSlot.outerHTML = footer;

    // ── Mobile drawer ─────────────────────────────────────
    var toggle = document.getElementById('navToggle');
    var topBar = document.querySelector('.top-bar');

    if (toggle && topBar) {
        toggle.addEventListener('click', function () {
            var open = topBar.classList.toggle('nav-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
        });

        // Following a link inside the drawer navigates away on real pages,
        // but same-page anchors (#ratesStrip) would leave it hanging open.
        topBar.querySelectorAll('.top-nav a').forEach(function (a) {
            a.addEventListener('click', function () {
                topBar.classList.remove('nav-open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.querySelector('i').className = 'fa-solid fa-bars';
            });
        });
    }

    // ── Language dropdown ─────────────────────────────────
    var langSelect = document.getElementById('langSelect');
    var langBtn    = document.getElementById('langBtn');

    function setLangOpen(open) {
        langSelect.classList.toggle('open', open);
        langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    if (langSelect && langBtn) {
        langBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            setLangOpen(!langSelect.classList.contains('open'));
        });

        langSelect.querySelectorAll('[data-lang]').forEach(function (opt) {
            opt.addEventListener('click', function () {
                var code = opt.getAttribute('data-lang');
                // Resolved at click time: pages may override setLanguage.
                window.setLanguage(code);
                document.getElementById('langCurrent').textContent = code.toUpperCase();
                setLangOpen(false);
            });
        });

        document.addEventListener('click', function (e) {
            if (!langSelect.contains(e.target)) setLangOpen(false);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setLangOpen(false);
        });
    }

    applyTranslations(lang);
})();
