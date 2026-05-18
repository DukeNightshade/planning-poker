// ================================
// Sessiondaten aus DOM laden
// ================================
const sessionData = document.getElementById('sessionData');
const roomCode = sessionData.dataset.roomcode;
const participantId = sessionStorage.getItem('participantId');
const isModerator = sessionStorage.getItem('isModerator') === 'true';
const AVATAR_COLORS = [
    '#004178', '#E1001A', '#2563eb', '#16a34a',
    '#9333ea', '#ea580c', '#0891b2', '#be185d',
    '#854d0e', '#166534'
];

let selectedCard = null;
let stompClient = null;
let isRevealed = false;

// Teilnehmerstatus: { id -> { name, voted, cardValue, originalCardValue, changed } }
let players = {};

// ================================
// Init
// ================================
if (isModerator) {
    document.getElementById('moderatorActions').style.display = 'flex';
    document.getElementById('settingsBtn').style.display = 'block';
}

applySettings(
    document.getElementById('settingShowTopic').checked,
    document.getElementById('settingModeratorCanVote').checked,
    document.getElementById('settingAutoReveal').checked
);

// Teilnehmer aus DOM laden (server-side gerendert)
document.querySelectorAll('#playerData .player-entry').forEach(el => {
    players[el.dataset.playerId] = {
        name: el.dataset.playerName,
        voted: false,
        cardValue: null,
        originalCardValue: null,
        changed: false
    };
});
renderTable();
renderSidebar();

// ================================
// WebSocket
// ================================
function connect() {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null;

    stompClient.connect({}, function () {
        stompClient.subscribe('/topic/session/' + roomCode, function (message) {
            handleMessage(JSON.parse(message.body));
        });

        loadState();
    }, function (error) {
        console.error('WebSocket Verbindungsfehler:', error);
        setTimeout(connect, 3000);
    });
}

async function loadState() {
    const response = await fetch('/api/sessions/' + roomCode + '/state');
    if (response.ok) {
        renderTable();
        renderSidebar();
    }
}

// ================================
// Nachrichten verarbeiten
// ================================
function handleMessage(data) {
    switch (data.type) {
        case 'VOTE_UPDATE':
            updateVoteStatus(data.votedCount, data.totalCount, data.voterId);
            break;
        case 'REVEAL':
            showResults(data.votes);
            break;
        case 'DISCUSSION_UPDATE':
            updateDiscussion(data.participantId, data.participantName, data.cardValue);
            break;
        case 'RESET':
            resetUI();
            break;
        case 'TOPIC_UPDATE':
            document.getElementById('topicText').textContent =
                data.topic || 'Kein Ticket gewählt';
            break;
        case 'SETTINGS_UPDATE':
            applySettings(data.showTopic, data.moderatorCanVote, data.autoReveal);
            break;
        case 'PLAYER_JOINED':
            if (!players[data.participantId]) {
                players[data.participantId] = {
                    name: data.participantName,
                    voted: false,
                    cardValue: null,
                    originalCardValue: null,
                    changed: false
                };
            }
            renderTable();
            renderSidebar();
            break;
    }
}

// ================================
// SVG Poker Tisch
// ================================
function renderTable() {
    const container = document.getElementById('pokerTable');
    container.innerHTML = '';

    const playerList = Object.entries(players);
    const total = playerList.length;

    const tableRx = 200;
    const tableRy = 110;

    const baseOrbitRx = tableRx + 110;
    const baseOrbitRy = tableRy + 100;
    const minSpacing = 65;
    const circumference = 2 * Math.PI * Math.sqrt((baseOrbitRx * baseOrbitRx + baseOrbitRy * baseOrbitRy) / 2);
    const neededCircumference = total * minSpacing;
    const scaleFactor = Math.max(1, neededCircumference / circumference);

    const orbitRx = baseOrbitRx * scaleFactor;
    const orbitRy = baseOrbitRy * scaleFactor;

    const W = Math.max(900, orbitRx * 2 + 200);
    const H = Math.max(500, orbitRy * 2 + 200);
    const cx = W / 2;
    const cy = H / 2;

    const cardW = total <= 6 ? 44 : total <= 10 ? 38 : total <= 15 ? 32 : 26;
    const cardH = Math.round(cardW * 1.4);
    const nameFontSize = total <= 8 ? 12 : total <= 14 ? 10 : 9;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <radialGradient id="tableGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#005aa7"/>
            <stop offset="100%" stop-color="#003060"/>
        </radialGradient>
        <filter id="tableShadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="rgba(0,48,96,0.4)"/>
        </filter>
    `;
    svg.appendChild(defs);

    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('cx', cx);
    ellipse.setAttribute('cy', cy);
    ellipse.setAttribute('rx', tableRx);
    ellipse.setAttribute('ry', tableRy);
    ellipse.setAttribute('fill', 'url(#tableGrad)');
    ellipse.setAttribute('filter', 'url(#tableShadow)');
    svg.appendChild(ellipse);

    const statusText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    statusText.setAttribute('x', cx);
    statusText.setAttribute('y', cy - 10);
    statusText.setAttribute('text-anchor', 'middle');
    statusText.setAttribute('fill', 'white');
    statusText.setAttribute('font-size', '16');
    statusText.setAttribute('font-weight', '600');
    statusText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
    statusText.setAttribute('id', 'svgVoteStatus');
    statusText.textContent = document.getElementById('voteStatus').textContent;
    svg.appendChild(statusText);

    const progressBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    progressBg.setAttribute('x', cx - 70);
    progressBg.setAttribute('y', cy + 10);
    progressBg.setAttribute('width', 140);
    progressBg.setAttribute('height', 5);
    progressBg.setAttribute('rx', 3);
    progressBg.setAttribute('fill', 'rgba(255,255,255,0.2)');
    svg.appendChild(progressBg);

    const progressFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    progressFill.setAttribute('x', cx - 70);
    progressFill.setAttribute('y', cy + 10);
    progressFill.setAttribute('width', 0);
    progressFill.setAttribute('height', 5);
    progressFill.setAttribute('rx', 3);
    progressFill.setAttribute('fill', '#E1001A');
    progressFill.setAttribute('id', 'svgProgressBar');
    svg.appendChild(progressFill);

    if (total > 0) {
        playerList.forEach(([id, player], index) => {
            const angle = (2 * Math.PI * index / total) - Math.PI / 2;
            const px = cx + orbitRx * Math.cos(angle);
            const py = cy + orbitRy * Math.sin(angle);

            const isSelf = id === participantId;
            const hasVoted = player.voted;

            let cardFill, cardStroke, textFill;
            if (isRevealed && player.cardValue) {
                if (player.changed) {
                    cardFill = '#fff7ed';
                    cardStroke = '#f97316';
                    textFill = '#c2410c';
                } else {
                    cardFill = 'white';
                    cardStroke = '#004178';
                    textFill = '#004178';
                }
            } else if (hasVoted) {
                cardFill = '#E1001A'; cardStroke = '#c0001a'; textFill = 'white';
            } else if (isSelf) {
                cardFill = 'white'; cardStroke = '#004178'; textFill = '#004178';
            } else {
                cardFill = '#c8ddf0'; cardStroke = '#d0d8e4'; textFill = 'transparent';
            }

            const cardRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            cardRect.setAttribute('x', px - cardW / 2);
            cardRect.setAttribute('y', py - cardH / 2);
            cardRect.setAttribute('width', cardW);
            cardRect.setAttribute('height', cardH);
            cardRect.setAttribute('rx', 5);
            cardRect.setAttribute('fill', cardFill);
            cardRect.setAttribute('stroke', cardStroke);
            cardRect.setAttribute('stroke-width', '2');
            cardRect.setAttribute('id', `card-${id}`);
            svg.appendChild(cardRect);

            if (isRevealed && player.cardValue) {
                const cardText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                cardText.setAttribute('x', px);
                cardText.setAttribute('y', py + 5);
                cardText.setAttribute('text-anchor', 'middle');
                cardText.setAttribute('fill', textFill);
                cardText.setAttribute('font-size', cardW > 36 ? 14 : 11);
                cardText.setAttribute('font-weight', '700');
                cardText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
                cardText.setAttribute('id', `cardtext-${id}`);
                cardText.textContent = player.cardValue || '';
                svg.appendChild(cardText);
            } else if (isSelf && player.cardValue) {
                const cardText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                cardText.setAttribute('x', px);
                cardText.setAttribute('y', py + 5);
                cardText.setAttribute('text-anchor', 'middle');
                cardText.setAttribute('fill', textFill);
                cardText.setAttribute('font-size', cardW > 36 ? 14 : 11);
                cardText.setAttribute('font-weight', '700');
                cardText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
                cardText.setAttribute('id', `cardtext-${id}`);
                cardText.textContent = player.cardValue || '';
                svg.appendChild(cardText);
            }

            const nameY = py + cardH / 2 + 6;
            const displayName = player.name.length > 10
                ? player.name.substring(0, 9) + '…'
                : player.name + (isSelf ? ' (Du)' : '');
            const nameW = Math.min(displayName.length * 7 + 10, 110);

            const nameBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            nameBg.setAttribute('x', px - nameW / 2);
            nameBg.setAttribute('y', nameY);
            nameBg.setAttribute('width', nameW);
            nameBg.setAttribute('height', nameFontSize + 8);
            nameBg.setAttribute('rx', 4);
            nameBg.setAttribute('fill', 'white');
            nameBg.setAttribute('opacity', '0.9');
            svg.appendChild(nameBg);

            const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            nameText.setAttribute('x', px);
            nameText.setAttribute('y', nameY + nameFontSize);
            nameText.setAttribute('text-anchor', 'middle');
            nameText.setAttribute('fill', '#1a1a2e');
            nameText.setAttribute('font-size', nameFontSize);
            nameText.setAttribute('font-weight', '600');
            nameText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
            nameText.textContent = displayName;
            svg.appendChild(nameText);
        });
    }

    container.appendChild(svg);
    syncStatusToSvg();
}

function renderSidebar() {
    const playerList = Object.entries(players);
    const total = playerList.length;

    document.getElementById('sidebarTitle').textContent = `Teilnehmer (${total})`;

    const ul = document.getElementById('participantList');
    ul.innerHTML = '';

    // Sortierung: vor Aufdecken alphabetisch, nach Aufdecken nach Kartenwert
    const sorted = [...playerList].sort(([, a], [, b]) => {
        if (isRevealed && a.cardValue && b.cardValue) {
            const order = ['?', '☕', '0', '0.5', '1', '2', '3', '4', '5', '8', '13', '16', '20', '32', '40', '64', '100',
                'XS', 'S', 'M', 'L', 'XL', 'XXL'];
            const ai = order.indexOf(a.cardValue);
            const bi = order.indexOf(b.cardValue);
            if (ai !== -1 && bi !== -1) return ai - bi;
            return a.cardValue.localeCompare(b.cardValue);
        }
        return a.name.localeCompare(b.name);
    });

    sorted.forEach(([id, player]) => {
        const isSelf = id === participantId;
        const hasVoted = player.voted;
        const initial = player.name.charAt(0).toUpperCase();
        const color = getAvatarColor(player.name);

        const li = document.createElement('li');
        li.className = 'sidebar__item';
        li.innerHTML = `
            <div class="player-avatar" style="background:${color};">${initial}</div>
            <div class="player-info">
                <span class="player-info__name ${isSelf ? 'player-info__name--self' : ''}">
                    ${player.name}${isSelf ? ' (Sie)' : ''}
                </span>
            </div>
            ${isRevealed && player.cardValue ? `
                <span class="sidebar__card-value ${player.changed ? 'sidebar__card-value--changed' : ''}">
                    ${player.cardValue}
                </span>
            ` : `
                <div class="player-status ${player.changed ? 'player-status--changed' : (hasVoted ? 'player-status--voted' : 'player-status--waiting')}"></div>
            `}
        `;
        ul.appendChild(li);
    });
}

function syncStatusToSvg() {
    const svgStatus = document.getElementById('svgVoteStatus');
    const svgProgress = document.getElementById('svgProgressBar');
    const htmlStatus = document.getElementById('voteStatus');
    const htmlProgress = document.getElementById('progressBar');

    if (svgStatus && htmlStatus) {
        svgStatus.textContent = htmlStatus.textContent;
    }
    if (svgProgress && htmlProgress) {
        const pct = parseFloat(htmlProgress.style.width) || 0;
        svgProgress.setAttribute('width', (140 * pct / 100).toString());
    }
}

// ================================
// Vote-Status aktualisieren
// ================================
function updateVoteStatus(votedCount, totalCount, voterId) {
    document.getElementById('voteStatus').textContent =
        `${votedCount} / ${totalCount} abgestimmt`;

    const pct = totalCount > 0 ? (votedCount / totalCount * 100) : 0;
    document.getElementById('progressBar').style.width = pct + '%';

    if (voterId && players[voterId]) {
        players[voterId].voted = true;
    }
    renderTable();
    renderSidebar();
}

// ================================
// Diskussions-Update
// ================================
function updateDiscussion(id, name, cardValue) {

    let playerId = id;
    if (!players[playerId]) {
        playerId = Object.keys(players).find(k => players[k].name === name);
    }
    if (playerId && players[playerId]) {
        players[playerId].cardValue = cardValue;
        players[playerId].voted = true;
        players[playerId].changed =
            cardValue !== players[playerId].originalCardValue;
    }
    renderTable();
    renderSidebar();
}

// ================================
// Karte wählen
// ================================
function selectCard(button) {
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    selectedCard = button.dataset.value;

    const isDiscussion = isRevealed;

    if (players[participantId]) {
        if (isDiscussion && players[participantId].originalCardValue) {
            players[participantId].changed =
                selectedCard !== players[participantId].originalCardValue;
        }
        players[participantId].voted = true;
        players[participantId].cardValue = selectedCard;
    }
    renderTable();
    renderSidebar();

    stompClient.send(
        '/app/session/' + roomCode + '/vote',
        {},
        JSON.stringify({ participantId, cardValue: selectedCard, isDiscussion })
    );
}

// ================================
// Karten aufdecken
// ================================
function revealCards() {
    stompClient.send('/app/session/' + roomCode + '/reveal', {}, {});
}

// ================================
// Neue Runde
// ================================
function resetRound() {
    stompClient.send('/app/session/' + roomCode + '/reset', {}, {});
}

// ================================
// Topic setzen
// ================================
function updateTopic() {
    const topic = document.getElementById('topicInput').value.trim();
    if (!topic) return;
    stompClient.send('/app/session/' + roomCode + '/topic', {},
        JSON.stringify({ topic }));
    document.getElementById('topicInput').value = '';
}

// ================================
// Ergebnisse anzeigen
// ================================
function showResults(votes) {
    isRevealed = true;

    votes.forEach(vote => {
        const id = Object.keys(players).find(k => players[k].name === vote.participantName);
        if (id) {
            players[id].cardValue = vote.cardValue;
            players[id].originalCardValue = vote.cardValue;
            players[id].voted = true;
            players[id].changed = false;
        }
    });

    renderTable();
    renderSidebar();

    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '';
    votes.forEach(vote => {
        const li = document.createElement('li');
        li.className = 'results__item';
        li.innerHTML = `
            <span>${vote.participantName}</span>
            <span class="results__value">${vote.cardValue}</span>
        `;
        resultsList.appendChild(li);
    });

    document.getElementById('resultsArea').style.display = 'block';
    document.getElementById('cardArea').style.display = 'block';
    document.getElementById('pokerPane').classList.add('session__poker--discussion');
    document.getElementById('discussionLabel').style.display = 'block';
    document.querySelector('[onclick="revealCards()"]').disabled = true;
}

// ================================
// UI zurücksetzen
// ================================
function resetUI() {
    isRevealed = false;
    selectedCard = null;
    Object.keys(players).forEach(id => {
        players[id].voted = false;
        players[id].cardValue = null;
        players[id].originalCardValue = null;
        players[id].changed = false;
    });

    document.getElementById('pokerPane').classList.remove('session__poker--discussion');
    document.getElementById('discussionLabel').style.display = 'none';
    document.getElementById('resultsArea').style.display = 'none';
    document.getElementById('cardArea').style.display = 'block';
    document.getElementById('voteStatus').textContent = 'Warte auf Abstimmung...';
    document.getElementById('progressBar').style.width = '0%';
    document.querySelector('[onclick="revealCards()"]').disabled = false;

    const topicEl = document.getElementById('topicText');
    if (topicEl) topicEl.textContent = 'Kein Ticket gewählt';

    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('selected'));

    renderTable();
    renderSidebar();
}

// ================================
// Settings
// ================================
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function saveSettings() {
    const showTopic = document.getElementById('settingShowTopic').checked;
    const moderatorCanVote = document.getElementById('settingModeratorCanVote').checked;
    const autoReveal = document.getElementById('settingAutoReveal').checked;
    stompClient.send('/app/session/' + roomCode + '/settings', {},
        JSON.stringify({ showTopic, moderatorCanVote, autoReveal }));
}

function applySettings(showTopic, moderatorCanVote, autoReveal) {
    const topicSection = document.querySelector('.session__topic');
    if (topicSection) topicSection.style.display = showTopic ? 'block' : 'none';
    const topicForm = document.querySelector('.session__actions .form');
    if (topicForm) topicForm.style.display = showTopic ? 'flex' : 'none';
    if (isModerator && !moderatorCanVote) {
        document.getElementById('cardArea').style.display = 'none';
    } else {
        document.getElementById('cardArea').style.display = 'block';
    }
    document.getElementById('settingShowTopic').checked = showTopic;
    document.getElementById('settingModeratorCanVote').checked = moderatorCanVote;
    document.getElementById('settingAutoReveal').checked = autoReveal;
}

// ================================
// Raumcode kopieren
// ================================
function copyRoomCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = '✓ Kopiert';
        setTimeout(() => btn.textContent = 'Kopieren', 2000);
    });
}

// ================================
// Avatar Farben
// ================================
function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ================================
// Start
// ================================
connect();