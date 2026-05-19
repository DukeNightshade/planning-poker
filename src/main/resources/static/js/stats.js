// ====================================
// Statistik-Berechnung
// ====================================

/**
 * Berechnet Durchschnitt und Spread getrennt für Entwickler und Tester
 * sowie Gesamtdurchschnitt aller Rollen.
 */
function recalculateStats() {
    const devVotes   = extractNumericVotes('DEVELOPER');
    const testerVotes = extractNumericVotes('TESTER');
    const allVotes   = [...devVotes, ...testerVotes];

    return {
        devAvg:      average(devVotes),
        testerAvg:   average(testerVotes),
        devSpread:   spread(devVotes),
        testerSpread: spread(testerVotes),
        overallAvg:  average(allVotes)
    };
}

// ====================================
// Interne Hilfsfunktionen
// ====================================

function extractNumericVotes(role) {
    return Object.values(players)
        .filter(p => p.role === role && p.cardValue)
        .map(p => parseFloat(p.cardValue))
        .filter(v => !isNaN(v));
}

function average(votes) {
    if (votes.length === 0) return null;
    return formatNumber(votes.reduce((a, b) => a + b, 0) / votes.length);
}

function spread(votes) {
    if (votes.length < 2) return null;
    return formatNumber(Math.max(...votes) - Math.min(...votes));
}