// ================================
// Session erstellen
// ================================
document.getElementById('createForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const moderatorName = document.getElementById('moderatorName').value.trim();
    const method = document.getElementById('method').value;

    if (!moderatorName) return;

    const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({moderatorName, method})
    });

    if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('participantId', data.participantId);
        sessionStorage.setItem('isModerator', 'true');
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

    if (!name || !roomCode) return;

    const response = await fetch(`/api/sessions/${roomCode}/join`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name})
    });

    if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('participantId', data.participantId);
        sessionStorage.setItem('isModerator', 'false');
        window.location.href = '/session/' + roomCode;
    } else {
        alert('Session nicht gefunden oder bereits beendet.');
    }
});