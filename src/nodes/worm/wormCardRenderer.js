import { escapeHtml } from "../../templates/shared.js";

function statDisplay(baseValue, modifierValue, debuffValue) {
  const base = Number.isFinite(Number(baseValue)) ? Number(baseValue) : 0;
  const modifier = Number.isFinite(Number(modifierValue)) ? Number(modifierValue) : 0;
  const debuff = Number.isFinite(Number(debuffValue)) ? Number(debuffValue) : 0;
  const parts = [String(base)];

  if (modifier > 0) {
    parts.push(`+ ${modifier}`);
  }
  if (debuff > 0) {
    parts.push(`- ${debuff}`);
  }

  return parts.join(" ");
}

function statChip(label, baseValue, modifierValue = 0, debuffValue = 0) {
  const display = statDisplay(baseValue, modifierValue, debuffValue);
  return `
    <div class="worm-card-stat">
      <span class="worm-card-stat-label">${escapeHtml(label)}</span>
      <span class="worm-card-stat-value">${escapeHtml(display)}</span>
    </div>
  `;
}

function statusIconMarkup(type) {
  if (type === "defense") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3L19 6V11C19 15.5 16.3 19.4 12 21C7.7 19.4 5 15.5 5 11V6L12 3Z"></path>
      </svg>
    `;
  }

  if (type === "speed") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 2L6 13H12L9.5 22L18 11H12L14.5 2Z"></path>
      </svg>
    `;
  }

  if (type === "stealth") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12C4.3 7.7 7.8 5.5 12 5.5C16.2 5.5 19.7 7.7 22 12C19.7 16.3 16.2 18.5 12 18.5C7.8 18.5 4.3 16.3 2 12Z"></path>
        <circle cx="12" cy="12" r="3.2"></circle>
      </svg>
    `;
  }

  if (type === "confusion") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5A8.5 8.5 0 1 0 20.5 12h-3A5.5 5.5 0 1 1 12 6.5c1.4 0 2.6.5 3.6 1.4l-2.1 2.1H21V2.4l-2.3 2.3A8.45 8.45 0 0 0 12 3.5Z"></path>
      </svg>
    `;
  }

  return "";
}

function statusBadges(combatant) {
  if (!combatant || typeof combatant !== "object") {
    return "";
  }

  const badges = [];
  if (Number(combatant.guardCharges || 0) > 0) {
    badges.push({
      type: "defense",
      label: "Guard active",
    });
  }
  if (combatant.speedReady) {
    badges.push({
      type: "speed",
      label: "Speed active",
    });
  }
  if (combatant.stealthReady) {
    badges.push({
      type: "stealth",
      label: "Stealth active",
    });
  }
  if (combatant.confusedAttack) {
    badges.push({
      type: "confusion",
      label: "Manipulated",
    });
  }

  if (!badges.length) {
    return "";
  }

  return `
    <div class="worm-card-status-stack" aria-label="Active effects">
      ${badges
    .map(
      (badge) => `
          <span class="worm-card-status worm-card-status-${escapeHtml(badge.type)}" title="${escapeHtml(badge.label)}">
            ${statusIconMarkup(badge.type)}
          </span>
        `,
    )
    .join("")}
    </div>
  `;
}

function rarityLabel(card) {
  const rarity = Number(card.rarity);
  if (Number.isFinite(rarity)) {
    return rarity.toFixed(1);
  }
  return "0.0";
}

export function renderWormCard(card, { combatant = null, role = "player", headerExtraHtml = "" } = {}) {
  if (!card || typeof card !== "object") {
    return "";
  }

  const hpText =
    combatant && Number.isFinite(combatant.hp) && Number.isFinite(combatant.maxHp)
      ? `${Math.max(0, Math.round(combatant.hp))}/${Math.max(1, Math.round(combatant.maxHp))}`
      : "";
  const hpPercent =
    combatant && Number.isFinite(combatant.hp) && Number.isFinite(combatant.maxHp)
      ? Math.max(0, Math.min(100, (combatant.hp / Math.max(1, combatant.maxHp)) * 100))
      : 0;
  const rarityTier = String(card.rarityTier || "common");
  const modifiers =
    combatant && combatant.modifiers && typeof combatant.modifiers === "object"
      ? combatant.modifiers
      : {};
  const debuffs =
    combatant && combatant.debuffs && typeof combatant.debuffs === "object"
      ? combatant.debuffs
      : {};
  const baseStats =
    combatant && combatant.stats && typeof combatant.stats === "object"
      ? combatant.stats
      : {
        attack: card.attack,
        defense: card.defense,
        endurance: card.endurance,
        info: card.info,
        manipulation: card.manipulation,
        range: card.range,
        speed: card.speed,
        stealth: card.stealth,
      };

  return `
    <article class="worm-card worm-card-${escapeHtml(role)} worm-card-tier-${escapeHtml(rarityTier)}">
      ${statusBadges(combatant)}
      <header class="worm-card-header">
        <h4>${escapeHtml(card.heroName || "Unknown Cape")}</h4>
        <div class="worm-card-rarity-wrap">
          <span class="worm-card-rarity">Rarity ${escapeHtml(rarityLabel(card))}</span>
          ${headerExtraHtml || ""}
        </div>
      </header>

      <div class="worm-card-body">
        <aside class="worm-card-stats worm-card-stats-left">
          ${statChip("ATK", baseStats.attack, modifiers.attack, debuffs.attack)}
          ${statChip("DEF", baseStats.defense, modifiers.defense, debuffs.defense)}
          ${statChip("END", baseStats.endurance, modifiers.endurance, debuffs.endurance)}
        </aside>

        <section class="worm-card-power">
          <p title="${escapeHtml(card.powerFull || card.power || "No power description.")}">${escapeHtml(card.power || "No power description.")}</p>
        </section>

        <aside class="worm-card-stats worm-card-stats-right">
          ${statChip("INF", baseStats.info, modifiers.info, debuffs.info)}
          ${statChip("MAN", baseStats.manipulation, modifiers.manipulation, debuffs.manipulation)}
          ${statChip("RNG", baseStats.range, modifiers.range, debuffs.range)}
        </aside>
      </div>

      <footer class="worm-card-footer">
        ${statChip("SPD", baseStats.speed, modifiers.speed, debuffs.speed)}
        ${statChip("STL", baseStats.stealth, modifiers.stealth, debuffs.stealth)}
        ${
          hpText
            ? `
              <div class="worm-card-hp">
                <span class="worm-card-hp-label">HP ${escapeHtml(hpText)}</span>
                <span class="worm-card-hp-track"><span class="worm-card-hp-fill" style="width:${hpPercent.toFixed(1)}%;"></span></span>
              </div>
            `
            : ""
        }
      </footer>
    </article>
  `;
}
