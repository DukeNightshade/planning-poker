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
    MODERATOR:     '#004178'
};

// ====================================
// Hilfsfunktionen
// ====================================

function getRoleLabel(role) {
    if (window.i18n?.roles?.[role]) return window.i18n.roles[role];
    const labels = {
        DEVELOPER:     'Entwickler',
        TESTER:        'Tester',
        PRODUCT_OWNER: 'Product Owner',
        MODERATOR:     'Moderator'
    };
    return labels[role] || '';
}

function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatNumber(value) {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#x27;');
}

// ====================================
// Toast Notification System
// ====================================

/**
 * Zeigt eine Toast-Benachrichtigung oben rechts an.
 *
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