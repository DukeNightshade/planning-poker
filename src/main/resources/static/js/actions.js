/* global selectedCard, averageValue, isRevealed, players, participantId,
          participantRole, roomCode, stompClient, currentTicketId, tickets,
          isModerator, renderTable, renderSidebar, renderTicketSidebar,
          recalculateStats, showToast */

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

    if (stompClient !== null && stompClient.connected) {
        stompClient.send('/app/session/' + roomCode + '/vote', {},
            JSON.stringify({ participantId, cardValue: selectedCard, isDiscussion }));
    } else {
        console.warn("WebSocket ist nicht verbunden! Abstimmung wurde nicht gesendet.");
        if (typeof showToast === 'function') {
            showToast(globalThis.i18n.toast.disconnected || "Keine Verbindung", 'warning');
        }
    }
}

// ====================================
// Moderator-Aktionen
// ====================================

function revealCards() {
    const groups = [...document.querySelectorAll('#pokerTable [id^="card-group-"]')];
    groups.forEach((g, i) => {
        g.style.transition = `transform ${180}ms ease-in ${i * 35}ms`;
        g.style.transform  = 'scaleX(0)';
    });
    const delay = groups.length * 35 + 200;
    setTimeout(() => {
        stompClient.send('/app/session/' + roomCode + '/reveal', {}, {});
    }, delay);
}

function resetRound() {
    const svg = document.querySelector('#pokerTable svg');
    if (!svg) {
        stompClient.send('/app/session/' + roomCode + '/reset', {}, {});
        return;
    }
    const vb    = svg.viewBox.baseVal;
    const cx    = vb.x + vb.width  / 2;
    const cy    = vb.y + vb.height / 2;

    const groups = [...svg.querySelectorAll('[id^="card-group-"]')];
    groups.forEach((g, i) => {
        const origin = g.style.transformOrigin || '0px 0px';
        const parts  = origin.match(/([\d.]+)px\s+([\d.]+)px/);
        if (!parts) return;
        const ox = Number.parseFloat(parts[1]);
        const oy = Number.parseFloat(parts[2]);
        const dx = cx - ox;
        const dy = cy - oy;
        const angle = (Math.random() - 0.5) * 40;

        const delay = i * 30;
        g.style.transition = `transform ${280}ms cubic-bezier(.4,0,.6,1) ${delay}ms, opacity ${200}ms ease ${delay + 150}ms`;
        g.style.transform  = `translate(${dx}px, ${dy}px) rotate(${angle}deg) scale(0.5)`;
        g.style.opacity    = '0';
    });

    const totalDelay = groups.length * 30 + 320;
    setTimeout(() => {
        stompClient.send('/app/session/' + roomCode + '/reset', {}, {});
    }, totalDelay);
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
        tickets[currentTicketId].finalEstimate = stats.overallAvg ?? '–';
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

    showToast(globalThis.i18n.toast.revealed, 'success', '', 3000);
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
    document.getElementById('voteStatus').textContent = globalThis.i18n.labels.waiting;
    document.getElementById('progressBar').style.width       = '0%';
    document.querySelector('[onclick="revealCards()"]').disabled = false;
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('selected'));

    renderTable();
    renderSidebar();

    _dealCardsIn();
}

function _animateDeal(groups) {
    groups.forEach((g, i) => {
        const delay = i * 80;
        g.style.transition = `transform 350ms cubic-bezier(.2,.8,.3,1.2) ${delay}ms, opacity 200ms ease ${delay}ms`;
        g.style.transform  = 'translate(0,0) scale(1) rotate(0deg)';
        g.style.opacity    = '1';
    });
}

function _dealCardsIn() {
    setTimeout(() => {
        const groups = [...document.querySelectorAll('#pokerTable [id^="card-group-"]')];
        const svg = document.querySelector('#pokerTable svg');
        let cx = 450, cy = 250;
        if (svg) {
            const vb = svg.viewBox.baseVal;
            cx = vb.x + vb.width  / 2;
            cy = vb.y + vb.height / 2;
        }
        groups.forEach(g => {
            const origin = g.style.transformOrigin || '';
            const parts  = origin.match(/([\d.]+)px\s+([\d.]+)px/);
            if (!parts) return;
            const ox = Number.parseFloat(parts[1]);
            const oy = Number.parseFloat(parts[2]);
            const dx = cx - ox;
            const dy = cy - oy;
            g.style.transition = 'none';
            g.style.transform  = `translate(${dx}px, ${dy}px) scale(0.15) rotate(${(Math.random()-0.5)*30}deg)`;
            g.style.opacity    = '0';
        });
        requestAnimationFrame(() => {
            requestAnimationFrame(() => _animateDeal(groups));
        });
    }, 50);
}

// ====================================
// Vote-Status
// ====================================

function updateVoteStatus(votedCount, totalCount, voterId) {
    document.getElementById('voteStatus').textContent =
        globalThis.i18n.session.voted.replace('{0}', votedCount).replace('{1}', totalCount);

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
    if (response.ok) {
        sessionStorage.setItem('isModerator', 'true');
        showToast(globalThis.i18n.toast.promotedSelf, 'success', '', 3000);
    } else {
        showToast(globalThis.i18n.toast.errorPromote, 'error');
    }
}

async function demoteParticipant(targetParticipantId) {
    const response = await fetch(
        `/api/sessions/${roomCode}/participants/${targetParticipantId}/demote`,
        { method: 'POST' }
    );
    if (!response.ok) {
        const data = await response.json();
        showToast(data.error || globalThis.i18n.toast.errorAction, 'error');
    } else if (targetParticipantId === participantId) {
        sessionStorage.setItem('isModerator', 'false');
        showToast(globalThis.i18n.toast.demotedSelf, 'info', '', 3000);
    }
}

// ====================================
// Settings
// ====================================

function applyTicketSidebarVisibility() {
    const showTopicEl   = document.getElementById('settingShowTopic');
    const showTopic     = showTopicEl ? showTopicEl.checked : false;
    const ticketSidebar = document.getElementById('ticketSidebar');
    const sessionEl     = document.querySelector('.session');
    if (ticketSidebar) ticketSidebar.style.display = showTopic ? 'flex' : 'none';
    if (sessionEl)     sessionEl.classList.toggle('session--with-tickets', showTopic);
}

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    const btn   = document.getElementById('settingsBtn');
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (btn) btn.setAttribute('aria-expanded', String(!isOpen));
}

function saveSettings() {
    const showTopic        = document.getElementById('settingShowTopic').checked;
    const moderatorCanVote = document.getElementById('settingModeratorCanVote').checked;
    const autoReveal       = document.getElementById('settingAutoReveal').checked;
    const showOnlyTotal    = document.getElementById('settingShowOnlyTotal').checked;   // NEU
    stompClient.send('/app/session/' + roomCode + '/settings', {},
        JSON.stringify({ showTopic, moderatorCanVote, autoReveal, showOnlyTotal }));
}

function applySettings(showTopic, moderatorCanVote, autoReveal, onlyTotal) {
    const topicBar = document.getElementById('topicBar');
    if (topicBar) topicBar.style.display = (showTopic && Object.keys(tickets).length > 0) ? 'flex' : 'none';

    const showTopicEl = document.getElementById('settingShowTopic');
    if (showTopicEl) showTopicEl.checked = showTopic;
    document.getElementById('settingModeratorCanVote').checked = moderatorCanVote;
    document.getElementById('settingAutoReveal').checked       = autoReveal;

    const onlyTotalEl = document.getElementById('settingShowOnlyTotal');
    if (onlyTotalEl) onlyTotalEl.checked = onlyTotal;
    showOnlyTotal = onlyTotal;

    applyTicketSidebarVisibility();

    const canVote = participantRole !== 'PRODUCT_OWNER' &&
        !(isModerator && !moderatorCanVote);
    document.getElementById('cardArea').style.display = canVote ? 'block' : 'none';

    if (isRevealed) renderTable();
}

// ====================================
// Raumcode
// ====================================

function copyRoomCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
        const btn = document.getElementById('copyBtn');
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = globalThis.i18n.nav.copied;
        setTimeout(() => btn.textContent = btn.dataset.label, 2000);
        showToast(globalThis.i18n.toast.copied, 'success', roomCode, 2500);
    }).catch(() => {
        showToast(globalThis.i18n.toast.errorCopy, 'error');
    });
}

// ====================================
// Interne Hilfsfunktionen
// ====================================

function _animateFlip(groups) {
    groups.forEach((g, i) => {
        g.style.transition = `transform 320ms cubic-bezier(.34,1.4,.64,1) ${i * 55}ms`;
        g.style.transform  = 'scaleX(1)';
    });
}

function _flipCardsIn() {
    setTimeout(() => {
        const groups = [...document.querySelectorAll('#pokerTable [id^="card-group-"]')];
        groups.forEach(g => {
            g.style.transition = 'none';
            g.style.transform  = 'scaleX(0)';
            g.style.opacity    = '1';
        });
        requestAnimationFrame(() => {
            requestAnimationFrame(() => _animateFlip(groups));
        });
    }, 30);
}