// ====================================
// Ticket-Sidebar
// ====================================

function renderTicketSidebar() {
    const ul = document.getElementById('ticketSidebarList');
    ul.innerHTML = '';

    Object.entries(tickets).forEach(([id, ticket]) => {
        const isActive = id === currentTicketId?.toString();
        const isVoted  = ticket.status === 'VOTED';
        const isUrl = ticket.title.startsWith('http://') || ticket.title.startsWith('https://');

        const li = document.createElement('li');
        li.className = 'ticket-sidebar__item'
            + (isActive ? ' ticket-sidebar__item--active' : '')
            + (isVoted  ? ' ticket-sidebar__item--voted'  : '');

        const linkLabel = (() => {
            try {
                const url = new URL(ticket.title);
                return url.pathname.split('/').findLast(Boolean) || ticket.title;
            } catch {
                return ticket.title;
            }
        })();

        const titleHtml = isUrl
            ? `<a href="${escapeHtml(ticket.title)}" 
          target="_blank" 
          rel="noopener noreferrer"
          class="ticket-sidebar__link"
          title="${escapeHtml(ticket.title)}">
           ${escapeHtml(linkLabel)}
       </a>`
            : `<span class="ticket-sidebar__title">${escapeHtml(ticket.title)}</span>`;

        li.innerHTML = `
            ${titleHtml}
            ${isVoted && ticket.finalEstimate
            ? `<span class="ticket-sidebar__estimate">${escapeHtml(ticket.finalEstimate)}</span>`
            : ''}
        `;

        if (isModerator && !isVoted) {
            li.style.cursor = 'pointer';
            li.onclick = (e) => {
                if (e.target.closest('a')) return;
                selectTicket(id);
            };
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
    document.getElementById('addTicketBtn').style.display  = 'none';
    document.getElementById('newTicketInput').focus();
}

function cancelAddTicket() {
    document.getElementById('addTicketForm').style.display = 'none';
    document.getElementById('addTicketBtn').style.display  = 'block';
    document.getElementById('newTicketInput').value        = '';
}

function submitNewTicket() {
    const title = document.getElementById('newTicketInput').value.trim();
    if (!title) return;
    stompClient.send('/app/session/' + roomCode + '/ticket/add', {},
        JSON.stringify({ title }));
    cancelAddTicket();
}