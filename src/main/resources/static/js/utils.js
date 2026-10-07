// ====================================
// Konstanten
// ====================================

const AVATAR_COLORS = [
    '#004178', '#E1001A', '#2563eb', '#16a34a',
    '#9333ea', '#ea580c', '#0891b2', '#be185d',
    '#854d0e', '#166534'
];

const ROLE_COLORS = {
    DEVELOPER:     '#004178',
    TESTER:        '#16a34a',
    PRODUCT_OWNER: '#9333ea',
    MODERATOR:     '#004178',
    IT_ARCHITECT: '#0891b2'
};

// Wert der Skip-Karte – muss zu den Decks in EstimationMethod passen
const SKIP_CARD = '-';

// Anzeige-Reihenfolge aller Kartenwerte; Skip steht immer am Ende
const CARD_ORDER = ['?', '☕', '0', '0.5', '1', '2', '3', '4', '5', '8',
    '13', '16', '20', '21', '32', '40', '64', '100',
    'XS', 'S', 'M', 'L', 'XL', 'XXL', SKIP_CARD];

function compareCardValues(a, b) {
    const ai = CARD_ORDER.indexOf(a);
    const bi = CARD_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    return String(a).localeCompare(String(b));
}

// ====================================
// Basis-Pfad
// ====================================

/**
 * Baut eine URL relativ zum Context-Path der Anwendung.
 * globalThis.APP_BASE wird im Template via Thymeleaf (@{/}) gesetzt.
 *
 * @param {string} [path] - Pfad ab dem App-Root, z.B. '/api/sessions'
 * @returns {string} vollstaendiger Pfad inkl. Context-Path
 */
function appUrl(path = '') {
    const base = String(globalThis.APP_BASE || '/').replace(/\/+$/, '');
    if (!path) return base + '/';
    return base + (path.startsWith('/') ? path : '/' + path);
}

// ====================================
// Browser-Kennung
// ====================================

/** Stabile Kennung dieses Browsers, damit ein Reload denselben Teilnehmer wiederfindet. */
function getBrowserId() {
    try {
        let id = localStorage.getItem('browserId');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('browserId', id);
        }
        return id;
    } catch (e) {
        return 'fallback-' + Math.random().toString(36).substring(2);
    }
}

// ====================================
// Teilnehmer-Token
// ====================================

function getParticipantToken() {
    return sessionStorage.getItem('participantToken') || '';
}

/** Header für REST-Aufrufe, die eine Teilnehmer-Identität brauchen. */
function authHeaders() {
    return { 'X-Participant-Token': getParticipantToken() };
}

/**
 * Sendet eine STOMP-Nachricht an den Raum, inkl. Teilnehmer-Token.
 *
 * @param {string} path - Ziel ab dem Raum, z.B. '/vote'
 * @param {object} [body] - Nutzdaten
 */
function sendWs(path, body = {}) {
    stompClient.send('/app/session/' + roomCode + path,
        { 'participant-token': getParticipantToken() },
        JSON.stringify(body));
}

// ====================================
// Hilfsfunktionen
// ====================================

function getRoleLabel(role) {
    if (globalThis.i18n?.roles?.[role]) return globalThis.i18n.roles[role];
    const labels = {
        DEVELOPER:     'Entwickler',
        TESTER:        'Tester',
        PRODUCT_OWNER: 'Product Owner',
        MODERATOR:     'Moderator',
        IT_ARCHITECT: 'IT-Architekt'
    };
    return labels[role] || '';
}

function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.codePointAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatNumber(value) {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replaceAll('&',  '&amp;')
        .replaceAll('<',  '&lt;')
        .replaceAll('>',  '&gt;')
        .replaceAll('"',  '&quot;')
        .replaceAll("'",  '&#x27;');
}

// ====================================
// Toast Notification System
// ====================================

/**
 * Eigener Bestätigungsdialog (#confirmModal) statt Browser-confirm().
 * Esc, Klick neben den Dialog oder "Abbrechen" schließen ohne Aktion.
 *
 * @param {string}   message      - Frage im Dialog
 * @param {string}   confirmLabel - Beschriftung des Bestätigen-Buttons
 * @param {Function} onConfirm    - wird nach Bestätigung ausgeführt
 */
function showConfirm(message, confirmLabel, onConfirm) {
    const modal  = document.getElementById('confirmModal');
    const ok     = document.getElementById('confirmModalOk');
    const cancel = document.getElementById('confirmModalCancel');
    if (!modal || !ok || !cancel) return;

    const previousFocus = document.activeElement;
    document.getElementById('confirmModalText').textContent = message;
    ok.textContent = confirmLabel;

    const close = () => {
        modal.style.display = 'none';
        document.removeEventListener('keydown', onKey);
        previousFocus?.focus?.();
    };
    const onKey = e => { if (e.key === 'Escape') close(); };

    ok.onclick     = () => { close(); onConfirm(); };
    cancel.onclick = close;
    modal.onclick  = e => { if (e.target === modal) close(); };
    document.addEventListener('keydown', onKey);

    modal.style.display = 'flex';
    cancel.focus();
}

/**
 * @param {string} message   - Haupttext der Benachrichtigung
 * @param {'success'|'error'|'warning'|'info'} type - Typ (Standard: 'info')
 * @param {string} [sub]     - Optionaler Untertext
 * @param {number} [duration]- Anzeigedauer in ms (Standard: 3500, 0 = kein Auto-close)
 */
function showToast(message, type = 'info', sub = '', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = {
        success: '✓',
        error:   '!',
        warning: '⚠',
        info:    'i'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    if (type === 'error') {
        toast.setAttribute('role', 'alert');
        container.setAttribute('aria-live', 'assertive');
    } else {
        container.setAttribute('aria-live', 'polite');
    }
    toast.innerHTML = `
        <div class="toast__icon" aria-hidden="true">${icons[type] || 'i'}</div>
        <div class="toast__body">
            <span class="toast__msg">${escapeHtml(message)}</span>
            ${sub ? `<span class="toast__sub">${escapeHtml(sub)}</span>` : ''}
        </div>
        <button class="toast__close" aria-label="Schließen">✕</button>
    `;

    const dismiss = () => {
        toast.classList.add('toast--out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        }, { once: true });
    };

    toast.querySelector('.toast__close').addEventListener('click', dismiss);

    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(dismiss, duration);
    }

    return toast;
}