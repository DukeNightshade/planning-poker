/* global participantId, isModerator, isRevealed, players, tickets, currentTicketId,
          ROLE_COLORS, recalculateStats, escapeHtml, getRoleLabel, getAvatarColor,
          selectTicket, promoteMyself, demoteParticipant, showOnlyTotal, SKIP_CARD,
          compareCardValues, voteDistribution  */

// ====================================
// Hilfsfunktionen — Auflösung
// ====================================

function _resolveCardWidth(total) {
    if (total <= 6)  return 44;
    if (total <= 10) return 38;
    if (total <= 15) return 32;
    return 26;
}

function _resolveNameFontSize(total) {
    if (total <= 8)  return 12;
    if (total <= 14) return 10;
    return 9;
}

function _resolveDisplayName(name, isSelf) {
    if (name.length > 10) return name.substring(0, 9) + '…';
    return name + (isSelf ? ' (Du)' : '');
}

function _resolveNameColor(darkBadge, isSelf) {
    if (darkBadge) return isSelf ? '#7dd3fc' : '#cbd5e1';
    return isSelf ? '#004178' : '#1a1a2e';
}

function _resolveStatusColor(role, hasVoted) {
    if (role === 'PRODUCT_OWNER') return 'transparent';
    return hasVoted ? '#22c55e' : '#9ca3af';
}

function _resolveStatusClass(changed, hasVoted) {
    if (changed)  return 'player-status--changed';
    if (hasVoted) return 'player-status--voted';
    return 'player-status--waiting';
}

// ====================================
// SVG Poker-Tisch
// ====================================

function renderTable() {
    const container = document.getElementById('pokerTable');
    container.innerHTML = '';

    const playerList = Object.entries(players);
    const total      = playerList.length;

    // Echte Container-Maße; Viewport-Fallback wenn Layout noch nicht settled
    const cW = container.clientWidth  > 10 ? container.clientWidth  : window.innerWidth  * 0.62;
    const cH = container.clientHeight > 10 ? container.clientHeight : window.innerHeight * 0.50;

    // Tisch: proportional zum Container, aber gedeckelt
    const tableRx = Math.min(cW * 0.21, 200);
    const tableRy = Math.min(cH * 0.21, 110);

    // Orbit = Tisch + Mindestabstand für Karte + Name-Badge (nie unter 80/70px)
    const gapX = Math.max(cW * 0.10, 80);
    const gapY = Math.max(cH * 0.13, 70);
    const baseOrbitRx = tableRx + gapX;
    const baseOrbitRy = tableRy + gapY;
    const minSpacing  = 65;

    const circumference = 2 * Math.PI * Math.sqrt(
        (baseOrbitRx ** 2 + baseOrbitRy ** 2) / 2);
    const scaleFactor = Math.max(1, (total * minSpacing) / circumference);
    const orbitRx = baseOrbitRx * scaleFactor;
    const orbitRy = baseOrbitRy * scaleFactor;

    // ViewBox = Container; nur bei vielen Spielern aufweiten
    const W  = Math.max(cW, orbitRx * 2 + 160);
    const H  = Math.max(cH, orbitRy * 2 + 160);
    const cx = W / 2;
    const cy = H / 2;

    const cardW        = _resolveCardWidth(total);
    const cardH        = Math.round(cardW * 1.4);
    const nameFontSize = _resolveNameFontSize(total);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width',  '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.overflow = 'visible';
    svg.setAttribute('role', 'img');

    const svgTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    svgTitle.textContent = `Pokertisch mit ${total} Teilnehmer${total === 1 ? '' : 'n'}`;
    svg.appendChild(svgTitle);

    const svgDesc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
    svgDesc.textContent = isRevealed
        ? _describeResult()
        : `Laufende Abstimmung. ${Object.values(players).filter(p => p.voted).length} von ${total} haben abgestimmt.`;
    svg.appendChild(svgDesc);

    _appendDefs(svg);
    _appendTableEllipse(svg, cx, cy, tableRx, tableRy);

    if (isRevealed) {
        _renderResult(svg, cx, cy, tableRx, tableRy);
    } else {
        _appendVoteStatus(svg, cx, cy);
        _appendProgressBar(svg, cx, cy);
    }

    if (total > 0) {
        playerList.forEach(([id, player], index) => {
            const angle = (2 * Math.PI * index / total) - Math.PI / 2;
            const px    = cx + orbitRx * Math.cos(angle);
            const py    = cy + orbitRy * Math.sin(angle);
            _appendPlayerCard(svg, id, player, { px, py }, { cardW, cardH, nameFontSize });
        });
    }

    container.appendChild(svg);
    syncStatusToSvg();
}

// ====================================
// SVG Hilfsfunktionen — Tisch
// ====================================

function _appendDefs(svg) {
    const dark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
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
    bg.setAttribute('x',      String(cx - 70));
    bg.setAttribute('y',      String(cy + 20));
    bg.setAttribute('width',  String(140));
    bg.setAttribute('height', String(5));
    bg.setAttribute('rx',     String(3));
    bg.setAttribute('fill', 'rgba(255,255,255,0.2)');
    svg.appendChild(bg);

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    fill.setAttribute('x',      String(cx - 70));
    fill.setAttribute('y',      cy + 20);
    fill.setAttribute('width',  String(0));
    fill.setAttribute('height', String(5));
    fill.setAttribute('rx',     String(3));
    fill.setAttribute('fill', '#E1001A');
    fill.setAttribute('id', 'svgProgressBar');
    svg.appendChild(fill);
}

// ====================================
// SVG Hilfsfunktionen — Ergebnis (Kartenstapel)
// ====================================

const SVG_NS      = 'http://www.w3.org/2000/svg';
const FONT_FAMILY = 'Fira Sans, Lucida Sans, sans-serif';
const STACK_GOLD  = '#facc15';
const MAX_LAYERS  = 5;

function _svgText(x, y, content, attrs) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', String(x));
    t.setAttribute('y', String(y));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-family', FONT_FAMILY);
    Object.entries(attrs).forEach(([k, v]) => t.setAttribute(k, String(v)));
    t.textContent = content;
    return t;
}

/**
 * Nach dem Aufdecken: in der Tischmitte ein Kartenstapel pro gewähltem Wert
 * (anonym, Höhe = Anzahl), darunter häufigster Wert und Durchschnitt.
 */
function _renderResult(svg, cx, cy, tableRx, tableRy) {
    const { stacks, mostCommon } = voteDistribution();

    if (stacks.length === 0) {
        svg.appendChild(_svgText(cx, cy + 6, globalThis.i18n?.labels?.noVotes || 'Keine Stimmen',
            { fill: 'rgba(255,255,255,0.6)', 'font-size': 14 }));
        return;
    }

    const baseline = cy + tableRy * 0.12;
    _appendStacks(svg, cx, baseline, tableRx, stacks, mostCommon);
    _appendResultSummary(svg, cx, baseline + Math.max(tableRy * 0.38, 34), mostCommon);
}

function _appendStacks(svg, cx, baseline, tableRx, stacks, mostCommon) {
    const dark   = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    const slotW  = (tableRx * 1.5) / stacks.length;
    const cardW  = Math.max(14, Math.min(26, slotW * 0.62));
    const cardH  = Math.round(cardW * 1.4);
    const layerY = Math.max(2, Math.round(cardW * 0.13));
    const startX = cx - (slotW * (stacks.length - 1)) / 2;

    stacks.forEach((stack, i) => {
        const x       = startX + i * slotW;
        const isSkip  = stack.value === SKIP_CARD;
        const isTop   = mostCommon.includes(stack.value);
        const { cfg } = isSkip ? _skipCardConfig(dark) : _revealedCardConfig(false, dark);
        const layers  = Math.min(stack.count, MAX_LAYERS);

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'result-stack');

        for (let l = 0; l < layers; l++) {
            const isFront = l === layers - 1;
            const card = document.createElementNS(SVG_NS, 'rect');
            card.setAttribute('x',      String(x - cardW / 2 + l));
            card.setAttribute('y',      String(baseline - cardH - l * layerY));
            card.setAttribute('width',  String(cardW));
            card.setAttribute('height', String(cardH));
            card.setAttribute('rx',     String(Math.max(3, cardW * 0.18)));
            card.setAttribute('fill',   cfg.fill);
            card.setAttribute('stroke', isFront && isTop ? STACK_GOLD : cfg.stroke);
            card.setAttribute('stroke-width', isFront && isTop ? '2.5' : '1.2');
            g.appendChild(card);
        }

        const frontY = baseline - cardH / 2 - (layers - 1) * layerY;
        g.appendChild(_svgText(x + layers - 1, frontY, stack.value, {
            fill: cfg.textFill, 'font-size': Math.round(cardW * 0.5),
            'font-weight': 700, 'dominant-baseline': 'middle'
        }));

        g.appendChild(_svgText(x, baseline + 14, `×${stack.count}`, {
            fill: isTop ? STACK_GOLD : 'rgba(255,255,255,0.7)',
            'font-size': 11, 'font-weight': isTop ? 700 : 500
        }));

        svg.appendChild(g);
    });
}

function _appendResultSummary(svg, cx, y, mostCommon) {
    const stats  = recalculateStats();
    const labels = globalThis.i18n?.labels || {};
    const parts  = [];
    if (mostCommon.length > 0) parts.push(`${labels.mostCommon || 'Meist'}: ${mostCommon.join(' / ')}`);
    if (stats.overallAvg !== null) parts.push(`Ø ${stats.overallAvg}`);

    if (parts.length > 0) {
        svg.appendChild(_svgText(cx, y, parts.join('  ·  '),
            { fill: 'white', 'font-size': 14, 'font-weight': 700 }));
    }

    // Optional: Durchschnitt je Rolle in den Rollenfarben
    if (showOnlyTotal) return;
    const roles = [
        { label: '⚙', avg: stats.devAvg,       color: '#60a5fa' },
        { label: '✓', avg: stats.testerAvg,    color: '#4ade80' },
        { label: '🏗', avg: stats.architectAvg, color: '#f9a825' }
    ].filter(r => r.avg !== null);
    if (roles.length < 2) return;

    const line = _svgText(cx, y + 18, '', { 'font-size': 11, 'font-weight': 600 });
    roles.forEach((r, i) => {
        const span = document.createElementNS(SVG_NS, 'tspan');
        span.setAttribute('fill', r.color);
        span.textContent = `${i > 0 ? '   ' : ''}${r.label} Ø ${r.avg}`;
        line.appendChild(span);
    });
    svg.appendChild(line);
}

/** Text-Zusammenfassung der Verteilung für Screenreader (SVG-desc). */
function _describeResult() {
    const { stacks } = voteDistribution();
    if (stacks.length === 0) return 'Abstimmungsergebnis: keine Stimmen.';
    return 'Abstimmungsergebnis: ' + stacks.map(s => `${s.count}× ${s.value}`).join(', ') + '.';
}

// ====================================
// SVG Hilfsfunktionen — Spielerkarten
// ====================================

function _appendPlayerCard(svg, id, player, pos, cardSize) {
    const { px, py }                     = pos;
    const { cardW, cardH, nameFontSize } = cardSize;
    const isSelf    = id === participantId;
    const hasVoted  = player.voted;
    const roleColor = ROLE_COLORS[player.role] || '#004178';
    const showValue = (isRevealed && player.cardValue) || (isSelf && player.cardValue);
    const { cfg }   = _resolveCardConfig(player, isSelf, hasVoted);
    const rx = 8;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', `card-group-${id}`);
    g.style.transformOrigin = `${px}px ${py}px`;
    g.style.transformBox    = 'view-box';

    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    shadow.setAttribute('x',      String(px - cardW / 2 + 2));
    shadow.setAttribute('y',      String(py - cardH / 2 + 4));
    shadow.setAttribute('width',  cardW);
    shadow.setAttribute('height', cardH);
    shadow.setAttribute('rx',     String(rx));
    shadow.setAttribute('fill', 'rgba(0,0,0,0.4)');
    g.appendChild(shadow);

    const cardRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    cardRect.setAttribute('x',      String(px - cardW / 2));
    cardRect.setAttribute('y',      String(py - cardH / 2));
    cardRect.setAttribute('width',  cardW);
    cardRect.setAttribute('height', cardH);
    cardRect.setAttribute('rx',     String(rx));
    cardRect.setAttribute('fill',         cfg.fill);
    cardRect.setAttribute('stroke',       cfg.stroke);
    cardRect.setAttribute('stroke-width', '2');
    cardRect.setAttribute('id', `card-${id}`);
    g.appendChild(cardRect);

    if (!showValue && !hasVoted) {
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        pattern.setAttribute('x',      String(px - cardW / 2 + 2));
        pattern.setAttribute('y',      String(py - cardH / 2 + 2));
        pattern.setAttribute('width',  String(cardW - 4));
        pattern.setAttribute('height', String(cardH - 4));
        pattern.setAttribute('rx',     String(rx - 2));
        pattern.setAttribute('fill', 'url(#cardPattern)');
        g.appendChild(pattern);

        const accentLine = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        accentLine.setAttribute('x',      String(px - cardW / 2 + 8));
        accentLine.setAttribute('y',      String(py - cardH / 2 + 7));
        accentLine.setAttribute('width',  String(cardW - 16));
        accentLine.setAttribute('height', String(2));
        accentLine.setAttribute('rx',     String(1));
        accentLine.setAttribute('fill',    cfg.stroke);
        accentLine.setAttribute('opacity', '0.25');
        g.appendChild(accentLine);

        const accentBottom = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        accentBottom.setAttribute('x',      String(px - cardW / 2 + 8));
        accentBottom.setAttribute('y',      String(py + cardH / 2 - 9));
        accentBottom.setAttribute('width',  String(cardW - 16));
        accentBottom.setAttribute('height', String(2));
        accentBottom.setAttribute('rx',     String(1));
        accentBottom.setAttribute('fill',    cfg.stroke);
        accentBottom.setAttribute('opacity', '0.25');
        g.appendChild(accentBottom);
    }

    if (showValue) {
        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        inner.setAttribute('x',      String(px - cardW / 2 + 4));
        inner.setAttribute('y',      String(py - cardH / 2 + 4));
        inner.setAttribute('width',  String(cardW - 8));
        inner.setAttribute('height', String(cardH - 8));
        inner.setAttribute('rx',     String(rx - 3));
        inner.setAttribute('fill',         'none');
        inner.setAttribute('stroke',       cfg.innerBorder);
        inner.setAttribute('stroke-width', '1');
        g.appendChild(inner);

        const corner = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        corner.setAttribute('x',           String(px - cardW / 2 + 7));
        corner.setAttribute('y',           String(py - cardH / 2 + 13));
        corner.setAttribute('fill',        cfg.cornerColor);
        corner.setAttribute('font-size',   String(Math.max(Math.round(cardW * 0.2), 7)));
        corner.setAttribute('font-weight', '700');
        corner.setAttribute('font-family', 'Fira Sans, Lucida Sans, sans-serif');
        corner.textContent = player.cardValue;
        g.appendChild(corner);

        const cardText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        cardText.setAttribute('x',                  px);
        cardText.setAttribute('y',                  py + 1);
        cardText.setAttribute('text-anchor',        'middle');
        cardText.setAttribute('dominant-baseline',  'middle');
        cardText.setAttribute('fill',               cfg.textFill);
        cardText.setAttribute('font-size',          String(cardW > 36 ? 16 : 13));
        cardText.setAttribute('font-weight',        '700');
        cardText.setAttribute('font-family',        'Fira Sans, Lucida Sans, sans-serif');
        cardText.textContent = player.cardValue;
        g.appendChild(cardText);
    }

    svg.appendChild(g);
    _appendNameBadge(svg, player, { px, py }, cardH, nameFontSize, { roleColor, isSelf });
}

function _revealedCardConfig(changed, dark) {
    if (changed) {
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

function _votedCardConfig(dark) {
    return { cfg: {
            fill:        dark ? '#7f0010' : '#E1001A',
            stroke:      dark ? '#E1001A' : '#a50013',
            textFill:    '#ffffff',
            cornerColor: 'rgba(255,255,255,0.45)',
            innerBorder: 'rgba(255,255,255,0.2)'
        }};
}

function _selfCardConfig(dark) {
    return { cfg: {
            fill:        dark ? '#0d1f35'                : '#ffffff',
            stroke:      dark ? '#4a9ede'                : '#004178',
            textFill:    dark ? '#e2f0ff'                : '#004178',
            cornerColor: dark ? 'rgba(226,240,255,0.4)'  : 'rgba(0,65,120,0.3)',
            innerBorder: dark ? 'rgba(74,158,222,0.25)'  : 'rgba(0,65,120,0.1)'
        }};
}

function _otherCardConfig(dark) {
    return { cfg: {
            fill:        dark ? '#152030' : '#f0f6fc',
            stroke:      dark ? '#2e4a6a' : '#a0bcd8',
            textFill:    'transparent',
            cornerColor: 'transparent',
            innerBorder: dark ? 'rgba(74,158,222,0.1)' : 'rgba(0,65,120,0.08)'
        }};
}

// Skip-Karte: gedämpfte, neutrale Darstellung
function _skipCardConfig(dark) {
    return { cfg: {
            fill:        dark ? '#1a1a2a' : '#f4f4f6',
            stroke:      dark ? '#3a3f4a' : '#b0b8c4',
            textFill:    dark ? '#9aa5b4' : '#595f6e',
            cornerColor: dark ? 'rgba(154,165,180,0.3)' : 'rgba(89,95,110,0.25)',
            innerBorder: dark ? 'rgba(154,165,180,0.1)' : 'rgba(89,95,110,0.08)'
        }};
}

function _resolveCardConfig(player, isSelf, hasVoted) {
    const dark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isRevealed && player.cardValue === SKIP_CARD) return _skipCardConfig(dark);
    if (isRevealed && player.cardValue) return _revealedCardConfig(player.changed, dark);
    if (isSelf && player.cardValue === SKIP_CARD) return _skipCardConfig(dark);
    if (hasVoted)                        return _votedCardConfig(dark);
    if (isSelf)                          return _selfCardConfig(dark);
    return _otherCardConfig(dark);
}

function _appendNameBadge(svg, player, pos, cardH, nameFontSize, style) {
    const { px, py }            = pos;
    const { roleColor, isSelf } = style;
    const nameY       = py + cardH / 2 + 4;
    const displayName = _resolveDisplayName(player.name, isSelf);
    const nameW       = Math.min(displayName.length * 7 + 16, 120);
    const nameH       = nameFontSize + 10;
    const badgeRx     = nameH / 2;
    const darkBadge   = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;

    const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    badgeBg.setAttribute('x',      String(px - nameW / 2));
    badgeBg.setAttribute('y',      nameY);
    badgeBg.setAttribute('width',  String(nameW));
    badgeBg.setAttribute('height', nameH);
    badgeBg.setAttribute('rx',     String(badgeRx));
    badgeBg.setAttribute('fill',         darkBadge ? '#0d1f35' : '#ffffff');
    badgeBg.setAttribute('stroke',       roleColor);
    badgeBg.setAttribute('stroke-width', '1.5');
    svg.appendChild(badgeBg);

    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameText.setAttribute('x',                  px);
    nameText.setAttribute('y',                  nameY + nameH / 2 + 1);
    nameText.setAttribute('text-anchor',        'middle');
    nameText.setAttribute('dominant-baseline',  'middle');
    nameText.setAttribute('fill',               _resolveNameColor(darkBadge, isSelf));
    nameText.setAttribute('font-size',          nameFontSize);
    nameText.setAttribute('font-weight',        isSelf ? '700' : '500');
    nameText.setAttribute('font-family',        'Fira Sans, Lucida Sans, sans-serif');
    nameText.textContent = displayName;
    svg.appendChild(nameText);
}

// ====================================
// Teilnehmer-Sidebar
// ====================================

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
            return compareCardValues(a.cardValue, b.cardValue);
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
    const statusColor        = _resolveStatusColor(player.role, hasVoted);
    const statusSymbol       = hasVoted ? '✓' : '';
    const isDark             = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    const bgBorder           = isDark ? '#1e1e2e' : '#ffffff';
    const outlineColor       = isAlreadyModerator ? '#eab308' : roleColor;

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
            ${player.role === 'PRODUCT_OWNER' ? '' : `
            <div style="
                position:absolute; bottom:1px; right:1px;
                width:14px; height:14px; border-radius:50%;
                background:${statusColor};
                border:2px solid ${bgBorder};
                display:flex; align-items:center; justify-content:center;
                font-size:8px; font-weight:700; color:#ffffff; line-height:1;
                z-index:1;
            ">${statusSymbol}</div>`}
        </div>
        <div class="player-info">
            <span class="player-info__name ${isSelfEntry ? 'player-info__name--self' : ''}">
                ${escapeHtml(player.name)}${isSelfEntry ? ' (' + (globalThis.i18n?.labels?.you || 'Du') + ')' : ''}
            </span>
            <span class="player-info__role" style="color:${roleColor};">
                ${getRoleLabel(player.role)}${isAlreadyModerator ? ' · ' + (globalThis.i18n?.labels?.moderator || 'Moderator') + ' ⭐' : ''}
            </span>
        </div>
        ${_buildStatusOrValue(player, hasVoted)}
        ${isSelfEntry && !isAlreadyModerator
        ? `<button class="btn--promote" onclick="promoteMyself()"
                   title="Zum Moderator werden"
                   aria-label="Zum Moderator werden">↑</button>` : ''}
        ${isSelfEntry && canDemote
        ? `<button class="btn--demote" onclick="demoteParticipant('${id}')"
                   title="Moderator-Rechte abgeben"
                   aria-label="Moderator-Rechte abgeben">↓</button>` : ''}
        ${!isSelfEntry && isModerator && isAlreadyModerator && canDemote
        ? `<button class="btn--demote" onclick="demoteParticipant('${id}')"
                   title="Moderator-Rechte entziehen"
                   aria-label="Moderator-Rechte entziehen">↓</button>` : ''}
    `;
    return li;
}

function _buildStatusOrValue(player, hasVoted) {
    if (isRevealed && player.cardValue) {
        const isSkip = player.cardValue === SKIP_CARD;
        const extraClass = isSkip
            ? 'style="color:var(--color-text-light); background:var(--color-grey); border-color:var(--color-border);"'
            : (player.changed ? 'class="sidebar__card-value sidebar__card-value--changed"' : 'class="sidebar__card-value"');
        if (isSkip) {
            return `<span class="sidebar__card-value" ${extraClass}
                        title="Überspringen – nicht gewertet">
                        ${escapeHtml(player.cardValue)}
                    </span>`;
        }
        return `<span class="sidebar__card-value ${player.changed ? 'sidebar__card-value--changed' : ''}">
                    ${escapeHtml(player.cardValue)}
                </span>`;
    }
    if (player.role === 'PRODUCT_OWNER') return '';
    return `<div class="player-status ${_resolveStatusClass(player.changed, hasVoted)}"></div>`;
}

// ====================================
// Sync
// ====================================

function syncStatusToSvg() {
    const svgProgress  = document.getElementById('svgProgressBar');
    const htmlProgress = document.getElementById('progressBar');
    if (svgProgress && htmlProgress) {
        const pct = Number.parseFloat(htmlProgress.style.width) || 0;
        svgProgress.setAttribute('width', (140 * pct / 100).toString());
    }

    if (!isRevealed) {
        const svgStatus  = document.getElementById('svgVoteStatus');
        const htmlStatus = document.getElementById('voteStatus');
        if (svgStatus && htmlStatus) svgStatus.textContent = htmlStatus.textContent;
    }
}