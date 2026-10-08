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

    const seats = playerList.map(([id, player], index) => {
        const angle = (2 * Math.PI * index / total) - Math.PI / 2;
        return { id, player, px: cx + orbitRx * Math.cos(angle), py: cy + orbitRy * Math.sin(angle) };
    });

    _appendDefs(svg);
    const felt = _appendPokerTable(svg, cx, cy, tableRx, tableRy);
    // Chips vor dem Ergebnis zeichnen, damit Texte in der Tischmitte darüber liegen
    _appendSeatChips(svg, cx, cy, felt, seats);
    _appendFeltCards(svg, cx, cy, felt, seats);

    if (isRevealed) {
        _renderResult(svg, cx, cy, tableRx, tableRy);
    } else {
        _appendVoteStatus(svg, cx, cy);
        _appendProgressBar(svg, cx, cy);
    }

    seats.forEach(({ id, player, px, py }) =>
        _appendPlayerCard(svg, id, player, { px, py }, { cardW, cardH, nameFontSize }));

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
        <radialGradient id="tableGrad" cx="45%" cy="38%" r="65%">
            <stop offset="0%"   stop-color="#0063b5"/>
            <stop offset="60%"  stop-color="#004a8c"/>
            <stop offset="100%" stop-color="#00336a"/>
        </radialGradient>
        <linearGradient id="railGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#1d3c60"/>
            <stop offset="45%"  stop-color="#0b2747"/>
            <stop offset="100%" stop-color="#041a33"/>
        </linearGradient>
        <pattern id="feltPattern" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="0.7" fill="rgba(255,255,255,0.045)"/>
            <circle cx="4.5" cy="4.5" r="0.6" fill="rgba(0,0,0,0.08)"/>
        </pattern>
        <filter id="tableShadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="12"
                          flood-color="rgba(0,48,96,0.4)"/>
        </filter>
        <filter id="feltEdgeBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="6"/>
        </filter>
        <filter id="chipShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="rgba(0,0,0,0.45)"/>
        </filter>
        <pattern id="cardPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="none"/>
            <circle cx="4" cy="4" r="0.8" fill="${patternColor}"/>
        </pattern>
    `;
    svg.appendChild(defs);
}

/** Pfad eines Stadions (gerade Längsseiten, halbrunde Enden) mit halber Breite hw und halber Höhe hh. */
function _stadiumPath(cx, cy, hw, hh) {
    const l = Math.max(0, hw - hh);
    return `M ${cx - l} ${cy - hh} H ${cx + l} A ${hh} ${hh} 0 0 1 ${cx + l} ${cy + hh} `
         + `H ${cx - l} A ${hh} ${hh} 0 0 1 ${cx - l} ${cy - hh} Z`;
}

function _svgPath(d, attrs) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    Object.entries(attrs).forEach(([k, v]) => p.setAttribute(k, String(v)));
    return p;
}

/**
 * Pokertisch: gepolsterter Rand, Filz mit Struktur und Schatten zur Kante, Setzlinie.
 * Der Rand liegt je zur Hälfte innerhalb und außerhalb von rx/ry, damit die Plätze
 * ihren Abstand behalten. Liefert die halben Maße des Filzes.
 */
function _appendPokerTable(svg, cx, cy, rx, ry) {
    const railW = Math.min(22, Math.max(10, ry * 0.13));
    const feltW = rx - railW / 2;
    const feltH = ry - railW / 2;
    const feltD = _stadiumPath(cx, cy, feltW, feltH);

    // Polsterrand mit Glanzkante oben und dunkler Fuge zum Filz
    svg.appendChild(_svgPath(_stadiumPath(cx, cy, rx + railW / 2, ry + railW / 2),
        { fill: 'url(#railGrad)', filter: 'url(#tableShadow)' }));
    svg.appendChild(_svgPath(_stadiumPath(cx, cy, rx + railW / 2 - 1.5, ry + railW / 2 - 1.5),
        { fill: 'none', stroke: 'rgba(255,255,255,0.14)', 'stroke-width': 1.5 }));

    svg.appendChild(_svgPath(feltD, { fill: 'url(#tableGrad)' }));
    svg.appendChild(_svgPath(feltD, { fill: 'url(#feltPattern)' }));

    // Schatten des Randes auf den Filz: weiche dunkle Kante, auf den Filz beschnitten
    const clip = document.createElementNS(SVG_NS, 'clipPath');
    clip.setAttribute('id', 'feltClip');
    clip.appendChild(_svgPath(feltD, {}));
    svg.querySelector('defs').appendChild(clip);
    svg.appendChild(_svgPath(feltD, {
        fill: 'none', stroke: 'rgba(0,10,30,0.55)', 'stroke-width': railW * 0.9,
        filter: 'url(#feltEdgeBlur)', 'clip-path': 'url(#feltClip)'
    }));
    svg.appendChild(_svgPath(feltD, { fill: 'none', stroke: '#021428', 'stroke-width': 1.5 }));

    // Setzlinie: die Chips der Spieler liegen zwischen ihr und dem Rand
    const lineInset = _chipRadius(feltH) * 2 + 14;
    svg.appendChild(_svgPath(_stadiumPath(cx, cy, feltW - lineInset, feltH - lineInset),
        { fill: 'none', stroke: 'rgba(255,255,255,0.16)', 'stroke-width': 1.2 }));

    return { hw: feltW, hh: feltH };
}

// ====================================
// SVG Hilfsfunktionen — Chips
// ====================================

function _chipRadius(feltH) {
    return Math.min(11, Math.max(6, feltH * 0.07));
}

/** Abstand vom Mittelpunkt bis zum Stadionrand entlang der Richtung (ux, uy), Einheitsvektor. */
function _stadiumRayHit(ux, uy, hw, hh) {
    const l = Math.max(0, hw - hh);
    if (Math.abs(uy) > 1e-6) {
        const t = hh / Math.abs(uy);
        if (Math.abs(t * ux) <= l) return t;
    }
    // Halbkreis am Ende: Mittelpunkt (±l, 0), Radius hh
    const dc = Math.abs(ux) * l;
    return dc + Math.sqrt(dc * dc - l * l + hh * hh);
}

/**
 * Nächster Punkt auf dem Filzrand zu (x, y), relativ zur Tischmitte gerechnet.
 * Liefert den Randpunkt (bx, by), die Normale nach außen (nx, ny) und die
 * Tangente entlang der Kante (tx, ty).
 */
function _feltEdge(cx, cy, felt, x, y) {
    const l  = Math.max(0, felt.hw - felt.hh);
    const rx = x - cx;
    const ry = y - cy;
    let nx, ny, bx, by;
    if (Math.abs(rx) <= l) {
        // gerade Längsseite
        nx = 0;
        ny = ry < 0 ? -1 : 1;
        bx = rx;
        by = ny * felt.hh;
    } else {
        // halbrundes Ende um (±l, 0)
        const ex  = Math.sign(rx) * l;
        const len = Math.hypot(rx - ex, ry) || 1;
        nx = (rx - ex) / len;
        ny = ry / len;
        bx = ex + nx * felt.hh;
        by = ny * felt.hh;
    }
    return { bx: cx + bx, by: cy + by, nx, ny, tx: -ny, ty: nx };
}

/** Punkt auf dem Filz: von (x, y) zum Rand projiziert, dann um inset nach innen. */
function _feltInset(cx, cy, felt, x, y, inset) {
    const e = _feltEdge(cx, cy, felt, x, y);
    return { x: e.bx - e.nx * inset, y: e.by - e.ny * inset, edge: e };
}

/**
 * Platz eines Spielers auf dem Filz: wo die Linie von der Tischmitte zum Spieler den
 * Rand trifft. Von dort liegen Chip, Karte und Dealer-Button entlang der Kante.
 */
function _feltAnchor(cx, cy, felt, px, py) {
    const len = Math.hypot(px - cx, py - cy) || 1;
    const ux  = (px - cx) / len;
    const uy  = (py - cy) / len;
    const t   = _stadiumRayHit(ux, uy, felt.hw, felt.hh);
    return _feltEdge(cx, cy, felt, cx + ux * t, cy + uy * t);
}

/** Entlang der Kante um s verschoben und um inset nach innen – bleibt auch an den Rundungen auf dem Filz. */
function _alongEdge(cx, cy, felt, anchor, s, inset) {
    return _feltInset(cx, cy, felt, anchor.bx + anchor.tx * s, anchor.by + anchor.ty * s, inset);
}

/**
 * Vor jedem Platz ein Chip in der Rollenfarbe am Filzrand, beim Moderator
 * zusätzlich der Dealer-Button. Reine Deko, die Rolle steht auch im Namensschild.
 */
function _appendSeatChips(svg, cx, cy, felt, seats) {
    const r = _chipRadius(felt.hh);
    seats.forEach(({ id, player, px, py }) => {
        const anchor = _feltAnchor(cx, cy, felt, px, py);
        const chip   = _alongEdge(cx, cy, felt, anchor, 0, r + 6);

        svg.appendChild(_chip(chip.x, chip.y, r,
            ROLE_COLORS_DARK[player.role] || ROLE_COLORS_DARK.DEVELOPER));

        const moderator = player.moderator || (id === participantId && isModerator);
        if (moderator) {
            // auf der einen Seite des Chips der Dealer-Button, auf der anderen die Karte
            const btn = _alongEdge(cx, cy, felt, anchor, r * 2.4, r * 1.05 + 8);
            svg.appendChild(_dealerButton(btn.x, btn.y, r));
        }
    });
}

// ====================================
// SVG Hilfsfunktionen — Karten auf dem Filz
// ====================================

// Stand der letzten Darstellung (id -> Karte), um Übergänge zu animieren:
// neu abgestimmt → Karte gleitet vom Platz auf den Filz, Aufdecken → Karte dreht sich um,
// neue Runde → Karten werden in die Mitte geschoben. null = noch nichts gezeichnet.
let _feltCards       = null;
let _feltWasRevealed = false;

const FELT_STAGGER_MS = 45;

/** Leichte, pro Spieler feste Schräglage, damit die Karten nicht wie gedruckt wirken. */
function _feltTilt(id) {
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.codePointAt(0)) % 997;
    return (h % 21) - 10;
}

function _appendFeltCards(svg, cx, cy, felt, seats) {
    const r    = _chipRadius(felt.hh);
    const w    = Math.max(14, r * 1.9);
    const h    = w * 1.4;
    const prev = _feltCards;
    const next = {};

    // Neue Runde: die Karten der letzten Runde wandern in die Mitte und verschwinden
    if (prev !== null && _feltWasRevealed && !isRevealed) {
        Object.values(prev).forEach((card, i) => {
            svg.appendChild(_feltCard(card, w, h,
                { anim: 'collect', dx: cx - card.x, dy: cy - card.y, delay: i * FELT_STAGGER_MS }));
        });
    }

    seats.forEach(({ id, player, px, py }, i) => {
        if (!player.voted) return;
        // Abstand zum Rand: halbe Diagonale, damit auch die schräge Karte ganz auf dem Filz liegt
        const anchor = _feltAnchor(cx, cy, felt, px, py);
        const spot   = _alongEdge(cx, cy, felt, anchor, -(r + 5 + w * 0.6), Math.hypot(w, h) / 2 + 4);
        // Unterkante zum Spieler (Normale nach außen), dazu die leichte Schräglage
        const facing = Math.atan2(-spot.edge.nx, spot.edge.ny) * 180 / Math.PI;
        const card = {
            x:       spot.x,
            y:       spot.y,
            tilt:    facing + _feltTilt(id),
            faceUp:  isRevealed && !!player.cardValue,
            value:   player.cardValue,
            changed: player.changed
        };
        next[id] = card;

        const old = prev?.[id];
        let opts  = {};
        if (prev !== null && !old) {
            opts = { anim: 'deal', dx: px - card.x, dy: py - card.y };
        } else if (old && !old.faceUp && card.faceUp) {
            opts = { anim: 'flip', delay: i * FELT_STAGGER_MS };
        }
        svg.appendChild(_feltCard(card, w, h, opts));
    });

    _feltCards       = next;
    _feltWasRevealed = isRevealed;
}

/**
 * Eine Karte auf dem Filz, um den eigenen Mittelpunkt gezeichnet:
 * Position → Bewegung (Austeilen/Einsammeln) → Schräglage → Umdrehen.
 */
function _feltCard(card, w, h, { anim, dx = 0, dy = 0, delay = 0 } = {}) {
    const outer = document.createElementNS(SVG_NS, 'g');
    outer.setAttribute('transform', `translate(${card.x} ${card.y})`);
    outer.setAttribute('class', 'felt-card');

    const move = document.createElementNS(SVG_NS, 'g');
    if (anim === 'deal' || anim === 'collect') {
        move.setAttribute('class', `felt-card__move felt-card__move--${anim}`);
        move.style.setProperty('--dx', `${dx}px`);
        move.style.setProperty('--dy', `${dy}px`);
        move.style.animationDelay = `${delay}ms`;
    }
    outer.appendChild(move);

    const tilt = document.createElementNS(SVG_NS, 'g');
    tilt.setAttribute('transform', `rotate(${card.tilt})`);
    move.appendChild(tilt);

    const flip = document.createElementNS(SVG_NS, 'g');
    tilt.appendChild(flip);

    const dark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    if (anim === 'flip') {
        flip.setAttribute('class', 'felt-card__flip felt-card__flip--anim');
        flip.style.animationDelay = `${delay}ms`;
        flip.appendChild(_feltCardBack(w, h, dark, delay));
        flip.appendChild(_feltCardFront(card, w, h, dark, delay));
    } else {
        flip.appendChild(card.faceUp ? _feltCardFront(card, w, h, dark) : _feltCardBack(w, h, dark));
    }
    return outer;
}

function _feltCardRect(w, h, fill, stroke) {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(-w / 2));
    rect.setAttribute('y', String(-h / 2));
    rect.setAttribute('width',  String(w));
    rect.setAttribute('height', String(h));
    rect.setAttribute('rx', String(Math.max(2, w * 0.14)));
    rect.setAttribute('fill', fill);
    rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', '1');
    return rect;
}

/** Rückseite in Rot wie die Karte eines Spielers, der schon abgestimmt hat. */
function _feltCardBack(w, h, dark, delay) {
    const { cfg } = _votedCardConfig(dark);
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'felt-card__back');
    g.setAttribute('filter', 'url(#chipShadow)');
    if (delay !== undefined) g.style.animationDelay = `${delay}ms`;
    g.appendChild(_feltCardRect(w, h, cfg.fill, cfg.stroke));

    const inset = Math.max(2, w * 0.16);
    g.appendChild(_feltCardRect(w - inset * 2, h - inset * 2, 'none', 'rgba(255,255,255,0.45)'));
    return g;
}

function _feltCardFront(card, w, h, dark, delay) {
    const { cfg } = card.value === SKIP_CARD
        ? _skipCardConfig(dark)
        : _revealedCardConfig(card.changed, dark);
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'felt-card__front');
    g.setAttribute('filter', 'url(#chipShadow)');
    if (delay !== undefined) g.style.animationDelay = `${delay}ms`;
    g.appendChild(_feltCardRect(w, h, cfg.fill, cfg.stroke));

    const len = String(card.value ?? '').length;
    g.appendChild(_svgText(0, 0.5, card.value ?? '', {
        fill: cfg.textFill, 'font-size': Math.round(w * (len > 2 ? 0.38 : 0.52)),
        'font-weight': 700, 'dominant-baseline': 'middle'
    }));
    return g;
}

function _chip(x, y, r, color) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'seat-chip');
    g.setAttribute('filter', 'url(#chipShadow)');

    const base = document.createElementNS(SVG_NS, 'circle');
    base.setAttribute('cx', String(x));
    base.setAttribute('cy', String(y));
    base.setAttribute('r',  String(r));
    base.setAttribute('fill', color);
    base.setAttribute('stroke', 'rgba(0,0,0,0.35)');
    base.setAttribute('stroke-width', '0.8');
    g.appendChild(base);

    // weiße Kantenmarken: 6 Segmente auf dem äußeren Ring
    const ringR = r * 0.8;
    const seg   = (2 * Math.PI * ringR) / 12;
    const ring  = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', String(x));
    ring.setAttribute('cy', String(y));
    ring.setAttribute('r',  String(ringR));
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', 'rgba(255,255,255,0.9)');
    ring.setAttribute('stroke-width', String(r * 0.32));
    ring.setAttribute('stroke-dasharray', `${seg} ${seg}`);
    g.appendChild(ring);

    const inlay = document.createElementNS(SVG_NS, 'circle');
    inlay.setAttribute('cx', String(x));
    inlay.setAttribute('cy', String(y));
    inlay.setAttribute('r',  String(r * 0.5));
    inlay.setAttribute('fill', color);
    inlay.setAttribute('stroke', 'rgba(255,255,255,0.55)');
    inlay.setAttribute('stroke-width', String(Math.max(0.6, r * 0.08)));
    g.appendChild(inlay);
    return g;
}

function _dealerButton(x, y, r) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'dealer-button');
    g.setAttribute('filter', 'url(#chipShadow)');

    const disc = document.createElementNS(SVG_NS, 'circle');
    disc.setAttribute('cx', String(x));
    disc.setAttribute('cy', String(y));
    disc.setAttribute('r',  String(r * 1.05));
    disc.setAttribute('fill', '#f8fafc');
    disc.setAttribute('stroke', '#94a3b8');
    disc.setAttribute('stroke-width', '0.8');
    g.appendChild(disc);

    g.appendChild(_svgText(x, y + 0.5, 'D', {
        fill: '#1a1a2e', 'font-size': Math.round(r * 1.2), 'font-weight': 800,
        'dominant-baseline': 'middle'
    }));
    return g;
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

    // Vor dem Aufdecken nur die eigene große Karte; wer abgestimmt hat, sieht man an der
    // Karte auf dem Filz. Auf den anderen Plätzen sitzt bis dahin eine Spielerfigur.
    if (!isRevealed && !isSelf) {
        svg.appendChild(_seatFigure(id, player, px, py, cardW, cardH));
        _appendNameBadge(svg, player, { px, py }, cardH, nameFontSize, { roleColor, isSelf });
        return;
    }

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

/**
 * Spielerfigur auf dem Platz einer Karte: Kopf und Schultern, Oberteil in der Rollenfarbe.
 * Eigene ID statt card-group-*, damit die Austeil-Animation der neuen Runde sie nicht erfasst.
 */
function _seatFigure(id, player, px, py, cardW, cardH) {
    const dark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('id', `seat-figure-${id}`);
    g.setAttribute('class', 'seat-figure');

    // Schultern: oben abgerundet, unten gerade abgeschnitten (sitzt hinter dem Namensschild)
    const w   = cardW * 0.5;
    const top = py - cardH * 0.02;
    const bot = py + cardH / 2 + 2;
    const rr  = w * 0.8;
    g.appendChild(_svgPath(
        `M ${px - w} ${bot} V ${top + rr} Q ${px - w} ${top} ${px - w + rr} ${top} `
        + `H ${px + w - rr} Q ${px + w} ${top} ${px + w} ${top + rr} V ${bot} Z`,
        { fill: getRoleTextColor(player.role), stroke: 'rgba(0,0,0,0.25)', 'stroke-width': 1 }));

    const head = document.createElementNS(SVG_NS, 'circle');
    head.setAttribute('cx', String(px));
    head.setAttribute('cy', String(py - cardH * 0.22));
    head.setAttribute('r',  String(cardW * 0.27));
    head.setAttribute('fill',   dark ? '#cbd5e1' : '#e2e8f0');
    head.setAttribute('stroke', '#94a3b8');
    head.setAttribute('stroke-width', '1');
    g.appendChild(head);
    return g;
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
    const displayName = _resolveDisplayName(player.name, isSelf);
    // Links im Schild ein Punkt in der Rollenfarbe
    const dotR        = Math.max(3.5, nameFontSize * 0.4);
    const dotSpace    = dotR * 2 + 5;
    const nameW       = Math.min(displayName.length * 7 + 16, 120) + dotSpace;
    const nameH       = nameFontSize + 10;
    const nameY       = py + cardH / 2 + 4;
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