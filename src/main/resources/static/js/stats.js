// ====================================
// Statistik-Berechnung
// ====================================

function recalculateStats() {
    const devVotes       = extractNumericVotes('DEVELOPER');
    const testerVotes    = extractNumericVotes('TESTER');
    const architectVotes = extractNumericVotes('IT_ARCHITECT');
    const allVotes       = [...devVotes, ...testerVotes, ...architectVotes];

    return {
        devAvg:          average(devVotes),
        testerAvg:       average(testerVotes),
        architectAvg:    average(architectVotes),
        devSpread:       spread(devVotes),
        testerSpread:    spread(testerVotes),
        architectSpread: spread(architectVotes),
        overallAvg:      average(allVotes)
    };
}

/**
 * Verteilung der aufgedeckten Karten, anonym und in Deck-Reihenfolge.
 * "mostCommon" ist leer, wenn kein Wert öfter als einmal gewählt wurde
 * (dann gibt es nichts hervorzuheben). Skip zählt nicht mit.
 *
 * @returns {{ stacks: {value: string, count: number}[], mostCommon: string[] }}
 */
function voteDistribution() {
    const counts = new Map();
    Object.values(players)
        .filter(p => p.cardValue)
        .forEach(p => counts.set(p.cardValue, (counts.get(p.cardValue) || 0) + 1));

    const stacks = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => compareCardValues(a.value, b.value));

    const counted = stacks.filter(s => s.value !== SKIP_CARD);
    const max     = Math.max(0, ...counted.map(s => s.count));
    const mostCommon = max > 1
        ? counted.filter(s => s.count === max).map(s => s.value)
        : [];

    return { stacks, mostCommon };
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