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