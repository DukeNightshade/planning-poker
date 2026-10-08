/* global SockJS, Stomp, applyTicketSidebarVisibility, getParticipantToken, getBrowserId, sendWs, authHeaders,
          leavingTable, rememberTeamRoom, enhanceSelect, syncHand */

// ====================================
// Session-Daten aus DOM
// ====================================

const sessionData   = document.getElementById('sessionData');
const roomCode      = sessionData.dataset.roomcode;
const teamName      = sessionData.dataset.teamname || '';

// Die Identität im Tab gilt nur für den Raum, in dem sie entstanden ist
if (sessionStorage.getItem('participantRoom') !== roomCode) {
    ['participantId', 'participantToken', 'isModerator', 'participantRoom']
        .forEach(k => sessionStorage.removeItem(k));
}

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

let tickets       = {};
let players       = {};
let absentPlayers = {};   // nur Team-Räume: gemerkt, aber gerade nicht verbunden

let _reconnectAttempts = 0;
let _wasDisconnected   = false;
let _connecting        = false;
let _joinDone          = false;
let _joinModalBound    = false;

// ====================================
// Spieler aus DOM laden
// ====================================

document.querySelectorAll('#playerData .player-entry').forEach(el => {
    const player = _newPlayer(el.dataset.playerName, el.dataset.playerRole || 'DEVELOPER');
    player.moderator = el.dataset.playerModerator === 'true';
    if (el.dataset.playerPresent === 'false') {
        absentPlayers[el.dataset.playerId] = player;
    } else {
        players[el.dataset.playerId] = player;
    }
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

// Gestaltetes Dropdown für die Rolle im Beitrittsdialog
const joinRoleSelect = document.getElementById('joinModalRole');
if (joinRoleSelect) enhanceSelect(joinRoleSelect);

if (teamName) rememberTeamRoom(teamName);

if (participantId && getParticipantToken()) {
    initSession();
    connect();
} else if (teamName && localStorage.getItem('pp_name_' + roomCode)) {
    _autoJoinTeam();
} else {
    showJoinModal();
}

/** Team-Raum, schon einmal dabei gewesen: ohne Dialog mit gemerktem Namen beitreten. */
async function _autoJoinTeam() {
    const nameInput  = document.getElementById('joinModalName');
    const roleSelect = document.getElementById('joinModalRole');
    if (nameInput)  nameInput.value  = localStorage.getItem('pp_name_' + roomCode);
    if (roleSelect) {
        roleSelect.value = localStorage.getItem('pp_role_' + roomCode) || 'DEVELOPER';
        roleSelect.dispatchEvent(new Event('change'));
    }

    // Klappt es nicht (z. B. Name inzwischen vergeben), zeigt der Dialog den Grund
    if (!await _handleJoinSubmit()) showJoinModal();
}

// ====================================
// Session-Initialisierung
// ====================================

function initSession() {
    if (isModerator) _setModeratorUi(true);
    _setLeaveButtonVisible(true);

    applySettings(
        document.getElementById('settingShowTopic')?.checked        ?? false,
        document.getElementById('settingPoCanVote')?.checked        ?? true,
        document.getElementById('settingAutoReveal')?.checked       ?? false,
        document.getElementById('settingShowOnlyTotal')?.checked    ?? true
    );
}

// ====================================
// Join Modal
// ====================================

function showJoinModal() {
    const modal = document.getElementById('joinModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const nameInput = document.getElementById('joinModalName');
    const btn       = document.getElementById('joinModalBtn');

    if (nameInput) setTimeout(() => nameInput.focus(), 100);

    // Der Dialog kann mehrfach geöffnet werden (z. B. nach "vom Tisch genommen")
    if (_joinModalBound) return;
    _joinModalBound = true;
    if (nameInput) {
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

    if (!nameInput || !roleSelect) return false;

    const name = nameInput.value.trim();
    if (!name) { if (nameInput) nameInput.focus(); return false; }

    if (_joinDone) return false;
    _joinDone = true;

    if (btn)      btn.disabled           = true;
    if (errorDiv) errorDiv.style.display = 'none';

    const role = roleSelect.value;

    try {
        const response = await fetch(appUrl('/api/sessions/' + roomCode + '/join'), {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, role, browserId: getBrowserId() })
        });

        if (response.ok) {
            const data = await response.json();

            participantId   = String(data.participantId);
            participantRole = data.role || 'DEVELOPER';
            // Team-Raum: zurückkehrende Mitglieder behalten ihre Moderator-Rechte
            isModerator     = data.moderator === true;

            sessionStorage.setItem('participantId',   participantId);
            sessionStorage.setItem('participantToken', data.token);
            sessionStorage.setItem('participantRoom', roomCode);
            sessionStorage.setItem('isModerator',     String(isModerator));
            sessionStorage.setItem('participantRole', participantRole);
            localStorage.setItem('pp_name_' + roomCode, name);
            localStorage.setItem('pp_role_' + roomCode, participantRole);

            delete absentPlayers[participantId];
            if (!players[participantId]) {
                players[participantId] = _newPlayer(name, participantRole);
            }
            players[participantId].moderator = isModerator;

            const modal = document.getElementById('joinModal');
            if (modal) modal.style.display = 'none';
            const info = document.getElementById('joinModalInfo');
            if (info) info.style.display = 'none';

            initSession();
            renderTable();
            renderSidebar();
            // Nach "vom Tisch genommen" besteht die Verbindung noch: nur neu registrieren
            if (stompClient?.connected) {
                sendWs('/register');
                loadInitialData().catch(err => console.error('Fehler beim Laden:', err));
            } else {
                connect();
            }
            return true;
        } else {
            _joinDone = false;
            if (btn) btn.disabled = false;

            let msg = globalThis.i18n?.toast?.errorJoin || 'Fehler beim Beitreten.';
            try {
                const err = await response.json();
                if (response.status === 429) {
                    msg = globalThis.i18n?.toast?.errorRateLimit || msg;
                } else if (response.status === 400 && err.error) {
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
            return false;
        }
    } catch (e) {
        _joinDone = false;
        if (btn) btn.disabled = false;
        const msg = globalThis.i18n?.toast?.errorJoin || 'Verbindungsfehler.';
        if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
        return false;
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
                browserId: getBrowserId()
            })
        });
        if (!res.ok) return;

        const data = await res.json();
        const newId = String(data.participantId);

        participantId   = newId;
        participantRole = data.role || storedRole;
        isModerator     = false;

        sessionStorage.setItem('participantId',   participantId);
        sessionStorage.setItem('participantRoom', roomCode);
        sessionStorage.setItem('participantToken', data.token);
        sessionStorage.setItem('participantRole', participantRole);
        sessionStorage.setItem('isModerator',     'false');

        if (!players[participantId]) {
            players[participantId] = _newPlayer(storedName, participantRole);
        }

        sendWs('/register');

        if (wasM) {
            const promRes = await fetch(
                appUrl('/api/sessions/' + roomCode + '/participants/' + participantId + '/promote'),
                { method: 'POST', headers: authHeaders() }
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

        // Fehler zu eigenen Aktionen (z. B. fehlende Rechte) kommen nur an diese Verbindung
        stompClient.subscribe('/user/queue/errors', function (message) {
            const err = JSON.parse(message.body);
            showToast(err.error || globalThis.i18n.toast.errorAction, 'error');
        });

        sendWs('/register');

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

    const stateResponse = await fetch(appUrl('/api/sessions/' + roomCode + '/state'),
        { headers: authHeaders() });
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
            _refreshVoteStatus();
        }

        // Eigene, noch verdeckte Karte nach Reload wiederherstellen
        if (state.myCardValue && players[participantId]) {
            selectedCard = state.myCardValue;
            players[participantId].cardValue = state.myCardValue;
            players[participantId].voted     = true;
            document.querySelectorAll('.card-btn').forEach(btn =>
                btn.classList.toggle('selected', btn.dataset.value === state.myCardValue));
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
        case 'PLAYER_AWAY':        handlePlayerAway(data);        break;
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
    applySettings(data.showTopic, data.productOwnerCanVote, data.autoReveal, data.showOnlyTotal);
    // "Product Owner darf mitwählen" ändert, wer als stimmberechtigt zählt
    if (!isRevealed) {
        if (!data.productOwnerCanVote) _clearProductOwnerVotes();
        _refreshVoteStatus();
    }
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
    showToast(globalThis.i18n.toast.ticketAdded + ' ' + data.title, 'success', '', 3000);
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
    showToast(globalThis.i18n.toast.ticketSelected + ' ' + data.title, 'info', '', 2500);
}

function handleVoteUpdate(data) {
    updateVoteStatus(data.votedCount, data.totalCount, data.voterId);
}

function handlePlayerJoined(data) {
    delete absentPlayers[data.participantId];   // Team-Mitglied ist zurück
    const isNew = !players[data.participantId];

    if (isNew) {
        players[data.participantId] = _newPlayer(data.participantName, data.participantRole || 'DEVELOPER');
        players[data.participantId].moderator = data.moderator === true;
        if (data.participantId !== participantId) {
            showToast(
                globalThis.i18n.toast.joined.replace('{0}', data.participantName),
                'info', getRoleLabel(data.participantRole), 3000
            );
        }
    } else {
        players[data.participantId].name = data.participantName;
        players[data.participantId].role = data.participantRole || players[data.participantId].role;
    }

    _refreshVoteStatus();
}

function handlePlayerLeft(data) {
    if (data.participantId === participantId) {
        if (leavingTable) {
            // Selbst gegangen: zurück zur Startseite
            ['participantId', 'participantToken', 'isModerator'].forEach(k => sessionStorage.removeItem(k));
            globalThis.location.href = appUrl('/');
        } else {
            _handleRemovedFromTable();
        }
        return;
    }
    delete absentPlayers[data.participantId];   // Moderator hat ein abwesendes Mitglied entfernt
    if (players[data.participantId]) {
        const leftName = players[data.participantId].name;
        delete players[data.participantId];
        showToast(
            globalThis.i18n.toast.left.replace('{0}', leftName),
            'warning', '', 3000
        );
    }
    _refreshVoteStatus();
}

/** Team-Raum: Mitglied ist nicht mehr verbunden (oder für heute gegangen) – bleibt gemerkt. */
function handlePlayerAway(data) {
    if (data.participantId === participantId) {
        if (leavingTable) {
            ['participantId', 'participantToken', 'isModerator'].forEach(k => sessionStorage.removeItem(k));
            globalThis.location.href = appUrl('/');
        }
        return;   // sonst: eigene Verbindung kommt gleich zurück
    }
    const player = players[data.participantId];
    if (player) {
        player.voted     = false;
        player.cardValue = null;
        absentPlayers[data.participantId] = player;
        delete players[data.participantId];
        showToast(globalThis.i18n.toast.away.replace('{0}', player.name), 'info', '', 3000);
    }
    _refreshVoteStatus();
}

function handleModeratorPromoted(data) {
    if (players[data.participantId]) {
        players[data.participantId].moderator = true;
    }
    if (data.participantId === participantId) {
        isModerator = true;
        _setModeratorUi(true);
        syncHand();
    } else {
        showToast(
            globalThis.i18n.toast.moderatorPromoted.replace('{0}', data.participantName),
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
        _setModeratorUi(false);
        syncHand();
    }
    renderSidebar();
}
// ====================================
// Hilfsfunktionen
// ====================================

/** Eigener Platz wurde geräumt (selbst verlassen oder vom Moderator entfernt). */
function _handleRemovedFromTable() {
    delete players[participantId];
    participantId = null;
    isModerator   = false;
    selectedCard  = null;
    _joinDone     = false;
    ['participantId', 'participantToken', 'isModerator'].forEach(k => sessionStorage.removeItem(k));

    _setModeratorUi(false);
    _setLeaveButtonVisible(false);
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('selected'));
    if (!isRevealed) _refreshVoteStatus();
    renderTable();
    renderSidebar();

    const nameInput = document.getElementById('joinModalName');
    if (nameInput && !nameInput.value) nameInput.value = localStorage.getItem('pp_name_' + roomCode) || '';
    const roleSelect = document.getElementById('joinModalRole');
    if (roleSelect) {
        roleSelect.value = participantRole;
        roleSelect.dispatchEvent(new Event('change'));
    }
    const btn = document.getElementById('joinModalBtn');
    if (btn) btn.disabled = false;
    const info = document.getElementById('joinModalInfo');
    if (info) info.style.display = 'block';

    showJoinModal();
}

function _newPlayer(name, role) {
    return {
        name, role,
        moderator: false, voted: false,
        cardValue: null, originalCardValue: null, changed: false
    };
}

function _setLeaveButtonVisible(visible) {
    const btn = document.getElementById('leaveBtn');
    if (btn) btn.style.display = visible ? '' : 'none';
}

function _setModeratorUi(visible) {
    [['moderatorActions', 'flex'], ['settingsBtn', 'block'], ['addTicketBtn', 'block']]
        .forEach(([id, display]) => {
            const el = document.getElementById(id);
            if (el) el.style.display = visible ? display : 'none';
        });
}

/** Der Server verwirft die Stimmen der Product Owner, sobald sie nicht mehr mitwählen dürfen. */
function _clearProductOwnerVotes() {
    Object.entries(players).forEach(([id, p]) => {
        if (p.role !== 'PRODUCT_OWNER') return;
        p.voted     = false;
        p.cardValue = null;
        if (id === participantId) {
            selectedCard = null;
            document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('selected'));
        }
    });
}

/** Zählt die Stimmen lokal – gleiche Regel wie der Server (Product Owner nur, wenn erlaubt). */
function _refreshVoteStatus() {
    const poCanVote = document.getElementById('settingPoCanVote')?.checked ?? true;
    const voters = Object.values(players)
        .filter(p => poCanVote || p.role !== 'PRODUCT_OWNER');
    updateVoteStatus(voters.filter(p => p.voted).length, voters.length, null);
}
