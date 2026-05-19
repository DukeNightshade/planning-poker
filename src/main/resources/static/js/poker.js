// ====================================
// Session-Daten aus DOM
// ====================================

const sessionData     = document.getElementById('sessionData');
const roomCode        = sessionData.dataset.roomcode;
const participantId   = sessionStorage.getItem('participantId');
let   isModerator     = sessionStorage.getItem('isModerator') === 'true';
const participantRole = sessionStorage.getItem('participantRole') || 'DEVELOPER';

// ====================================
// Zustandsvariablen
// ====================================

let selectedCard    = null;
let stompClient     = null;
let isRevealed      = false;
let averageValue    = null;
let currentTicketId = null;

/** Ticket-Map: { id -> { title, status, finalEstimate } } */
let tickets = {};

/** Spieler-Map: { id -> { name, role, moderator, voted, cardValue, originalCardValue, changed } } */
let players = {};

// ====================================
// Initialisierung
// ====================================

if (isModerator) {
    document.getElementById('moderatorActions').style.display = 'flex';
    document.getElementById('settingsBtn').style.display      = 'block';
    document.getElementById('addTicketBtn').style.display     = 'block';
}

applySettings(
    document.getElementById('settingShowTopic').checked,
    document.getElementById('settingModeratorCanVote').checked,
    document.getElementById('settingAutoReveal').checked
);

document.querySelectorAll('#playerData .player-entry').forEach(el => {
    players[el.dataset.playerId] = {
        name:              el.dataset.playerName,
        role:              el.dataset.playerRole || 'DEVELOPER',
        moderator:         el.dataset.playerModerator === 'true',
        voted:             false,
        cardValue:         null,
        originalCardValue: null,
        changed:           false
    };
});

if (participantRole === 'PRODUCT_OWNER') {
    document.getElementById('cardArea').style.display = 'none';
}

renderTable();
renderSidebar();

// ====================================
// WebSocket
// ====================================

function connect() {
    const socket = new SockJS('/ws');
    stompClient  = Stomp.over(socket);
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

async function loadInitialData() {
    const ticketResponse = await fetch('/api/sessions/' + roomCode + '/tickets');
    if (ticketResponse.ok) {
        const ticketList = await ticketResponse.json();
        tickets = {};
        ticketList.forEach(t => {
            tickets[t.id] = { title: t.title, status: t.status, finalEstimate: t.finalEstimate };
        });

        const hasTickets = ticketList.length > 0;
        document.getElementById('ticketSidebar').style.display = hasTickets ? 'flex' : 'none';
        document.querySelector('.session').classList.toggle('session--with-tickets', hasTickets);
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

// ====================================
// Nachrichten-Routing
// ====================================

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
                    name:              data.participantName,
                    role:              data.participantRole || 'DEVELOPER',
                    moderator:         false,
                    voted:             false,
                    cardValue:         null,
                    originalCardValue: null,
                    changed:           false
                };
            }
            renderTable();
            renderSidebar();
            break;
        case 'PLAYER_LEFT':
            delete players[data.participantId];
            renderTable();
            renderSidebar();
            break;
        case 'MODERATOR_PROMOTED':
            if (players[data.participantId]) {
                players[data.participantId].moderator = true;
            }
            if (data.participantId === participantId) {
                isModerator = true;
                document.getElementById('moderatorActions').style.display = 'flex';
                document.getElementById('settingsBtn').style.display      = 'block';
                document.getElementById('addTicketBtn').style.display     = 'block';
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
                document.getElementById('settingsBtn').style.display      = 'none';
                document.getElementById('addTicketBtn').style.display     = 'none';
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

// ====================================
// Start
// ====================================

connect();