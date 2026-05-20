// ====================================
// Statistik-Berechnung
// ====================================

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
        .map(p => Number.parseFloat(p.cardValue))
        .filter(v => !Number.isNaN(v));
}

function average(votes) {
    if (votes.length === 0) return null;
    return formatNumber(votes.reduce((a, b) => a + b, 0) / votes.length);
}

function spread(votes) {
    if (votes.length < 2) return null;
    return formatNumber(Math.max(...votes) - Math.min(...votes));
}