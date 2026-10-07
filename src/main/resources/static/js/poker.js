/* global SockJS, Stomp, applyTicketSidebarVisibility */

// ====================================
// Session-Daten aus DOM
// ====================================

const sessionData   = document.getElementById('sessionData');
const roomCode      = sessionData.dataset.roomcode;
let participantId   = sessionStorage.getItem('participantId');
let isModerator     = sessionStorage.getItem('isModerator') === 'true';
let participantRole = sessionStorage.getItem('participantRole') || 'DEVELOPER';

// ====================================
// Zustandsvariablen
// ====================================

let selectedCard    = null;
let stompClient     = null;
let isRevealed   = false;
let averageValue    = null;
let currentTicketId = null;
let showOnlyTotal= true;

let tickets = {};
let players = {};

let _reconnectAttempts = 0;
let _wasDisconnected   = false;
let _connecting        = false;
let _joinDone          = false;

// ====================================
// Spieler aus DOM laden
// ====================================

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

renderTable();
renderSidebar();

// ====================================
// Resize-Listener
// ====================================

let _resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(renderTable, 150);
});

// ====================================
// Einstiegspunkt
// ====================================

if (!participantId) {
    showJoinModal();
} else {
    initSession();
    connect();
}

// ====================================
// Session-Initialisierung
// ====================================

function initSession() {
    if (isModerator) {
        const modActions   = document.getElementById('moderatorActions');
        const settingsBtn  = document.getElementById('settingsBtn');
        const addTicketBtn = document.getElementById('addTicketBtn');
        if (modActions)   modActions.style.display   = 'flex';
        if (settingsBtn)  settingsBtn.style.display  = 'block';
        if (addTicketBtn) addTicketBtn.style.display = 'block';
    }

    applySettings(
        document.getElementById('settingShowTopic')?.checked        ?? false,
        document.getElementById('settingModeratorCanVote')?.checked ?? false,
        document.getElementById('settingAutoReveal')?.checked       ?? false,
        document.getElementById('settingShowOnlyTotal')?.checked    ?? true
    );

    if (participantRole === 'PRODUCT_OWNER') {
        const cardArea = document.getElementById('cardArea');
        if (cardArea) cardArea.style.display = 'none';
    }
}

// ====================================
// Join Modal
// ====================================

function _getBrowserId() {
    try {
        let id = localStorage.getItem('browserId');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('browserId', id);
        }
        return id;
    } catch (e) {
        return 'fallback-' + Math.random().toString(36).substring(2);
    }
}

function showJoinModal() {
    const modal = document.getElementById('joinModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const nameInput = document.getElementById('joinModalName');
    const btn       = document.getElementById('joinModalBtn');

    if (nameInput) {
        setTimeout(() => nameInput.focus(), 100);
        nameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') _handleJoinSubmit();
        });
    }
    if (btn) btn.addEventListener('click', _handleJoinSubmit);
}

async function _handleJoinSubmit() {
    const nameInput  = document.getElementById('joinModalName');
    const roleSelect = document.getElementById('joinModalRole');
    const errorDiv   = document.getElementById('joinModalError');
    const btn        = document.getElementById('joinModalBtn');

    if (!nameInput || !roleSelect) return;

    const name = nameInput.value.trim();
    if (!name) { if (nameInput) nameInput.focus(); return; }

    if (_joinDone) return;
    _joinDone = true;

    if (btn)      btn.disabled           = true;
    if (errorDiv) errorDiv.style.display = 'none';

    const role = roleSelect.value;

    try {
        const response = await fetch(appUrl('/api/sessions/' + roomCode + '/join'), {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, role, browserId: _getBrowserId() })
        });

        if (response.ok) {
            const data = await response.json();

            participantId   = String(data.participantId);
            participantRole = data.role || 'DEVELOPER';
            isModerator     = false;

            sessionStorage.setItem('participantId',   participantId);
            sessionStorage.setItem('isModerator',     'false');
            sessionStorage.setItem('participantRole', participantRole);
            localStorage.setItem('pp_name_' + roomCode, name);

            if (!players[participantId]) {
                players[participantId] = {
                    name, role: participantRole, moderator: false,
                    voted: false, cardValue: null, originalCardValue: null, changed: false
                };
            }

            const modal = document.getElementById('joinModal');
            if (modal) modal.style.display = 'none';

            initSession();
            renderTable();
            renderSidebar();
            connect();
        } else {
            _joinDone = false;
            if (btn) btn.disabled = false;

            let msg = globalThis.i18n?.toast?.errorJoin || 'Fehler beim Beitreten.';
            try {
                const err = await response.json();
                if (response.status === 400 && err.error) {
                    if (err.error.includes('vergeben') || err.error.includes('taken')) {
                        msg = globalThis.i18n?.toast?.errorNameTaken || err.error;
                    } else if (err.error.includes('Buchstaben') || err.error.includes('letters')) {
                        msg = globalThis.i18n?.toast?.errorNameInvalid || err.error;
                    } else {
                        msg = err.error;
                    }
                }
            } catch (_) {}

            if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
        }
    } catch (e) {
        _joinDone = false;
        if (btn) btn.disabled = false;
        const msg = globalThis.i18n?.toast?.errorJoin || 'Verbindungsfehler.';
        if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
    }
}

// ====================================
// Auto-Reconnect nach Seiten-Refresh
// ====================================

async function _ensureRegistered() {
    if (players[participantId]) return;

    const storedName = localStorage.getItem('pp_name_' + roomCode);
    if (!storedName) return;

    const storedRole = sessionStorage.getItem('participantRole') || 'DEVELOPER';
    const wasM       = isModerator;

    try {
        const res = await fetch(appUrl('/api/sessions/' + roomCode + '/join'), {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                name:      storedName,
                role:      storedRole,
                browserId: _getBrowserId()
            })
        });
        if (!res.ok) return;

        const data = await res.json();
        const newId = String(data.participantId);

        participantId   = newId;
        participantRole = data.role || storedRole;
        isModerator     = false;

        sessionStorage.setItem('participantId',   participantId);
        sessionStorage.setItem('participantRole', participantRole);
        sessionStorage.setItem('isModerator',     'false');

        if (!players[participantId]) {
            players[participantId] = {
                name:              storedName,
                role:              participantRole,
                moderator:         false,
                voted:             false,
                cardValue:         null,
                originalCardValue: null,
                changed:           false
            };
        }

        stompClient.send('/app/session/' + roomCode + '/register', {},
            JSON.stringify({ participantId }));

        if (wasM) {
            const promRes = await fetch(
                appUrl('/api/sessions/' + roomCode + '/participants/' + participantId + '/promote'),
                { method: 'POST' }
            );
            if (promRes.ok) {
                isModerator = true;
                sessionStorage.setItem('isModerator', 'true');
                if (players[participantId]) players[participantId].moderator = true;
                initSession();
            }
        }

        renderTable();
        renderSidebar();

    } catch (e) {
        console.warn('Auto-Reconnect fehlgeschlagen:', e);
    }
}

// ====================================
// WebSocket
// ====================================

function connect() {
    if (_connecting) return;
    _connecting = true;

    const socket = new SockJS(appUrl('/ws'));
    stompClient  = Stomp.over(socket);
    stompClient.debug = null;

    stompClient.connect({}, async function () {
        _connecting        = false;
        _reconnectAttempts = 0;

        if (_wasDisconnected) {
            showToast(globalThis.i18n.toast.reconnected, 'success', '', 3000);
            _wasDisconnected = false;
        }

        stompClient.subscribe('/topic/session/' + roomCode, function (message) {
            handleMessage(JSON.parse(message.body));
        }, {});

        stompClient.send('/app/session/' + roomCode + '/register', {},
            JSON.stringify({ participantId }));

        await _ensureRegistered();

        loadInitialData().catch(err => console.error('Fehler beim Laden:', err));

    }, function (error) {
        _connecting = false;
        console.error('WebSocket Verbindungsfehler:', error);
        _wasDisconnected = true;
        _reconnectAttempts++;

        const delay = Math.min(3000 * _reconnectAttempts, 15000);
        if (_reconnectAttempts === 1) {
            showToast(globalThis.i18n.toast.disconnected, 'warning',
                globalThis.i18n.toast.disconnectedSub, 0);
        }
        setTimeout(connect, delay);
    });
}

async function loadInitialData() {
    const ticketResponse = await fetch(appUrl('/api/sessions/' + roomCode + '/tickets'));
    if (ticketResponse.ok) {
        const ticketList = await ticketResponse.json();
        tickets = {};
        ticketList.forEach(t => {
            tickets[t.id] = { title: t.title, status: t.status, finalEstimate: t.finalEstimate };
        });

        applyTicketSidebarVisibility();
        renderTicketSidebar();
    }

    const stateResponse = await fetch(appUrl('/api/sessions/' + roomCode + '/state'));
    if (stateResponse.ok) {
        const state = await stateResponse.json();
        if (state.currentTicketId) {
            currentTicketId = state.currentTicketId.toString();
            const topicText = document.getElementById('topicText');
            if (topicText) topicText.textContent = state.currentTicketTitle ?? '';
        } else if (isModerator && Object.keys(tickets).length > 0) {
            const firstId = Object.keys(tickets)[0];
            selectTicket(firstId);
        }

        if (state.status === 'REVEALED' && state.votes?.length > 0) {
            showResults(state.votes);
            renderTable();
            renderSidebar();
            return;
        }

        if (state.votedParticipantIds?.length > 0) {
            state.votedParticipantIds.forEach(id => {
                if (players[id]) players[id].voted = true;
            });

            const totalCount = Object.values(players)
                .filter(p => p.role !== 'PRODUCT_OWNER').length;
            updateVoteStatus(state.votedCount, totalCount, null);
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
        case 'VOTE_UPDATE':        handleVoteUpdate(data);        break;
        case 'REVEAL':             showResults(data.votes);       break;
        case 'DISCUSSION_UPDATE':  updateDiscussion(data.participantId, data.participantName, data.cardValue); break;
        case 'RESET':              handleReset();                 break;
        case 'SETTINGS_UPDATE':    handleSettingsUpdate(data);    break;
        case 'PLAYER_JOINED':      handlePlayerJoined(data);      break;
        case 'PLAYER_LEFT':        handlePlayerLeft(data);        break;
        case 'MODERATOR_PROMOTED': handleModeratorPromoted(data); break;
        case 'MODERATOR_DEMOTED':  handleModeratorDemoted(data);  break;
        case 'TICKET_ADDED':       handleTicketAdded(data);       break;
        case 'TICKET_SELECTED':    handleTicketSelected(data);    break;
    }
}

function handleReset() {
    resetUI();
    showToast(globalThis.i18n.toast.newround, 'info', '', 2500);
}

function handleSettingsUpdate(data) {
    applySettings(data.showTopic, data.moderatorCanVote, data.autoReveal, data.showOnlyTotal);
    showToast(globalThis.i18n.toast.settings, 'info', '', 2500);
}

function handleTicketAdded(data) {
    tickets[data.id] = { title: data.title, status: data.status, finalEstimate: '' };
    applyTicketSidebarVisibility();
    const showTopicEl = document.getElementById('settingShowTopic');
    const topicBar    = document.getElementById('topicBar');
    if (topicBar && showTopicEl && showTopicEl.checked && currentTicketId) {
        topicBar.style.display = 'flex';
    }
    renderTicketSidebar();
    showToast(globalThis.i18n.toast.ticketAdded + ' ' + escapeHtml(data.title), 'success', '', 3000);
}

function handleTicketSelected(data) {
    currentTicketId = data.id;
    const topicText   = document.getElementById('topicText');
    const showTopicEl = document.getElementById('settingShowTopic');
    const topicBar    = document.getElementById('topicBar');
    if (topicText) topicText.textContent = data.title;
    if (topicBar && showTopicEl) topicBar.style.display = showTopicEl.checked ? 'flex' : 'none';
    resetUI();
    renderTicketSidebar();
    showToast(globalThis.i18n.toast.ticketSelected + ' ' + escapeHtml(data.title), 'info', '', 2500);
}

function handleVoteUpdate(data) {
    updateVoteStatus(data.votedCount, data.totalCount, data.voterId);
}

function handlePlayerJoined(data) {
    const isNew = !players[data.participantId];

    if (isNew) {
        players[data.participantId] = {
            name:              data.participantName,
            role:              data.participantRole || 'DEVELOPER',
            moderator:         false,
            voted:             false,
            cardValue:         null,
            originalCardValue: null,
            changed:           false
        };
        if (data.participantId !== participantId) {
            showToast(
                globalThis.i18n.toast.joined.replace('{0}', escapeHtml(data.participantName)),
                'info', getRoleLabel(data.participantRole), 3000
            );
        }
    } else {
        players[data.participantId].name = data.participantName;
        players[data.participantId].role = data.participantRole || players[data.participantId].role;
    }

    const votedCount = Object.values(players).filter(p => p.voted).length;
    const totalCount = Object.values(players).filter(p => p.role !== 'PRODUCT_OWNER').length;
    updateVoteStatus(votedCount, totalCount, null);
}

function handlePlayerLeft(data) {
    if (players[data.participantId]) {
        const leftName = players[data.participantId].name;
        delete players[data.participantId];
        showToast(
            globalThis.i18n.toast.left.replace('{0}', escapeHtml(leftName)),
            'warning', '', 3000
        );
    }
    const votedCount = Object.values(players).filter(p => p.voted).length;
    const totalCount = Object.values(players).filter(p => p.role !== 'PRODUCT_OWNER').length;
    updateVoteStatus(votedCount, totalCount, null);
}

function handleModeratorPromoted(data) {
    if (players[data.participantId]) {
        players[data.participantId].moderator = true;
    }
    if (data.participantId === participantId) {
        isModerator = true;
        const modActions   = document.getElementById('moderatorActions');
        const settingsBtn  = document.getElementById('settingsBtn');
        const addTicketBtn = document.getElementById('addTicketBtn');
        if (modActions)   modActions.style.display   = 'flex';
        if (settingsBtn)  settingsBtn.style.display  = 'block';
        if (addTicketBtn) addTicketBtn.style.display = 'block';
    } else {
        showToast(
            globalThis.i18n.toast.moderatorPromoted.replace('{0}', escapeHtml(data.participantName)),
            'info', '', 3000
        );
    }
    renderSidebar();
}

function handleModeratorDemoted(data) {
    if (players[data.participantId]) {
        players[data.participantId].moderator = false;
    }
    if (data.participantId === participantId) {
        isModerator = false;
        sessionStorage.setItem('isModerator', 'false');
        const modActions   = document.getElementById('moderatorActions');
        const settingsBtn  = document.getElementById('settingsBtn');
        const addTicketBtn = document.getElementById('addTicketBtn');
        if (modActions)   modActions.style.display   = 'none';
        if (settingsBtn)  settingsBtn.style.display  = 'none';
        if (addTicketBtn) addTicketBtn.style.display = 'none';
    }
    renderSidebar();
}