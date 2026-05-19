// ================================
// Session erstellen (ohne Tickets)
// ================================
document.getElementById('createForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const moderatorName = document.getElementById('moderatorName').value.trim();
    const method = document.getElementById('method').value;
    const moderatorRole = document.getElementById('moderatorRole').value;

    if (!moderatorName) return;

    const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({moderatorName, method, moderatorRole})
    });

    if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('participantId', data.participantId);
        sessionStorage.setItem('isModerator', 'true');
        sessionStorage.setItem('participantRole', data.moderatorRole);
        window.location.href = '/session/' + data.roomCode;
    } else {
        alert('Fehler beim Erstellen der Session.');
    }
});

// ================================
// Session erstellen (mit Tickets)
// ================================
document.getElementById('createWithTicketsForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const moderatorName = document.getElementById('moderatorNameTickets').value.trim();
    const method = document.getElementById('methodTickets').value;
    const ticketInputs = document.querySelectorAll('.ticket-input');
    const tickets = Array.from(ticketInputs)
        .map(input => input.value.trim())
        .filter(title => title.length > 0);

    if (!moderatorName || tickets.length === 0) {
        alert('Bitte Name und mindestens ein Ticket eingeben.');
        return;
    }

    const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({moderatorName, method, tickets})
    });

    if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('participantId', data.participantId);
        sessionStorage.setItem('isModerator', 'true');
        sessionStorage.setItem('participantRole', data.moderatorRole);
        window.location.href = '/session/' + data.roomCode;
    } else {
        alert('Fehler beim Erstellen der Session.');
    }
});

// ================================
// Session beitreten
// ================================
document.getElementById('joinForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('participantName').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    const role = document.getElementById('participantRole').value;

    if (!name || !roomCode) return;

    const response = await fetch(`/api/sessions/${roomCode}/join`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, role})
    });

    if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('participantId', data.participantId);
        sessionStorage.setItem('isModerator', 'false');
        sessionStorage.setItem('participantRole', data.role);
        window.location.href = '/session/' + roomCode;
    } else {
        alert('Session nicht gefunden oder bereits beendet.');
    }
});

// ================================
// Ticket-Felder dynamisch
// ================================
function addTicketField() {
    const list = document.getElementById('ticketList');
    const entry = document.createElement('div');
    entry.className = 'ticket-entry';
    entry.innerHTML = `
        <input class="form__input ticket-input" type="text"
               placeholder="Ticket-Titel eingeben">
        <button type="button" class="btn--remove" onclick="removeTicket(this)">✕</button>
    `;
    list.appendChild(entry);
}

function removeTicket(btn) {
    const list = document.getElementById('ticketList');
    if (list.children.length > 1) {
        btn.parentElement.remove();
    }
}