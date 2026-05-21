// ====================================
// Ticket-Sidebar
// ====================================

function renderTicketSidebar() {
    const ul = document.getElementById('ticketSidebarList');
    ul.innerHTML = '';

    Object.entries(tickets).forEach(([id, ticket]) => {
        const isActive = id === currentTicketId?.toString();
        const isVoted  = ticket.status === 'VOTED';

        const li = document.createElement('li');
        li.className = 'ticket-sidebar__item'
            + (isActive ? ' ticket-sidebar__item--active' : '')
            + (isVoted  ? ' ticket-sidebar__item--voted'  : '');

        li.innerHTML = `
            <span class="ticket-sidebar__title">${escapeHtml(ticket.title)}</span>
            ${isVoted && ticket.finalEstimate
            ? `<span class="ticket-sidebar__estimate">${escapeHtml(ticket.finalEstimate)}</span>`
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