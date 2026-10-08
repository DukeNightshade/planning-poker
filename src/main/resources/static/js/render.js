/* global participantId, isModerator, isRevealed, players, absentPlayers, tickets, currentTicketId,
          getRoleColor, getRoleTextColor, ROLE_ORDER, ROLE_COLORS_DARK, recalculateStats, escapeHtml, getRoleLabel,
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

/** Stimmen Product Owner in dieser Session mit? (Einstellung, Standard: ja) */
function _productOwnerVotes() {
    return document.getElementById('settingPoCanVote')?.checked ?? true;
}

function _resolveStatusColor(role, hasVoted) {
    if (role === 'PRODUCT_OWNER' && !_productOwnerVotes()) return 'transparent';
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

    // Tisch: wächst mit der verfügbaren Höhe, bleibt aber ein liegendes Oval
    const tableRx = Math.min(cW * 0.22, 340);
    const tableRy = Math.min(Math.max(cH * 0.24, 70), tableRx * 0.6);

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

    const cardW        = _resolveCardWidth(total);
    const cardH        = Math.round(cardW * 1.4);
    const nameFontSize = _resolveNameFontSize(total);

    // ViewBox nur so hoch wie Tisch + Plätze (Karte oben, Karte + Namensschild unten);
    // unten ausgerichtet, damit die eigene Kartenhand direkt unter dem Tisch liegt
    const seatPad = cardH / 2 + 30;
    const W  = Math.max(cW, orbitRx * 2 + 160);
    const H  = orbitRy * 2 + seatPad * 2;
    const cx = W / 2;
    const cy = H / 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width',  '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    svg.style.overflow = 'visible';
    svg.setAttribute('role', 'img');

    // aria-label statt <title>: Screenreader lesen es vor, aber es erscheint kein Maus-Tooltip
    svg.setAttribute('aria-label', `Pokertisch mit ${total} Teilnehmer${total === 1 ? '' : 'n'}`);

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
    _renderRoleLegend();
}

/** Legende unter dem Tisch: nur die Rollen, die gerade am Tisch sitzen. */
function _renderRoleLegend() {
    const legend = document.getElementById('roleLegend');
    if (!legend) return;

    const present = new Set(Object.values(players)
        .map(p => (p.role === 'MODERATOR' ? 'DEVELOPER' : p.role)));
    const roles = ROLE_ORDER.filter(r => present.has(r));

    legend.innerHTML = roles.map(r => `
        <span class="role-legend__item">
            <span class="role-dot" style="background:${getRoleColor(r)};"></span>${escapeHtml(getRoleLabel(r))}
        </span>`).join('');
    legend.style.display = roles.length > 0 ? '' : 'none';
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
    // Maßstab aus der Tischgröße: auf großen Bildschirmen wächst das Ergebnis mit
    const s = Math.min(2.3, Math.max(1.15, tableRy / 65));

    if (stacks.length === 0) {
        svg.appendChild(_svgText(cx, cy + 6, globalThis.i18n?.labels?.noVotes || 'Keine Stimmen',
            { fill: 'rgba(255,255,255,0.6)', 'font-size': Math.round(14 * s) }));
        return;
    }

    const baseline = cy + tableRy * 0.08;
    _appendStacks(svg, cx, baseline, { tableRx, tableRy, s }, stacks, mostCommon);
    // unter den ×-Zahlen (baseline + 14·s) mit etwas Abstand
    _appendResultSummary(svg, cx, baseline + 36 * s, s);
}

function _appendStacks(svg, cx, baseline, size, stacks, mostCommon) {
    const { tableRx, tableRy, s } = size;
    const dark   = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    const slotW  = (tableRx * 1.5) / stacks.length;
    // begrenzt durch den Platz pro Stapel und die Tischhöhe, damit der Stapel auf dem Tisch bleibt
    const cardW  = Math.max(14, Math.min(slotW * 0.62, tableRy * 0.45, 26 * s));
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
            card.setAttribute('stroke-width', String((isFront && isTop ? 2.5 : 1.2) * Math.sqrt(s)));
            g.appendChild(card);
        }

        const frontY = baseline - cardH / 2 - (layers - 1) * layerY;
        g.appendChild(_svgText(x + layers - 1, frontY, stack.value, {
            fill: cfg.textFill, 'font-size': Math.round(cardW * 0.5),
            'font-weight': 700, 'dominant-baseline': 'middle'
        }));

        g.appendChild(_svgText(x, baseline + 14 * s, `×${stack.count}`, {
            fill: isTop ? STACK_GOLD : 'rgba(255,255,255,0.7)',
            'font-size': Math.round(11 * s), 'font-weight': isTop ? 700 : 500
        }));

        svg.appendChild(g);
    });
}

function _appendResultSummary(svg, cx, y, s = 1) {
    const stats  = recalculateStats();
    // Der häufigste Wert ist am goldenen Stapel erkennbar – hier nur noch der Durchschnitt
    const parts  = [];
    if (stats.overallAvg !== null) parts.push(`Ø ${stats.overallAvg}`);

    if (parts.length > 0) {
        svg.appendChild(_svgText(cx, y, parts.join('  ·  '),
            { fill: 'white', 'font-size': Math.round(14 * s), 'font-weight': 700 }));
    }

    // Optional: Durchschnitt je Rolle in den Rollenfarben
    if (showOnlyTotal) return;
    // Helle Rollentöne, weil der Tisch dunkel ist
    const roles = [
        { label: '⚙', avg: stats.devAvg,       color: ROLE_COLORS_DARK.DEVELOPER },
        { label: '✓', avg: stats.testerAvg,    color: ROLE_COLORS_DARK.TESTER },
        { label: '🏗', avg: stats.architectAvg, color: ROLE_COLORS_DARK.IT_ARCHITECT }
    ].filter(r => r.avg !== null);
    if (roles.length < 2) return;

    const line = _svgText(cx, y + 18 * s, '', { 'font-size': Math.round(11 * s), 'font-weight': 600 });
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
    const roleColor = getRoleColor(player.role);
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
    // Links im Schild ein Punkt in der Rollenfarbe
    const dotR        = Math.max(3.5, nameFontSize * 0.4);
    const dotSpace    = dotR * 2 + 5;
    const nameW       = Math.min(displayName.length * 7 + 16, 120) + dotSpace;
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
    badgeBg.setAttribute('stroke',       getRoleTextColor(player.role));
    badgeBg.setAttribute('stroke-width', '1.5');
    svg.appendChild(badgeBg);

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx',   String(px - nameW / 2 + badgeRx));
    dot.setAttribute('cy',   String(nameY + nameH / 2));
    dot.setAttribute('r',    String(dotR));
    dot.setAttribute('fill', darkBadge ? getRoleTextColor(player.role) : roleColor);
    svg.appendChild(dot);

    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameText.setAttribute('x',                  px + dotSpace / 2);
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

    _renderAbsentList();
}

/** Team-Raum: gemerkte, gerade nicht verbundene Mitglieder (eingeklappt unter der Liste). */
function _renderAbsentList() {
    const section = document.getElementById('absentSection');
    if (!section) return;

    const entries = Object.entries(absentPlayers)
        .sort(([, a], [, b]) => a.name.localeCompare(b.name));
    section.style.display = entries.length > 0 ? '' : 'none';
    document.getElementById('absentCount').textContent = String(entries.length);

    const ul = document.getElementById('absentList');
    ul.innerHTML = '';
    entries.forEach(([id, player]) => {
        const li = document.createElement('li');
        li.className = 'sidebar__absent-item';
        li.innerHTML = `
            <span class="sidebar__absent-name"><span class="role-dot" style="background:${getRoleColor(player.role)};"></span>${escapeHtml(player.name)}</span>
            <span class="sidebar__absent-role">${getRoleLabel(player.role)}</span>
            ${_buildRemoveButton(id, false)}`;
        ul.appendChild(li);
    });
}

function _buildSidebarItem(id, player, activeModerators) {
    const isSelfEntry        = id === participantId;
    const hasVoted           = player.voted;
    const avatarBg           = getRoleColor(player.role);
    const roleColor          = getRoleTextColor(player.role);
    const isAlreadyModerator = player.moderator || (isSelfEntry && isModerator);
    const canDemote          = isAlreadyModerator && activeModerators > 1;
    const statusColor        = _resolveStatusColor(player.role, hasVoted);
    const statusSymbol       = hasVoted ? '✓' : '';
    const isDark             = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    const bgBorder           = isDark ? '#1e1e2e' : '#ffffff';
    const outlineColor       = isAlreadyModerator ? '#eab308' : 'transparent';   // Ring nur für Moderatoren

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
            ${player.role === 'PRODUCT_OWNER' && !_productOwnerVotes() ? '' : `
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
        ${_buildRemoveButton(id, isSelfEntry)}
    `;
    return li;
}

/** ✕ zum Entfernen anderer Teilnehmer (nur Moderatoren; selbst gehen über "Tisch verlassen" im Header). */
function _buildRemoveButton(id, isSelfEntry) {
    if (isSelfEntry || !isModerator) return '';
    const label = escapeHtml(globalThis.i18n?.labels?.remove || 'Vom Tisch entfernen');
    return `<button class="btn--kick" onclick="removeFromTable('${id}')"
                    title="${label}" aria-label="${label}">✕</button>`;
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
    if (player.role === 'PRODUCT_OWNER' && !_productOwnerVotes()) return '';
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