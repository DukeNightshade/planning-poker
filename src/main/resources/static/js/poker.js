// ================================
// Sessiondaten aus DOM laden
// ================================
const sessionData = document.getElementById('sessionData');
const roomCode = sessionData.dataset.roomcode;
const participantId = sessionStorage.getItem('participantId');
let isModerator = sessionStorage.getItem('isModerator') === 'true';
const participantRole = sessionStorage.getItem('participantRole') || 'DEVELOPER';

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

let selectedCard = null;
let stompClient = null;
let isRevealed = false;
let averageValue = null;
let currentTicketId = null;

// Tickets: { id -> { title, status, finalEstimate } }
let tickets = {};

// Teilnehmer: { id -> { name, role, voted, cardValue, originalCardValue, changed } }
let players = {};

// ================================
// Init
// ================================
if (isModerator) {
    document.getElementById('moderatorActions').style.display = 'flex';
    document.getElementById('settingsBtn').style.display = 'block';
    document.getElementById('addTicketBtn').style.display = 'block';
}

applySettings(
    document.getElementById('settingShowTopic').checked,
    document.getElementById('settingModeratorCanVote').checked,
    document.getElementById('settingAutoReveal').checked
);

document.querySelectorAll('#playerData .player-entry').forEach(el => {
    players[el.dataset.playerId] = {
        name: el.dataset.playerName,
        role: el.dataset.playerRole || 'DEVELOPER',
        moderator: el.dataset.playerModerator === 'true',
        voted: false,
        cardValue: null,
        originalCardValue: null,
        changed: false
    };
});

// Karten für PO ausblenden
if (participantRole === 'PRODUCT_OWNER') {
    document.getElementById('cardArea').style.display = 'none';
}

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
        loadInitialData();
    }, function (error) {
        console.error('WebSocket Verbindungsfehler:', error);
        setTimeout(connect, 3000);
    });
}

async function promoteMyself() {
    const response = await fetch(
        `/api/sessions/${roomCode}/participants/${participantId}/promote`,
        { method: 'POST' }
    );
    if (response.ok) {
        sessionStorage.setItem('isModerator', 'true');
    }
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

async function loadInitialData() {
    const ticketResponse = await fetch('/api/sessions/' + roomCode + '/tickets');
    if (ticketResponse.ok) {
        const ticketList = await ticketResponse.json();
        tickets = {};
        ticketList.forEach(t => {
            tickets[t.id] = { title: t.title, status: t.status, finalEstimate: t.finalEstimate };
        });

        if (ticketList.length > 0) {
            document.getElementById('ticketSidebar').style.display = 'flex';
            document.querySelector('.session').classList.add('session--with-tickets');
        } else {
            document.getElementById('ticketSidebar').style.display = 'none';
            document.querySelector('.session').classList.remove('session--with-tickets');
        }
        renderTicketSidebar();
    }

    const stateResponse = await fetch('/api/sessions/' + roomCode + '/state');
    if (stateResponse.ok) {
        const state = await stateResponse.json();
        if (state.currentTicketId) {
            currentTicketId = state.currentTicketId.toString();
            document.getElementById('topicText').textContent = state.currentTicketTitle;
        }
    }

    renderTable();
    renderSidebar();
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
        case 'SETTINGS_UPDATE':
            applySettings(data.showTopic, data.moderatorCanVote, data.autoReveal);
            break;
        case 'PLAYER_JOINED':
            if (!players[data.participantId]) {
                players[data.participantId] = {
                    name: data.participantName,
                    role: data.participantRole || 'DEVELOPER',
                    moderator: false,
                    voted: false,
                    cardValue: null,
                    originalCardValue: null,
                    changed: false
                };
            }
            renderTable();
            renderSidebar();
            break;
        case 'MODERATOR_PROMOTED':
            if (players[data.participantId]) {
                players[data.participantId].moderator = true;
            }
            // Wenn ich selbst befördert wurde
            if (data.participantId === participantId) {
                isModerator = true;  // const → let machen oben!
                document.getElementById('moderatorActions').style.display = 'flex';
                document.getElementById('settingsBtn').style.display = 'block';
                document.getElementById('addTicketBtn').style.display = 'block';
            }
            renderSidebar();
            break;
        case 'MODERATOR_DEMOTED':
            if (players[data.participantId]) {
                players[data.participantId].moderator = false;
            }
            if (data.participantId === participantId) {
                isModerator = false;
                sessionStorage.setItem('isModerator', 'false');
                document.getElementById('moderatorActions').style.display = 'none';
                document.getElementById('settingsBtn').style.display = 'none';
                document.getElementById('addTicketBtn').style.display = 'none';
            }
            renderSidebar();
            break;
        case 'TICKET_ADDED':
            tickets[data.id] = { title: data.title, status: data.status, finalEstimate: '' };
            document.getElementById('ticketSidebar').style.display = 'flex';
            document.querySelector('.session').classList.add('session--with-tickets');
            renderTicketSidebar();
            break;
        case 'TICKET_SELECTED':
            currentTicketId = data.id;
            document.getElementById('topicText').textContent = data.title;
            resetUI();
            renderTicketSidebar();
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
    const circumference = 2 * Math.PI * Math.sqrt((baseOrbitRx ** 2 + baseOrbitRy ** 2) / 2);
    const scaleFactor = Math.max(1, (total * minSpacing) / circumference);
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

    // Defs
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

    // Tisch Ellipse
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('cx', cx);
    ellipse.setAttribute('cy', cy);
    ellipse.setAttribute('rx', tableRx);
    ellipse.setAttribute('ry', tableRy);
    ellipse.setAttribute('fill', 'url(#tableGrad)');
    ellipse.setAttribute('filter', 'url(#tableShadow)');
    svg.appendChild(ellipse);

    // Tisch-Inhalt: Stats oder Vote-Status
    if (isRevealed) {
        const stats = recalculateStats();
        _renderTableStats(svg, cx, cy, stats);
    } else {
        const statusText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        statusText.setAttribute('x', cx);
        statusText.setAttribute('y', cy + 6);
        statusText.setAttribute('text-anchor', 'middle');
        statusText.setAttribute('fill', 'white');
        statusText.setAttribute('font-size', '16');
        statusText.setAttribute('font-weight', '600');
        statusText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
        statusText.setAttribute('id', 'svgVoteStatus');
        statusText.textContent = document.getElementById('voteStatus').textContent;
        svg.appendChild(statusText);

        // Fortschrittsbalken
        const progressBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        progressBg.setAttribute('x', cx - 70);
        progressBg.setAttribute('y', cy + 20);
        progressBg.setAttribute('width', 140);
        progressBg.setAttribute('height', 5);
        progressBg.setAttribute('rx', 3);
        progressBg.setAttribute('fill', 'rgba(255,255,255,0.2)');
        svg.appendChild(progressBg);

        const progressFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        progressFill.setAttribute('x', cx - 70);
        progressFill.setAttribute('y', cy + 20);
        progressFill.setAttribute('width', 0);
        progressFill.setAttribute('height', 5);
        progressFill.setAttribute('rx', 3);
        progressFill.setAttribute('fill', '#E1001A');
        progressFill.setAttribute('id', 'svgProgressBar');
        svg.appendChild(progressFill);
    }

    // Spieler
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
                    cardFill = '#fff7ed'; cardStroke = '#f97316'; textFill = '#c2410c';
                } else {
                    cardFill = 'white'; cardStroke = '#004178'; textFill = '#004178';
                }
            } else if (hasVoted) {
                cardFill = '#E1001A'; cardStroke = '#c0001a'; textFill = 'white';
            } else if (isSelf) {
                cardFill = 'white'; cardStroke = '#004178'; textFill = '#004178';
            } else {
                cardFill = '#c8ddf0'; cardStroke = '#d0d8e4'; textFill = 'transparent';
            }

            // Karte
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

            // Kartenwert
            if ((isRevealed && player.cardValue) || (isSelf && player.cardValue)) {
                const cardText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                cardText.setAttribute('x', px);
                cardText.setAttribute('y', py + 5);
                cardText.setAttribute('text-anchor', 'middle');
                cardText.setAttribute('fill', textFill);
                cardText.setAttribute('font-size', cardW > 36 ? 14 : 11);
                cardText.setAttribute('font-weight', '700');
                cardText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
                cardText.textContent = player.cardValue;
                svg.appendChild(cardText);
            }

            // Namens-Hintergrund
            const nameY = py + cardH / 2 + 6;
            const roleColor = ROLE_COLORS[player.role] || '#004178';
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
            nameBg.setAttribute('opacity', '0.95');
            svg.appendChild(nameBg);

            // Rolle-Indikator (kleiner farbiger Streifen links am Namensbadge)
            const roleBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            roleBar.setAttribute('x', px - nameW / 2);
            roleBar.setAttribute('y', nameY);
            roleBar.setAttribute('width', 3);
            roleBar.setAttribute('height', nameFontSize + 8);
            roleBar.setAttribute('rx', 2);
            roleBar.setAttribute('fill', roleColor);
            svg.appendChild(roleBar);

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

function _renderTableStats(svg, cx, cy, stats) {
    const hasDevs = stats.devAvg !== null;
    const hasTesters = stats.testerAvg !== null;

    if (!hasDevs && !hasTesters) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', cx); t.setAttribute('y', cy + 6);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('fill', 'rgba(255,255,255,0.6)');
        t.setAttribute('font-size', '14');
        t.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
        t.textContent = 'Keine numerischen Werte';
        svg.appendChild(t);
        return;
    }

    // Trennlinie
    const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    divider.setAttribute('x1', cx); divider.setAttribute('y1', cy - 28);
    divider.setAttribute('x2', cx); divider.setAttribute('y2', cy + 28);
    divider.setAttribute('stroke', 'rgba(255,255,255,0.2)');
    divider.setAttribute('stroke-width', '1');
    svg.appendChild(divider);

    // Devs (links)
    if (hasDevs) {
        _renderStatBlock(svg, cx - 55, cy, '⚙ Dev', stats.devAvg, stats.devSpread, '#60a5fa');
    }

    // Testers (rechts)
    if (hasTesters) {
        _renderStatBlock(svg, cx + 55, cy, '✓ Test', stats.testerAvg, stats.testerSpread, '#4ade80');
    }
}

function _renderStatBlock(svg, x, y, label, avg, spread, color) {
    // Label
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', x); labelText.setAttribute('y', y - 18);
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('fill', color);
    labelText.setAttribute('font-size', '11');
    labelText.setAttribute('font-weight', '700');
    labelText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
    labelText.setAttribute('letter-spacing', '0.5');
    labelText.textContent = label;
    svg.appendChild(labelText);

    // Durchschnitt
    const avgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    avgText.setAttribute('x', x); avgText.setAttribute('y', y + 8);
    avgText.setAttribute('text-anchor', 'middle');
    avgText.setAttribute('fill', 'white');
    avgText.setAttribute('font-size', '22');
    avgText.setAttribute('font-weight', '700');
    avgText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
    avgText.textContent = `Ø ${avg}`;
    svg.appendChild(avgText);

    // Spread
    if (spread !== null) {
        const spreadText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        spreadText.setAttribute('x', x);
        spreadText.setAttribute('y', y + 26);
        spreadText.setAttribute('text-anchor', 'middle');
        spreadText.setAttribute('fill', 'rgba(255,255,255,0.55)');
        spreadText.setAttribute('font-size', '11');
        spreadText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
        spreadText.textContent = `↕ ${spread}`;
        svg.appendChild(spreadText);
    }
}

// ================================
// Sidebar
// ================================
function renderSidebar() {
    const playerList = Object.entries(players);
    const total = playerList.length;
    document.getElementById('sidebarTitle').textContent = `Teilnehmer (${total})`;

    // Sicherer: über players direkt
    const activeModerators = Object.entries(players).filter(([id, p]) =>
        p.moderator || (id === participantId && isModerator)
    ).length;

    const ul = document.getElementById('participantList');
    ul.innerHTML = '';

    const sorted = [...playerList].sort(([, a], [, b]) => {
        if (isRevealed && a.cardValue && b.cardValue) {
            const order = ['?', '☕', '0', '0.5', '1', '2', '3', '4', '5', '8', '13',
                '16', '20', '32', '40', '64', '100', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
            const ai = order.indexOf(a.cardValue);
            const bi = order.indexOf(b.cardValue);
            if (ai !== -1 && bi !== -1) return ai - bi;
            return a.cardValue.localeCompare(b.cardValue);
        }
        return a.name.localeCompare(b.name);
    });

    sorted.forEach(([id, player]) => {
        const isSelfEntry = id === participantId;
        const hasVoted = player.voted;
        const initial = player.name.charAt(0).toUpperCase();
        const avatarColor = getAvatarColor(player.name);
        const roleColor = ROLE_COLORS[player.role] || '#004178';
        const isAlreadyModerator = player.moderator || (isSelfEntry && isModerator);
        const canDemote = isAlreadyModerator && activeModerators > 1;

        const li = document.createElement('li');
        li.className = 'sidebar__item';
        li.innerHTML = `
            <div class="player-avatar" style="background:${avatarColor}; border: 2px solid ${roleColor}20;">
                ${initial}
            </div>
            <div class="player-info">
                <span class="player-info__name ${isSelfEntry ? 'player-info__name--self' : ''}">
                    ${player.name}${isSelfEntry ? ' (Sie)' : ''}
                </span>
                <span class="player-info__role" style="color:${roleColor};">
                    ${getRoleLabel(player.role)}${isAlreadyModerator ? ' · Moderator' : ''}
                </span>
            </div>
            ${isRevealed && player.cardValue ? `
                <span class="sidebar__card-value ${player.changed ? 'sidebar__card-value--changed' : ''}">
                    ${player.cardValue}
                </span>
            ` : player.role === 'PRODUCT_OWNER' ? '' : `
                <div class="player-status ${player.changed ? 'player-status--changed' :
            (hasVoted ? 'player-status--voted' : 'player-status--waiting')}"></div>
            `}
            ${isSelfEntry && !isAlreadyModerator ? `
                <button class="btn--promote" onclick="promoteMyself()" title="Zum Moderator werden">↑</button>
            ` : ''}
            ${isSelfEntry && canDemote ? `
                <button class="btn--demote" onclick="demoteParticipant('${id}')" title="Moderator-Rechte abgeben">↓</button>
            ` : ''}
            ${!isSelfEntry && isModerator && isAlreadyModerator && canDemote ? `
                <button class="btn--demote" onclick="demoteParticipant('${id}')" title="Moderator-Rechte entziehen">↓</button>
            ` : ''}
        `;
        ul.appendChild(li);
    });
}

function syncStatusToSvg() {
    const svgProgress = document.getElementById('svgProgressBar');
    const htmlProgress = document.getElementById('progressBar');
    if (svgProgress && htmlProgress) {
        const pct = parseFloat(htmlProgress.style.width) || 0;
        svgProgress.setAttribute('width', (140 * pct / 100).toString());
    }
    // Vote-Status Text direkt setzen wenn nicht revealed
    if (!isRevealed) {
        const svgStatus = document.getElementById('svgVoteStatus');
        const htmlStatus = document.getElementById('voteStatus');
        if (svgStatus && htmlStatus) svgStatus.textContent = htmlStatus.textContent;
    }
}

// ================================
// Ticket-Sidebar
// ================================
function renderTicketSidebar() {
    const ul = document.getElementById('ticketSidebarList');
    ul.innerHTML = '';

    Object.entries(tickets).forEach(([id, ticket]) => {
        const isActive = id === currentTicketId?.toString();
        const isVoted = ticket.status === 'VOTED';

        const li = document.createElement('li');
        li.className = 'ticket-sidebar__item'
            + (isActive ? ' ticket-sidebar__item--active' : '')
            + (isVoted ? ' ticket-sidebar__item--voted' : '');

        li.innerHTML = `
            <span class="ticket-sidebar__title">${ticket.title}</span>
            ${isVoted && ticket.finalEstimate
            ? `<span class="ticket-sidebar__estimate">${ticket.finalEstimate}</span>`
            : ''}
        `;

        if (isModerator && !isVoted) {
            li.style.cursor = 'pointer';
            li.onclick = () => selectTicket(id);
        }

        ul.appendChild(li);
    });
}

function selectTicket(ticketId) {
    stompClient.send('/app/session/' + roomCode + '/ticket/select', {},
        JSON.stringify({ ticketId: ticketId.toString() }));
}

function showAddTicketForm() {
    document.getElementById('addTicketForm').style.display = 'block';
    document.getElementById('addTicketBtn').style.display = 'none';
    document.getElementById('newTicketInput').focus();
}

function cancelAddTicket() {
    document.getElementById('addTicketForm').style.display = 'none';
    document.getElementById('addTicketBtn').style.display = 'block';
    document.getElementById('newTicketInput').value = '';
}

function submitNewTicket() {
    const title = document.getElementById('newTicketInput').value.trim();
    if (!title) return;
    stompClient.send('/app/session/' + roomCode + '/ticket/add', {},
        JSON.stringify({ title }));
    cancelAddTicket();
}

// ================================
// Vote-Status
// ================================
function updateVoteStatus(votedCount, totalCount, voterId) {
    document.getElementById('voteStatus').textContent =
        `${votedCount} / ${totalCount} abgestimmt`;

    const pct = totalCount > 0 ? (votedCount / totalCount * 100) : 0;
    document.getElementById('progressBar').style.width = pct + '%';

    if (voterId && players[voterId]) players[voterId].voted = true;

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
        players[playerId].changed = cardValue !== players[playerId].originalCardValue;
    }
    const stats = recalculateStats();
    averageValue = stats.overallAvg;
    renderTable();
    renderSidebar();
}

// ================================
// Karte wählen
// ================================
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
        players[participantId].voted = true;
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

// ================================
// Karten aufdecken
// ================================
function revealCards() {
    document.querySelectorAll('#pokerTable rect').forEach(card => {
        if (card.getAttribute('id')?.startsWith('card-')) {
            card.style.transition = 'transform 0.25s ease-in';
            card.style.transformBox = 'fill-box';
            card.style.transformOrigin = 'center';
            card.style.transform = 'scaleX(0)';
        }
    });
    setTimeout(() => {
        stompClient.send('/app/session/' + roomCode + '/reveal', {}, {});
    }, 250);
}

// ================================
// Neue Runde
// ================================
function resetRound() {
    stompClient.send('/app/session/' + roomCode + '/reset', {}, {});
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
            players[id].role = vote.participantRole || players[id].role;
            players[id].voted = true;
            players[id].changed = false;
        }
    });

    const stats = recalculateStats();
    averageValue = stats.overallAvg;

    if (currentTicketId && tickets[currentTicketId]) {
        tickets[currentTicketId].status = 'VOTED';
        const parts = [];
        if (stats.devAvg) parts.push(`Dev ${stats.devAvg}`);
        if (stats.testerAvg) parts.push(`Test ${stats.testerAvg}`);
        tickets[currentTicketId].finalEstimate = parts.length > 0 ? parts.join(' / ') : '–';

        renderTicketSidebar();
    }

    document.querySelectorAll('#pokerTable rect').forEach(card => {
        if (card.getAttribute('id')?.startsWith('card-')) {
            card.style.transition = 'none';
            card.style.transformBox = 'fill-box';
            card.style.transformOrigin = 'center';
            card.style.transform = 'scaleX(0)';
        }
    });

    renderTable();
    renderSidebar();

    setTimeout(() => {
        document.querySelectorAll('#pokerTable rect').forEach(card => {
            if (card.getAttribute('id')?.startsWith('card-')) {
                card.style.transition = 'transform 0.3s ease-out';
                card.style.transformBox = 'fill-box';
                card.style.transformOrigin = 'center';
                card.style.transform = 'scaleX(1)';
            }
        });
    }, 50);

    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '';
    votes.forEach(vote => {
        const li = document.createElement('li');
        li.className = 'results__item';
        li.innerHTML = `<span>${vote.participantName}</span><span class="results__value">${vote.cardValue}</span>`;
        resultsList.appendChild(li);
    });

    document.getElementById('resultsArea').style.display = 'block';
    document.getElementById('cardArea').style.display =
        participantRole === 'PRODUCT_OWNER' ? 'none' : 'block';
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
    averageValue = null;

    Object.keys(players).forEach(id => {
        players[id].voted = false;
        players[id].cardValue = null;
        players[id].originalCardValue = null;
        players[id].changed = false;
    });

    document.getElementById('pokerPane').classList.remove('session__poker--discussion');
    document.getElementById('discussionLabel').style.display = 'none';
    document.getElementById('resultsArea').style.display = 'none';
    document.getElementById('cardArea').style.display =
        participantRole === 'PRODUCT_OWNER' ? 'none' : 'block';
    document.getElementById('voteStatus').textContent = 'Warte auf Abstimmung...';
    document.getElementById('progressBar').style.width = '0%';
    document.querySelector('[onclick="revealCards()"]').disabled = false;
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
    const topicBar = document.getElementById('topicBar');
    if (topicBar) topicBar.style.display = showTopic ? 'flex' : 'none';

    const canVote = participantRole !== 'PRODUCT_OWNER' &&
        !(isModerator && !moderatorCanVote);
    document.getElementById('cardArea').style.display = canVote ? 'block' : 'none';

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
// Stats berechnen
// ================================
function recalculateStats() {
    const devVotes = Object.values(players)
        .filter(p => p.role === 'DEVELOPER' && p.cardValue)
        .map(p => parseFloat(p.cardValue))
        .filter(v => !isNaN(v));

    const testerVotes = Object.values(players)
        .filter(p => p.role === 'TESTER' && p.cardValue)
        .map(p => parseFloat(p.cardValue))
        .filter(v => !isNaN(v));

    const fmt = v => Number.isInteger(v) ? v.toString() : v.toFixed(1);

    const devAvg = devVotes.length > 0
        ? fmt(devVotes.reduce((a, b) => a + b, 0) / devVotes.length) : null;
    const testerAvg = testerVotes.length > 0
        ? fmt(testerVotes.reduce((a, b) => a + b, 0) / testerVotes.length) : null;
    const devSpread = devVotes.length >= 2
        ? fmt(Math.max(...devVotes) - Math.min(...devVotes)) : null;
    const testerSpread = testerVotes.length >= 2
        ? fmt(Math.max(...testerVotes) - Math.min(...testerVotes)) : null;

    const allVotes = [...devVotes, ...testerVotes];
    const overallAvg = allVotes.length > 0
        ? fmt(allVotes.reduce((a, b) => a + b, 0) / allVotes.length) : null;

    return { devAvg, testerAvg, devSpread, testerSpread, overallAvg };
}

// ================================
// Hilfsfunktionen
// ================================
function getRoleLabel(role) {
    const labels = {
        DEVELOPER: 'Entwickler',
        TESTER: 'Tester',
        PRODUCT_OWNER: 'Product Owner',
        MODERATOR: 'Moderator'
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

// ================================
// Start
// ================================
connect();