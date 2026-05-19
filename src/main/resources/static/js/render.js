// ====================================
// SVG Poker-Tisch
// ====================================

/**
 * Rendert den SVG Poker-Tisch vollständig neu.
 * Beinhaltet Ellipse, Status-Anzeige, Fortschrittsbalken und Spielerkarten.
 */
function renderTable() {
    const container = document.getElementById('pokerTable');
    container.innerHTML = '';

    const playerList = Object.entries(players);
    const total      = playerList.length;

    const tableRx    = 200;
    const tableRy    = 110;
    const baseOrbitRx = tableRx + 110;
    const baseOrbitRy = tableRy + 100;
    const minSpacing  = 65;

    const circumference = 2 * Math.PI * Math.sqrt(
        (baseOrbitRx ** 2 + baseOrbitRy ** 2) / 2);
    const scaleFactor = Math.max(1, (total * minSpacing) / circumference);
    const orbitRx = baseOrbitRx * scaleFactor;
    const orbitRy = baseOrbitRy * scaleFactor;

    const W  = Math.max(900, orbitRx * 2 + 200);
    const H  = Math.max(500, orbitRy * 2 + 200);
    const cx = W / 2;
    const cy = H / 2;

    const cardW        = total <= 6 ? 44 : total <= 10 ? 38 : total <= 15 ? 32 : 26;
    const cardH        = Math.round(cardW * 1.4);
    const nameFontSize = total <= 8 ? 12 : total <= 14 ? 10 : 9;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';

    _appendDefs(svg);
    _appendTableEllipse(svg, cx, cy, tableRx, tableRy);

    if (isRevealed) {
        _renderTableStats(svg, cx, cy, recalculateStats());
    } else {
        _appendVoteStatus(svg, cx, cy);
        _appendProgressBar(svg, cx, cy);
    }

    if (total > 0) {
        playerList.forEach(([id, player], index) => {
            const angle = (2 * Math.PI * index / total) - Math.PI / 2;
            const px    = cx + orbitRx * Math.cos(angle);
            const py    = cy + orbitRy * Math.sin(angle);
            _appendPlayerCard(svg, id, player, px, py, cardW, cardH, nameFontSize);
        });
    }

    container.appendChild(svg);
    syncStatusToSvg();
}

// ====================================
// SVG Hilfsfunktionen — Tisch
// ====================================

function _appendDefs(svg) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <radialGradient id="tableGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%"   stop-color="#005aa7"/>
            <stop offset="100%" stop-color="#003060"/>
        </radialGradient>
        <filter id="tableShadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="12"
                          flood-color="rgba(0,48,96,0.4)"/>
        </filter>
    `;
    svg.appendChild(defs);
}

function _appendTableEllipse(svg, cx, cy, rx, ry) {
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('cx', cx);
    ellipse.setAttribute('cy', cy);
    ellipse.setAttribute('rx', rx);
    ellipse.setAttribute('ry', ry);
    ellipse.setAttribute('fill', 'url(#tableGrad)');
    ellipse.setAttribute('filter', 'url(#tableShadow)');
    svg.appendChild(ellipse);
}

function _appendVoteStatus(svg, cx, cy) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy + 6);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', '16');
    text.setAttribute('font-weight', '600');
    text.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
    text.setAttribute('id', 'svgVoteStatus');
    text.textContent = document.getElementById('voteStatus').textContent;
    svg.appendChild(text);
}

function _appendProgressBar(svg, cx, cy) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', cx - 70);
    bg.setAttribute('y', cy + 20);
    bg.setAttribute('width', 140);
    bg.setAttribute('height', 5);
    bg.setAttribute('rx', 3);
    bg.setAttribute('fill', 'rgba(255,255,255,0.2)');
    svg.appendChild(bg);

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    fill.setAttribute('x', cx - 70);
    fill.setAttribute('y', cy + 20);
    fill.setAttribute('width', 0);
    fill.setAttribute('height', 5);
    fill.setAttribute('rx', 3);
    fill.setAttribute('fill', '#E1001A');
    fill.setAttribute('id', 'svgProgressBar');
    svg.appendChild(fill);
}

// ====================================
// SVG Hilfsfunktionen — Stats
// ====================================

function _renderTableStats(svg, cx, cy, stats) {
    if (!stats.devAvg && !stats.testerAvg) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', cx);
        t.setAttribute('y', cy + 6);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('fill', 'rgba(255,255,255,0.6)');
        t.setAttribute('font-size', '14');
        t.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
        t.textContent = 'Keine numerischen Werte';
        svg.appendChild(t);
        return;
    }

    const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    divider.setAttribute('x1', cx); divider.setAttribute('y1', cy - 28);
    divider.setAttribute('x2', cx); divider.setAttribute('y2', cy + 28);
    divider.setAttribute('stroke', 'rgba(255,255,255,0.2)');
    divider.setAttribute('stroke-width', '1');
    svg.appendChild(divider);

    if (stats.devAvg) {
        _renderStatBlock(svg, cx - 55, cy, '⚙ Dev',
            stats.devAvg, stats.devSpread, '#60a5fa');
    }
    if (stats.testerAvg) {
        _renderStatBlock(svg, cx + 55, cy, '✓ Test',
            stats.testerAvg, stats.testerSpread, '#4ade80');
    }
}

function _renderStatBlock(svg, x, y, label, avg, spread, color) {
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', x);
    labelText.setAttribute('y', y - 18);
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('fill', color);
    labelText.setAttribute('font-size', '11');
    labelText.setAttribute('font-weight', '700');
    labelText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
    labelText.textContent = label;
    svg.appendChild(labelText);

    const avgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    avgText.setAttribute('x', x);
    avgText.setAttribute('y', y + 8);
    avgText.setAttribute('text-anchor', 'middle');
    avgText.setAttribute('fill', 'white');
    avgText.setAttribute('font-size', '22');
    avgText.setAttribute('font-weight', '700');
    avgText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
    avgText.textContent = `Ø ${avg}`;
    svg.appendChild(avgText);

    if (spread !== null) {
        const spreadText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        spreadText.setAttribute('x', x);
        spreadText.setAttribute('y', y + 26);
        spreadText.setAttribute('text-anchor', 'middle');
        spreadText.setAttribute('fill', 'rgba(255,255,255,0.55)');
        spreadText.setAttribute('font-size', '11');
        spreadText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
        spreadText.textContent = `↕ ${spread}`;
        svg.appendChild(spreadText);
    }
}

// ====================================
// SVG Hilfsfunktionen — Spielerkarten
// ====================================

function _appendPlayerCard(svg, id, player, px, py, cardW, cardH, nameFontSize) {
    const isSelf    = id === participantId;
    const hasVoted  = player.voted;
    const roleColor = ROLE_COLORS[player.role] || '#004178';

    const { cardFill, cardStroke, textFill } =
        _resolveCardColors(player, isSelf, hasVoted);

    const cardRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    cardRect.setAttribute('x', px - cardW / 2);
    cardRect.setAttribute('y', py - cardH / 2);
    cardRect.setAttribute('width', cardW);
    cardRect.setAttribute('height', cardH);
    cardRect.setAttribute('rx', 5);
    cardRect.setAttribute('fill', cardFill);
    cardRect.setAttribute('stroke', cardStroke);
    cardRect.setAttribute('stroke-width', '2');
    cardRect.setAttribute('id', `card-${id}`);
    svg.appendChild(cardRect);

    if ((isRevealed && player.cardValue) || (isSelf && player.cardValue)) {
        const cardText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        cardText.setAttribute('x', px);
        cardText.setAttribute('y', py + 5);
        cardText.setAttribute('text-anchor', 'middle');
        cardText.setAttribute('fill', textFill);
        cardText.setAttribute('font-size', cardW > 36 ? 14 : 11);
        cardText.setAttribute('font-weight', '700');
        cardText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
        cardText.textContent = player.cardValue;
        svg.appendChild(cardText);
    }

    _appendNameBadge(svg, id, player, px, py, cardH, nameFontSize, roleColor, isSelf);
}

function _resolveCardColors(player, isSelf, hasVoted) {
    if (isRevealed && player.cardValue) {
        if (player.changed) {
            return { cardFill: '#fff7ed', cardStroke: '#f97316', textFill: '#c2410c' };
        }
        return { cardFill: 'white', cardStroke: '#004178', textFill: '#004178' };
    }
    if (hasVoted) {
        return { cardFill: '#E1001A', cardStroke: '#c0001a', textFill: 'white' };
    }
    if (isSelf) {
        return { cardFill: 'white', cardStroke: '#004178', textFill: '#004178' };
    }
    return { cardFill: '#c8ddf0', cardStroke: '#d0d8e4', textFill: 'transparent' };
}

function _appendNameBadge(svg, id, player, px, py, cardH, nameFontSize, roleColor, isSelf) {
    const nameY       = py + cardH / 2 + 6;
    const displayName = player.name.length > 10
        ? player.name.substring(0, 9) + '…'
        : player.name + (isSelf ? ' (Du)' : '');
    const nameW = Math.min(displayName.length * 7 + 10, 110);

    const nameBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    nameBg.setAttribute('x', px - nameW / 2);
    nameBg.setAttribute('y', nameY);
    nameBg.setAttribute('width', nameW);
    nameBg.setAttribute('height', nameFontSize + 8);
    nameBg.setAttribute('rx', 4);
    nameBg.setAttribute('fill', 'white');
    nameBg.setAttribute('opacity', '0.95');
    svg.appendChild(nameBg);

    const roleBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    roleBar.setAttribute('x', px - nameW / 2);
    roleBar.setAttribute('y', nameY);
    roleBar.setAttribute('width', 3);
    roleBar.setAttribute('height', nameFontSize + 8);
    roleBar.setAttribute('rx', 2);
    roleBar.setAttribute('fill', roleColor);
    svg.appendChild(roleBar);

    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameText.setAttribute('x', px);
    nameText.setAttribute('y', nameY + nameFontSize);
    nameText.setAttribute('text-anchor', 'middle');
    nameText.setAttribute('fill', '#1a1a2e');
    nameText.setAttribute('font-size', nameFontSize);
    nameText.setAttribute('font-weight', '600');
    nameText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
    nameText.textContent = displayName;
    svg.appendChild(nameText);
}

// ====================================
// Teilnehmer-Sidebar
// ====================================

/**
 * Rendert die Teilnehmer-Sidebar neu.
 * Sortiert nach Kartenwert (nach Aufdecken) oder alphabetisch.
 */
function renderSidebar() {
    const playerList = Object.entries(players);
    document.getElementById('sidebarTitle').textContent =
        `Teilnehmer (${playerList.length})`;

    const activeModerators = playerList.filter(([id, p]) =>
        p.moderator || (id === participantId && isModerator)
    ).length;

    const ul = document.getElementById('participantList');
    ul.innerHTML = '';

    const sorted = [...playerList].sort(([, a], [, b]) => {
        if (isRevealed && a.cardValue && b.cardValue) {
            const order = ['?', '☕', '0', '0.5', '1', '2', '3', '4', '5', '8',
                '13', '16', '20', '32', '40', '64', '100',
                'XS', 'S', 'M', 'L', 'XL', 'XXL'];
            const ai = order.indexOf(a.cardValue);
            const bi = order.indexOf(b.cardValue);
            if (ai !== -1 && bi !== -1) return ai - bi;
            return a.cardValue.localeCompare(b.cardValue);
        }
        return a.name.localeCompare(b.name);
    });

    sorted.forEach(([id, player]) =>
        ul.appendChild(_buildSidebarItem(id, player, activeModerators)));
}

function _buildSidebarItem(id, player, activeModerators) {
    const isSelfEntry       = id === participantId;
    const hasVoted          = player.voted;
    const avatarColor       = getAvatarColor(player.name);
    const roleColor         = ROLE_COLORS[player.role] || '#004178';
    const isAlreadyModerator = player.moderator || (isSelfEntry && isModerator);
    const canDemote         = isAlreadyModerator && activeModerators > 1;

    const li = document.createElement('li');
    li.className = 'sidebar__item';
    li.innerHTML = `
        <div class="player-avatar"
             style="background:${avatarColor}; border: 2px solid ${roleColor}20;">
            ${player.name.charAt(0).toUpperCase()}
        </div>
        <div class="player-info">
            <span class="player-info__name ${isSelfEntry ? 'player-info__name--self' : ''}">
                ${player.name}${isSelfEntry ? ' (Sie)' : ''}
            </span>
            <span class="player-info__role" style="color:${roleColor};">
                ${getRoleLabel(player.role)}${isAlreadyModerator ? ' · Moderator' : ''}
            </span>
        </div>
        ${_buildStatusOrValue(player, hasVoted)}
        ${isSelfEntry && !isAlreadyModerator
        ? `<button class="btn--promote" onclick="promoteMyself()"
                       title="Zum Moderator werden">↑</button>` : ''}
        ${isSelfEntry && canDemote
        ? `<button class="btn--demote" onclick="demoteParticipant('${id}')"
                       title="Moderator-Rechte abgeben">↓</button>` : ''}
        ${!isSelfEntry && isModerator && isAlreadyModerator && canDemote
        ? `<button class="btn--demote" onclick="demoteParticipant('${id}')"
                       title="Moderator-Rechte entziehen">↓</button>` : ''}
    `;
    return li;
}

function _buildStatusOrValue(player, hasVoted) {
    if (isRevealed && player.cardValue) {
        return `<span class="sidebar__card-value
                    ${player.changed ? 'sidebar__card-value--changed' : ''}">
                    ${player.cardValue}
                </span>`;
    }
    if (player.role === 'PRODUCT_OWNER') return '';
    return `<div class="player-status
                ${player.changed    ? 'player-status--changed'  :
        hasVoted          ? 'player-status--voted'    :
            'player-status--waiting'}">
            </div>`;
}

// ====================================
// Sync
// ====================================

function syncStatusToSvg() {
    const svgProgress = document.getElementById('svgProgressBar');
    const htmlProgress = document.getElementById('progressBar');
    if (svgProgress && htmlProgress) {
        const pct = parseFloat(htmlProgress.style.width) || 0;
        svgProgress.setAttribute('width', (140 * pct / 100).toString());
    }

    if (!isRevealed) {
        const svgStatus  = document.getElementById('svgVoteStatus');
        const htmlStatus = document.getElementById('voteStatus');
        if (svgStatus && htmlStatus) svgStatus.textContent = htmlStatus.textContent;
    }
}