// ====================================
// Hilfsfunktionen
// ====================================

function getBrowserId() {
    let id = localStorage.getItem('browserId');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('browserId', id);
    }
    return id;
}

function handleSessionCreated(data) {
    sessionStorage.setItem('participantId',   data.participantId);
    sessionStorage.setItem('isModerator',     'true');
    sessionStorage.setItem('participantRole', data.moderatorRole);
    globalThis.location.href = '/session/' + data.roomCode;
}

// ====================================
// Session erstellen (ohne Tickets)
// ====================================

document.getElementById('createForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const moderatorName = document.getElementById('moderatorName').value.trim();
    const method        = document.getElementById('method').value;
    const moderatorRole = document.getElementById('moderatorRole').value;

    if (!moderatorName) return;

    const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderatorName, method, moderatorRole, browserId: getBrowserId() })
    });

    if (response.ok) {
        const data = await response.json();
        handleSessionCreated(data);
    } else {
        let msg = globalThis.i18n.toast.errorCreate;
        try { const err = await response.json(); if (err.error) msg = err.error; } catch {}
        showToast(msg, 'error');
    }
});

// ====================================
// Session erstellen (mit Tickets)
// ====================================

document.getElementById('createWithTicketsForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const moderatorName = document.getElementById('moderatorNameTickets').value.trim();
    const method        = document.getElementById('methodTickets').value;
    const moderatorRole = document.getElementById('moderatorRoleTickets').value;
    const tickets       = Array.from(document.querySelectorAll('.ticket-input'))
        .map(input => input.value.trim())
        .filter(title => title.length > 0);

    if (!moderatorName || tickets.length === 0) {
        showToast(globalThis.i18n.toast.errorTickets, 'warning');
        return;
    }

    const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderatorName, method, moderatorRole, tickets, browserId: getBrowserId() })
    });

    if (response.ok) {
        const data = await response.json();
        handleSessionCreated(data);
    } else {
        let msg = globalThis.i18n.toast.errorCreate;
        try { const err = await response.json(); if (err.error) msg = err.error; } catch {}
        showToast(msg, 'error');
    }
});

// ====================================
// Session beitreten
// ====================================

document.getElementById('joinForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const name     = document.getElementById('participantName').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    const role     = document.getElementById('participantRole').value;

    if (!name || !roomCode) return;

    const response = await fetch(`/api/sessions/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, browserId: getBrowserId() })
    });

    if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('participantId',   data.participantId);
        sessionStorage.setItem('isModerator',     'false');
        sessionStorage.setItem('participantRole', data.role);
        globalThis.location.href = '/session/' + roomCode;
    } else {
        let msg = globalThis.i18n.toast.errorJoin;
        try {
            const err = await response.json();
            if (response.status === 400) {
                if (err.error?.includes('vergeben') || err.error?.includes('taken')) {
                    msg = globalThis.i18n.toast.errorNameTaken;
                } else if (err.error?.includes('Buchstaben') || err.error?.includes('letters')) {
                    msg = globalThis.i18n.toast.errorNameInvalid;
                }
            }
        } catch {}
        showToast(msg, 'error');
    }
});

// ====================================
// Ticket-Felder dynamisch
// ====================================

function addTicketField() {
    const list  = document.getElementById('ticketList');
    const entry = document.createElement('div');
    entry.className = 'ticket-entry';
    const placeholder = document.getElementById('ticketPlaceholder')?.textContent || 'Ticket-Titel eingeben';
    entry.innerHTML = `
        <input class="form__input ticket-input" type="text" placeholder="${placeholder}">
        <button type="button" class="btn--remove" onclick="removeTicket(this)">&#x2715;</button>
    `;
    list.appendChild(entry);
    entry.querySelector('input').focus();
}

function removeTicket(btn) {
    const list = document.getElementById('ticketList');
    if (list.children.length > 1) {
        btn.parentElement.remove();
    }
}