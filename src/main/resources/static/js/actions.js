// ====================================
// Kartenwahl
// ====================================

function selectCard(button) {
    if (participantRole === 'PRODUCT_OWNER') return;

    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    selectedCard = button.dataset.value;

    const isDiscussion = isRevealed;

    if (players[participantId]) {
        if (isDiscussion && players[participantId].originalCardValue) {
            players[participantId].changed =
                selectedCard !== players[participantId].originalCardValue;
        }
        players[participantId].voted     = true;
        players[participantId].cardValue = selectedCard;
    }

    if (isDiscussion) {
        const stats = recalculateStats();
        averageValue = stats.overallAvg;
    }

    renderTable();
    renderSidebar();

    stompClient.send('/app/session/' + roomCode + '/vote', {},
        JSON.stringify({ participantId, cardValue: selectedCard, isDiscussion }));
}

// ====================================
// Moderator-Aktionen
// ====================================

function revealCards() {
    document.querySelectorAll('#pokerTable rect').forEach(card => {
        if (card.getAttribute('id')?.startsWith('card-')) {
            card.style.transition    = 'transform 0.25s ease-in';
            card.style.transformBox  = 'fill-box';
            card.style.transformOrigin = 'center';
            card.style.transform     = 'scaleX(0)';
        }
    });
    setTimeout(() => {
        stompClient.send('/app/session/' + roomCode + '/reveal', {}, {});
    }, 250);
}

function resetRound() {
    stompClient.send('/app/session/' + roomCode + '/reset', {}, {});
}

// ====================================
// Ergebnisse & Reset
// ====================================

function showResults(votes) {
    isRevealed = true;

    votes.forEach(vote => {
        const id = Object.keys(players).find(k => players[k].name === vote.participantName);
        if (id) {
            players[id].cardValue         = vote.cardValue;
            players[id].originalCardValue = vote.cardValue;
            players[id].role              = vote.participantRole || players[id].role;
            players[id].voted             = true;
            players[id].changed           = false;
        }
    });

    const stats  = recalculateStats();
    averageValue = stats.overallAvg;

    if (currentTicketId && tickets[currentTicketId]) {
        tickets[currentTicketId].status = 'VOTED';
        const parts = [];
        if (stats.devAvg)    parts.push(`Dev ${stats.devAvg}`);
        if (stats.testerAvg) parts.push(`Test ${stats.testerAvg}`);
        tickets[currentTicketId].finalEstimate = parts.length > 0 ? parts.join(' / ') : '–';
        renderTicketSidebar();
    }

    _flipCardsIn();
    renderTable();
    renderSidebar();

    document.getElementById('resultsArea').style.display  = 'block';
    document.getElementById('cardArea').style.display     =
        participantRole === 'PRODUCT_OWNER' ? 'none' : 'block';
    document.getElementById('pokerPane').classList.add('session__poker--discussion');
    document.getElementById('discussionLabel').style.display = 'block';
    document.querySelector('[onclick="revealCards()"]').disabled = true;
}

function resetUI() {
    isRevealed   = false;
    selectedCard = null;
    averageValue = null;

    Object.keys(players).forEach(id => {
        players[id].voted             = false;
        players[id].cardValue         = null;
        players[id].originalCardValue = null;
        players[id].changed           = false;
    });

    document.getElementById('pokerPane').classList.remove('session__poker--discussion');
    document.getElementById('discussionLabel').style.display = 'none';
    document.getElementById('resultsArea').style.display     = 'none';
    document.getElementById('cardArea').style.display        =
        participantRole === 'PRODUCT_OWNER' ? 'none' : 'block';
    document.getElementById('voteStatus').textContent        = 'Warte auf Abstimmung...';
    document.getElementById('progressBar').style.width       = '0%';
    document.querySelector('[onclick="revealCards()"]').disabled = false;
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('selected'));

    renderTable();
    renderSidebar();
}

// ====================================
// Vote-Status
// ====================================

function updateVoteStatus(votedCount, totalCount, voterId) {
    document.getElementById('voteStatus').textContent =
        `${votedCount} / ${totalCount} abgestimmt`;

    const pct = totalCount > 0 ? (votedCount / totalCount * 100) : 0;
    document.getElementById('progressBar').style.width = pct + '%';

    if (voterId && players[voterId]) players[voterId].voted = true;

    renderTable();
    renderSidebar();
}

function updateDiscussion(id, name, cardValue) {
    let playerId = id;
    if (!players[playerId]) {
        playerId = Object.keys(players).find(k => players[k].name === name);
    }
    if (playerId && players[playerId]) {
        players[playerId].cardValue = cardValue;
        players[playerId].voted     = true;
        players[playerId].changed   = cardValue !== players[playerId].originalCardValue;
    }
    const stats  = recalculateStats();
    averageValue = stats.overallAvg;
    renderTable();
    renderSidebar();
}

// ====================================
// Moderator-Verwaltung
// ====================================

async function promoteMyself() {
    const response = await fetch(
        `/api/sessions/${roomCode}/participants/${participantId}/promote`,
        { method: 'POST' }
    );
    if (response.ok) sessionStorage.setItem('isModerator', 'true');
}

async function demoteParticipant(targetParticipantId) {
    const response = await fetch(
        `/api/sessions/${roomCode}/participants/${targetParticipantId}/demote`,
        { method: 'POST' }
    );
    if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Demote fehlgeschlagen.');
    } else if (targetParticipantId === participantId) {
        sessionStorage.setItem('isModerator', 'false');
    }
}

// ====================================
// Settings
// ====================================

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function saveSettings() {
    const showTopic       = document.getElementById('settingShowTopic').checked;
    const moderatorCanVote = document.getElementById('settingModeratorCanVote').checked;
    const autoReveal      = document.getElementById('settingAutoReveal').checked;
    stompClient.send('/app/session/' + roomCode + '/settings', {},
        JSON.stringify({ showTopic, moderatorCanVote, autoReveal }));
}

function applySettings(showTopic, moderatorCanVote, autoReveal) {
    const topicBar = document.getElementById('topicBar');
    if (topicBar) topicBar.style.display = showTopic ? 'flex' : 'none';

    const canVote = participantRole !== 'PRODUCT_OWNER' &&
        !(isModerator && !moderatorCanVote);
    document.getElementById('cardArea').style.display = canVote ? 'block' : 'none';

    document.getElementById('settingShowTopic').checked        = showTopic;
    document.getElementById('settingModeratorCanVote').checked = moderatorCanVote;
    document.getElementById('settingAutoReveal').checked       = autoReveal;
}

// ====================================
// Raumcode
// ====================================

function copyRoomCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = '✓ Kopiert';
        setTimeout(() => btn.textContent = 'Kopieren', 2000);
    });
}

// ====================================
// Interne Hilfsfunktionen
// ====================================

function _flipCardsIn() {
    document.querySelectorAll('#pokerTable rect').forEach(card => {
        if (card.getAttribute('id')?.startsWith('card-')) {
            card.style.transition      = 'none';
            card.style.transformBox    = 'fill-box';
            card.style.transformOrigin = 'center';
            card.style.transform       = 'scaleX(0)';
        }
    });
    setTimeout(() => {
        document.querySelectorAll('#pokerTable rect').forEach(card => {
            if (card.getAttribute('id')?.startsWith('card-')) {
                card.style.transition  = 'transform 0.3s ease-out';
                card.style.transform   = 'scaleX(1)';
            }
        });
    }, 50);
}