/* global appUrl, getBrowserId, showToast, escapeHtml, enhanceSelect,
          getRememberedTeamRooms, rememberTeamRoom, forgetTeamRoom */

// ====================================
// Gemerkte Eingaben
// ====================================

// Nur die Rolle wird vorbelegt, der Name bewusst nicht
const LAST_ROLE_KEY = 'pp_last_role';

function _storage(key, value) {
    try {
        if (value === undefined) return localStorage.getItem(key);
        localStorage.setItem(key, value);
    } catch (e) { /* ohne localStorage nur ohne Vorbelegung */ }
    return null;
}

(function prefill() {
    const role = _storage(LAST_ROLE_KEY);
    if (role) document.getElementById('moderatorRole').value = role;
})();

// ====================================
// Gemerkte Team-Räume als Chips
// ====================================

function renderTeamRooms() {
    const teams   = getRememberedTeamRooms();
    const section = document.getElementById('teamRooms');
    const chips   = document.getElementById('teamRoomChips');
    section.style.display = teams.length > 0 ? '' : 'none';

    const forgetLabel = escapeHtml(globalThis.i18n?.home?.forgetTeam || 'Aus der Liste entfernen');
    chips.innerHTML = teams.map(name => `
        <span class="home-teams__chip">
            <a href="${appUrl('/team/' + encodeURIComponent(name))}">${escapeHtml(name)}</a>
            <button type="button" data-team="${escapeHtml(name)}"
                    title="${forgetLabel}" aria-label="${forgetLabel}">✕</button>
        </span>`).join('');

    chips.querySelectorAll('button[data-team]').forEach(btn =>
        btn.addEventListener('click', () => {
            forgetTeamRoom(btn.dataset.team);
            renderTeamRooms();
        }));
}

renderTeamRooms();

// Gestaltete Dropdowns (nach der Vorbelegung, damit sie den Wert übernehmen)
enhanceSelect(document.getElementById('moderatorRole'));
enhanceSelect(document.getElementById('method'));

// ====================================
// Team-Raum-Schalter
// ====================================

const teamToggle    = document.getElementById('teamToggle');
const teamFields    = document.getElementById('teamFields');
const teamNameInput = document.getElementById('teamNameInput');

/** Gleiche Regeln wie StringUtils.sanitizeTeamName auf dem Server. */
function _toTeamName(input) {
    return input.trim().toLowerCase()
        .replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss')
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');
}

teamToggle.addEventListener('change', () => {
    teamFields.style.display = teamToggle.checked ? '' : 'none';
    teamNameInput.required   = teamToggle.checked;
    if (teamToggle.checked) teamNameInput.focus();
});
// Hinter "/team/" steht nach dem Verlassen genau der spätere Link, z. B. "mein-team"
teamNameInput.addEventListener('blur', () => {
    teamNameInput.value = _toTeamName(teamNameInput.value);
});

// ====================================
// Tickets vorbereiten (Dialog)
// ====================================

const ticketDialog = document.getElementById('ticketDialog');

function _ticketTitles() {
    return Array.from(document.querySelectorAll('.ticket-input'))
        .map(input => input.value.trim())
        .filter(title => title.length > 0);
}

function _onTicketDialogKey(e) {
    if (e.key === 'Escape') closeTicketDialog();
}

function openTicketDialog() {
    ticketDialog.style.display = 'flex';
    document.addEventListener('keydown', _onTicketDialogKey);
    document.querySelector('.ticket-input')?.focus();
}

function closeTicketDialog() {
    ticketDialog.style.display = 'none';
    document.removeEventListener('keydown', _onTicketDialogKey);

    const count = _ticketTitles().length;
    const texts = globalThis.i18n.home;
    document.getElementById('ticketsBtnText').textContent = count > 0
        ? texts.ticketsCount.replace('{0}', count)
        : texts.ticketsNone;
    document.getElementById('ticketsBtn').focus();
}

ticketDialog.addEventListener('click', e => { if (e.target === ticketDialog) closeTicketDialog(); });

// ====================================
// Session starten
// ====================================

document.getElementById('createForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const moderatorName = document.getElementById('moderatorName').value.trim();
    const moderatorRole = document.getElementById('moderatorRole').value;
    const method        = document.getElementById('method').value;
    const teamName      = teamToggle.checked ? teamNameInput.value.trim() : '';
    const tickets       = Array.from(document.querySelectorAll('.ticket-input'))
        .map(input => input.value.trim())
        .filter(title => title.length > 0);

    if (!moderatorName) return;

    const response = await fetch(appUrl('/api/sessions'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            moderatorName, method, moderatorRole, tickets, teamName,
            browserId: getBrowserId()
        })
    });

    if (response.ok) {
        _handleSessionCreated(await response.json(), moderatorName);
        return;
    }

    let msg = globalThis.i18n.toast.errorCreate;
    if (response.status === 429) {
        msg = globalThis.i18n.toast.errorRateLimit;
    } else {
        try { const err = await response.json(); if (err.error) msg = err.error; } catch { /* Standardtext */ }
    }
    showToast(msg, 'error');
});

function _handleSessionCreated(data, moderatorName) {
    sessionStorage.setItem('participantId',    data.participantId);
    sessionStorage.setItem('participantToken', data.token);
    sessionStorage.setItem('participantRoom',  data.roomCode);
    sessionStorage.setItem('isModerator',      'true');
    sessionStorage.setItem('participantRole',  data.moderatorRole);
    _storage('pp_name_' + data.roomCode, moderatorName);
    _storage('pp_role_' + data.roomCode, data.moderatorRole);
    _storage(LAST_ROLE_KEY, data.moderatorRole);

    if (data.teamName) {
        rememberTeamRoom(data.teamName);
        globalThis.location.href = appUrl('/team/' + data.teamName);
    } else {
        globalThis.location.href = appUrl('/session/' + data.roomCode);
    }
}

// ====================================
// Beitreten per Raumcode oder Team-Name
// ====================================

document.getElementById('joinForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const query = document.getElementById('joinQuery').value.trim();
    if (!query) return;
    // Der Server löst auf, ob es ein Team-Name oder ein Raumcode ist
    globalThis.location.href = appUrl('/join/' + encodeURIComponent(query));
});

(function showNotFound() {
    const notFound = new URLSearchParams(globalThis.location.search).get('notfound');
    if (!notFound) return;
    showToast((globalThis.i18n.toast.notFound || '"{0}" nicht gefunden.').replace('{0}', notFound), 'warning');
    document.getElementById('joinQuery').value = notFound;
})();

// ====================================
// Ticket-Felder dynamisch
// ====================================

function addTicketField() {
    const list  = document.getElementById('ticketList');
    const entry = document.createElement('div');
    entry.className = 'ticket-entry';
    const placeholder = document.getElementById('ticketPlaceholder')?.textContent || 'Ticket-Titel eingeben';
    entry.innerHTML = `
        <input class="form__input ticket-input" type="text" maxlength="255" placeholder="${escapeHtml(placeholder)}">
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
