// ====================================
// SVG Poker-Tisch
// ====================================

/**
 * Rendert den SVG Poker-Tisch vollständig neu.
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
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const patternColor = dark ? 'rgba(74,158,222,0.07)' : 'rgba(0,65,120,0.06)';
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
        <pattern id="cardPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="none"/>
            <circle cx="4" cy="4" r="0.8" fill="${patternColor}"/>
        </pattern>
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
    const showValue = (isRevealed && player.cardValue) || (isSelf && player.cardValue);
    const { cfg }   = _resolveCardConfig(player, isSelf, hasVoted);
    const rx = 8;

    // Alles in eine <g> Gruppe — Transform auf Gruppe funktioniert zuverlässig
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', `card-group-${id}`);
    g.style.transformOrigin = `${px}px ${py}px`;
    g.style.transformBox    = 'view-box';

    // Schatten — innerhalb der Gruppe damit er mitmacht
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    shadow.setAttribute('x', px - cardW / 2 + 2);
    shadow.setAttribute('y', py - cardH / 2 + 4);
    shadow.setAttribute('width', cardW);
    shadow.setAttribute('height', cardH);
    shadow.setAttribute('rx', rx);
    shadow.setAttribute('fill', 'rgba(0,0,0,0.4)');
    g.appendChild(shadow);

    // Karten-Rect
    const cardRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    cardRect.setAttribute('x', px - cardW / 2);
    cardRect.setAttribute('y', py - cardH / 2);
    cardRect.setAttribute('width', cardW);
    cardRect.setAttribute('height', cardH);
    cardRect.setAttribute('rx', rx);
    cardRect.setAttribute('fill', cfg.fill);
    cardRect.setAttribute('stroke', cfg.stroke);
    cardRect.setAttribute('stroke-width', '2');
    cardRect.setAttribute('id', `card-${id}`);
    g.appendChild(cardRect);

    // Dezentes Punkt-Muster auf leeren Karten (nicht abgestimmt)
    if (!showValue && !hasVoted) {
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        pattern.setAttribute('x', px - cardW / 2 + 2);
        pattern.setAttribute('y', py - cardH / 2 + 2);
        pattern.setAttribute('width', cardW - 4);
        pattern.setAttribute('height', cardH - 4);
        pattern.setAttribute('rx', rx - 2);
        pattern.setAttribute('fill', 'url(#cardPattern)');
        g.appendChild(pattern);

        // SIV-Blau Akzent-Linie oben
        const accentLine = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        accentLine.setAttribute('x', px - cardW / 2 + 8);
        accentLine.setAttribute('y', py - cardH / 2 + 7);
        accentLine.setAttribute('width', cardW - 16);
        accentLine.setAttribute('height', 2);
        accentLine.setAttribute('rx', 1);
        accentLine.setAttribute('fill', cfg.stroke);
        accentLine.setAttribute('opacity', '0.25');
        g.appendChild(accentLine);

        // Gleiche Linie unten
        const accentBottom = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        accentBottom.setAttribute('x', px - cardW / 2 + 8);
        accentBottom.setAttribute('y', py + cardH / 2 - 9);
        accentBottom.setAttribute('width', cardW - 16);
        accentBottom.setAttribute('height', 2);
        accentBottom.setAttribute('rx', 1);
        accentBottom.setAttribute('fill', cfg.stroke);
        accentBottom.setAttribute('opacity', '0.25');
        g.appendChild(accentBottom);
    }

    if (showValue) {
        // Innerer Rahmen
        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        inner.setAttribute('x', px - cardW / 2 + 4);
        inner.setAttribute('y', py - cardH / 2 + 4);
        inner.setAttribute('width', cardW - 8);
        inner.setAttribute('height', cardH - 8);
        inner.setAttribute('rx', rx - 3);
        inner.setAttribute('fill', 'none');
        inner.setAttribute('stroke', cfg.innerBorder);
        inner.setAttribute('stroke-width', '1');
        g.appendChild(inner);

        // Eckzahl
        const corner = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        corner.setAttribute('x', px - cardW / 2 + 7);
        corner.setAttribute('y', py - cardH / 2 + 13);
        corner.setAttribute('fill', cfg.cornerColor);
        corner.setAttribute('font-size', Math.max(Math.round(cardW * 0.2), 7));
        corner.setAttribute('font-weight', '700');
        corner.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
        corner.textContent = player.cardValue;
        g.appendChild(corner);

        // Hauptwert
        const cardText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        cardText.setAttribute('x', px);
        cardText.setAttribute('y', py + 1);
        cardText.setAttribute('text-anchor', 'middle');
        cardText.setAttribute('dominant-baseline', 'middle');
        cardText.setAttribute('fill', cfg.textFill);
        cardText.setAttribute('font-size', cardW > 36 ? 16 : 13);
        cardText.setAttribute('font-weight', '700');
        cardText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
        cardText.textContent = player.cardValue;
        g.appendChild(cardText);
    }

    svg.appendChild(g);
    _appendNameBadge(svg, id, player, px, py, cardH, nameFontSize, roleColor, isSelf);
}

function _resolveCardConfig(player, isSelf, hasVoted) {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isRevealed && player.cardValue) {
        if (player.changed) {
            return { cfg: {
                    fill:        dark ? '#1a0a00'               : '#fff7ed',
                    stroke:      '#f97316',
                    textFill:    dark ? '#fb923c'               : '#c2410c',
                    cornerColor: dark ? 'rgba(251,146,60,0.5)'  : 'rgba(194,65,12,0.4)',
                    innerBorder: dark ? 'rgba(249,115,22,0.3)'  : 'rgba(249,115,22,0.2)'
                }};
        }
        return { cfg: {
                fill:        dark ? '#0d1f35'                : '#eaf3fc',
                stroke:      dark ? '#4a9ede'                : '#004178',
                textFill:    dark ? '#e2f0ff'                : '#004178',
                cornerColor: dark ? 'rgba(226,240,255,0.4)'  : 'rgba(0,65,120,0.3)',
                innerBorder: dark ? 'rgba(74,158,222,0.25)'  : 'rgba(0,65,120,0.12)'
            }};
    }
    if (hasVoted) {
        return { cfg: {
                fill:        dark ? '#7f0010' : '#E1001A',
                stroke:      dark ? '#E1001A' : '#a50013',
                textFill:    '#ffffff',
                cornerColor: 'rgba(255,255,255,0.45)',
                innerBorder: 'rgba(255,255,255,0.2)'
            }};
    }
    if (isSelf) {
        return { cfg: {
                fill:        dark ? '#0d1f35'                : '#ffffff',
                stroke:      dark ? '#4a9ede'                : '#004178',
                textFill:    dark ? '#e2f0ff'                : '#004178',
                cornerColor: dark ? 'rgba(226,240,255,0.4)'  : 'rgba(0,65,120,0.3)',
                innerBorder: dark ? 'rgba(74,158,222,0.25)'  : 'rgba(0,65,120,0.1)'
            }};
    }
    // Andere Spieler — noch nicht abgestimmt
    return { cfg: {
            fill:        dark ? '#152030' : '#f0f6fc',
            stroke:      dark ? '#2e4a6a' : '#a0bcd8',
            textFill:    'transparent',
            cornerColor: 'transparent',
            innerBorder: dark ? 'rgba(74,158,222,0.1)' : 'rgba(0,65,120,0.08)'
        }};
}

function _appendNameBadge(svg, id, player, px, py, cardH, nameFontSize, roleColor, isSelf) {
    const nameY       = py + cardH / 2 + 4;
    const displayName = player.name.length > 10
        ? player.name.substring(0, 9) + '…'
        : player.name + (isSelf ? ' (Du)' : '');
    const nameW   = Math.min(displayName.length * 7 + 16, 120);
    const nameH   = nameFontSize + 10;
    const badgeRx = (nameH / 2);

    const darkBadge = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Badge-Hintergrund — passt zur Rollfarbe
    const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    badgeBg.setAttribute('x', px - nameW / 2);
    badgeBg.setAttribute('y', nameY);
    badgeBg.setAttribute('width', nameW);
    badgeBg.setAttribute('height', nameH);
    badgeBg.setAttribute('rx', badgeRx);
    badgeBg.setAttribute('fill', darkBadge ? '#0d1f35' : '#ffffff');
    badgeBg.setAttribute('stroke', roleColor);
    badgeBg.setAttribute('stroke-width', '1.5');
    svg.appendChild(badgeBg);

    // Name
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameText.setAttribute('x', px);
    nameText.setAttribute('y', nameY + nameH / 2 + 1);
    nameText.setAttribute('text-anchor', 'middle');
    nameText.setAttribute('dominant-baseline', 'middle');
    nameText.setAttribute('fill', darkBadge
        ? (isSelf ? '#7dd3fc' : '#cbd5e1')
        : (isSelf ? '#004178' : '#1a1a2e'));
    nameText.setAttribute('font-size', nameFontSize);
    nameText.setAttribute('font-weight', isSelf ? '700' : '500');
    nameText.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
    nameText.textContent = displayName;
    svg.appendChild(nameText);
}
// ====================================
// Teilnehmer-Sidebar mit verbesserten Avataren
// ====================================

/**
 * Rendert die Teilnehmer-Sidebar neu.
 * Avatare: farbiger Außenring nach Rolle, Status-Badge unten rechts.
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
    const isSelfEntry        = id === participantId;
    const hasVoted           = player.voted;
    const avatarBg           = getAvatarColor(player.name);
    const roleColor          = ROLE_COLORS[player.role] || '#004178';
    const isAlreadyModerator = player.moderator || (isSelfEntry && isModerator);
    const canDemote          = isAlreadyModerator && activeModerators > 1;

    // Status-Badge: Farbe + Symbol
    const statusColor  = player.role === 'PRODUCT_OWNER' ? 'transparent'
        : hasVoted   ? '#22c55e'
            : '#9ca3af';
    const statusSymbol = hasVoted ? '✓' : '';

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bgBorder = isDark ? '#1e1e2e' : '#ffffff';
    const outlineColor = isAlreadyModerator ? '#eab308' : roleColor;

    const li = document.createElement('li');
    li.className = 'sidebar__item';
    li.innerHTML = `
        <div style="position:relative; flex-shrink:0; padding:3px;">
            <div style="
                width:36px; height:36px; border-radius:50%;
                background:${avatarBg};
                display:flex; align-items:center; justify-content:center;
                font-size:0.875rem; font-weight:700; color:#ffffff;
                outline: 3px solid ${outlineColor};
                outline-offset: 2px;
            ">
                ${escapeHtml(player.name.charAt(0).toUpperCase())}
            </div>
            ${player.role !== 'PRODUCT_OWNER' ? `
            <div style="
                position:absolute; bottom:1px; right:1px;
                width:14px; height:14px; border-radius:50%;
                background:${statusColor};
                border:2px solid ${bgBorder};
                display:flex; align-items:center; justify-content:center;
                font-size:8px; font-weight:700; color:#ffffff; line-height:1;
                z-index:1;
            ">${statusSymbol}</div>` : ''}
        </div>
        <div class="player-info">
            <span class="player-info__name ${isSelfEntry ? 'player-info__name--self' : ''}">
                ${escapeHtml(player.name)}${isSelfEntry ? ' (' + (window.i18n?.labels?.you || 'Sie') + ')' : ''}
            </span>
            <span class="player-info__role" style="color:${roleColor};">
                ${getRoleLabel(player.role)}${isAlreadyModerator ? ' · ' + (window.i18n?.labels?.moderator || 'Moderator') + ' ⭐' : ''}
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
                    ${escapeHtml(player.cardValue)}
                </span>`;
    }
    if (player.role === 'PRODUCT_OWNER') return '';
    return `<div class="player-status
                ${player.changed ? 'player-status--changed'  :
        hasVoted       ? 'player-status--voted'    :
            'player-status--waiting'}">
            </div>`;
}

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

// ====================================
// Sync
// ====================================

function syncStatusToSvg() {
    const svgProgress  = document.getElementById('svgProgressBar');
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