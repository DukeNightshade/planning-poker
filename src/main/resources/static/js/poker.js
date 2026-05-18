// ================================
// Sessiondaten aus DOM laden
// ================================
const sessionData = document.getElementById('sessionData');
const roomCode = sessionData.dataset.roomcode;
const participantId = sessionStorage.getItem('participantId');
const isModerator = sessionStorage.getItem('isModerator') === 'true';

let selectedCard = null;
let stompClient = null;

// ================================
// Moderator-Aktionen einblenden
// ================================
if (isModerator) {
    document.getElementById('moderatorActions').style.display = 'flex';
    document.getElementById('settingsBtn').style.display = 'block';
}

// Settings initial anwenden
applySettings(
    document.getElementById('settingShowTopic').checked,
    document.getElementById('settingModeratorCanVote').checked,
    document.getElementById('settingAutoReveal').checked
);

// ================================
// WebSocket Verbindung aufbauen
// ================================
function connect() {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null; // Konsolen-Spam unterdrücken

    stompClient.connect({}, function () {
        stompClient.subscribe('/topic/session/' + roomCode, function (message) {
            handleMessage(JSON.parse(message.body));
        });
    }, function (error) {
        console.error('WebSocket Verbindungsfehler:', error);
        setTimeout(connect, 3000); // Automatisch neu verbinden
    });
}

// ================================
// Nachrichten verarbeiten
// ================================
function handleMessage(data) {
    switch (data.type) {
        case 'VOTE_UPDATE':
            document.getElementById('voteStatus').textContent =
                `${data.votedCount} von ${data.totalCount} haben abgestimmt`;
            break;

        case 'REVEAL':
            showResults(data.votes);
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
    }
}

// ================================
// Karte wählen
// ================================
function selectCard(button) {
    // Vorherige Auswahl zurücksetzen
    document.querySelectorAll('.card-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    button.classList.add('selected');
    selectedCard = button.dataset.value;

    // Vote senden
    stompClient.send(
        '/app/session/' + roomCode + '/vote',
        {},
        JSON.stringify({
            participantId: participantId,
            cardValue: selectedCard
        })
    );
}

// ================================
// Karten aufdecken (Moderator)
// ================================
function revealCards() {
    stompClient.send('/app/session/' + roomCode + '/reveal', {}, {});
}

// ================================
// Neue Runde (Moderator)
// ================================
function resetRound() {
    stompClient.send('/app/session/' + roomCode + '/reset', {}, {});
}

// ================================
// Topic setzen (Moderator)
// ================================
function updateTopic() {
    const topic = document.getElementById('topicInput').value.trim();
    if (!topic) return;

    stompClient.send(
        '/app/session/' + roomCode + '/topic',
        {},
        JSON.stringify({topic})
    );

    document.getElementById('topicInput').value = '';
}

// ================================
// Ergebnisse anzeigen
// ================================
function showResults(votes) {
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
    document.getElementById('cardArea').style.display = 'none';
}

// ================================
// UI zurücksetzen
// ================================
function resetUI() {
    selectedCard = null;
    document.getElementById('resultsArea').style.display = 'none';
    document.getElementById('cardArea').style.display = 'block';
    document.getElementById('voteStatus').textContent = 'Warte auf Abstimmung...';
    document.getElementById('topicText').textContent = 'Kein Ticket gewählt';
    document.querySelectorAll('.card-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// ================================
// Settings Panel
// ================================
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function saveSettings() {
    const showTopic = document.getElementById('settingShowTopic').checked;
    const moderatorCanVote = document.getElementById('settingModeratorCanVote').checked;
    const autoReveal = document.getElementById('settingAutoReveal').checked;

    stompClient.send(
        '/app/session/' + roomCode + '/settings',
        {},
        JSON.stringify({showTopic, moderatorCanVote, autoReveal})
    );
}

function applySettings(showTopic, moderatorCanVote, autoReveal) {
    // Ticket-Modul
    const topicSection = document.querySelector('.session__topic');
    if (topicSection) topicSection.style.display = showTopic ? 'block' : 'none';

    // Ticket-Eingabe in Moderator-Aktionen
    const topicForm = document.querySelector('.session__actions .form');
    if (topicForm) topicForm.style.display = showTopic ? 'flex' : 'none';

    // Moderator-Voting
    if (isModerator && !moderatorCanVote) {
        document.getElementById('cardArea').style.display = 'none';
    } else {
        document.getElementById('cardArea').style.display = 'block';
    }

    // Checkboxen synchronisieren
    document.getElementById('settingShowTopic').checked = showTopic;
    document.getElementById('settingModeratorCanVote').checked = moderatorCanVote;
    document.getElementById('settingAutoReveal').checked = autoReveal;
}

// ================================
// Start
// ================================
connect();