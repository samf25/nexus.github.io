import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import { renderRegionSymbol } from "../../core/symbology.js";
import {
  arcaneSystemFromState,
  computeTomePullCost,
  enhancementGlyphPool,
  glyphDisplayName,
  regionGlyphPool,
} from "../../systems/arcaneAscension.js";
import {
  estimateLootShopPrice,
  formatLootItemEffectSummary,
  isLootItemEquipped,
  lootInventoryFromState,
  rollRegionalLoot,
} from "../../systems/loot.js";

const NODE_ID = "AA02";
const SHOP_OFFER_COUNT = 5;
const TOME_FLASH_STEP_MS = 1050;

function safeText(value) {
  return String(value || "").trim();
}

function safeInt(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function serializeOfferDrop(drop) {
  try {
    return encodeURIComponent(JSON.stringify(drop || {}));
  } catch {
    return "";
  }
}

function parseOfferDrop(value) {
  try {
    const decoded = decodeURIComponent(String(value || ""));
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function serializeGlyphList(values) {
  try {
    return encodeURIComponent(JSON.stringify(Array.isArray(values) ? values : []));
  } catch {
    return "";
  }
}

function parseGlyphList(value) {
  try {
    const decoded = decodeURIComponent(String(value || ""));
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed) ? parsed.map((entry) => safeText(entry).toLowerCase()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function rarityBiasForCourtSpend(totalSpent) {
  const spent = Math.max(0, safeInt(totalSpent, 0));
  return Math.min(2.4, (Math.log10(1 + spent) * 0.9));
}

function generateShopOffers(arcane, hourKey) {
  const offers = [];
  const baseNow = hourKey * 3600000;
  const rarityBias = rarityBiasForCourtSpend(arcane.totalSpentAtCourt);
  for (let index = 0; index < SHOP_OFFER_COUNT; index += 1) {
    const roll = rollRegionalLoot({
      sourceRegion: "aa",
      triggerType: `climbers-court-shop-${index}`,
      dropChance: 1,
      outRegionChance: 1,
      forceOutRegion: true,
      rarityBias,
      now: baseNow,
      seed: (hourKey * 977) + (index * 113) + safeInt(arcane.totalSpentAtCourt, 0),
    });
    if (!roll) {
      continue;
    }
    const cost = estimateLootShopPrice(roll, {
      totalSpentAtCourt: arcane.totalSpentAtCourt,
      buyDiscountPct: arcane.bonuses.buyDiscountPct,
      shopRegion: "aa",
    });
    offers.push({
      id: `offer-${hourKey}-${index}`,
      cost,
      lootDrop: roll,
    });
  }
  return offers;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const offers = Array.isArray(source.shopOffers)
    ? source.shopOffers.filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        id: safeText(entry.id),
        cost: Math.max(1, safeInt(entry.cost, 1)),
        lootDrop: entry.lootDrop && typeof entry.lootDrop === "object" ? entry.lootDrop : null,
      }))
      .filter((entry) => entry.id && entry.lootDrop)
    : [];
  const tabCandidate = safeText(source.activeTab).toLowerCase();
  const activeTab = tabCandidate === "auction" || tabCandidate === "tome" ? tabCandidate : "shop";
  const revealQueue = Array.isArray(source.revealQueue)
    ? source.revealQueue.map((entry) => safeText(entry).toLowerCase()).filter(Boolean)
    : [];
  return {
    shopHourKey: Math.max(0, safeInt(source.shopHourKey, 0)),
    shopOffers: offers,
    selectedAuctionItemId: safeText(source.selectedAuctionItemId),
    activeTab,
    revealQueue,
    revealTick: Math.max(0, safeInt(source.revealTick, 0)),
    revealStartedAt: Math.max(0, safeInt(source.revealStartedAt, 0)),
    lastRevealRouteNonce: Math.max(0, safeInt(source.lastRevealRouteNonce, 0)),
    lastMessage: safeText(source.lastMessage),
    solved: Boolean(source.solved),
  };
}

function normalizeItemDetail(item) {
  return formatLootItemEffectSummary(item, { maxEffects: 3 });
}

function displayItemLabel(item) {
  const label = safeText(item && item.label);
  return label.replace(/\s+\[[^\]]+\]$/u, "").trim();
}

function readableGlyphName(glyphId) {
  const normalized = safeText(glyphId).toLowerCase();
  const isRegion = regionGlyphPool().includes(normalized);
  return glyphDisplayName(normalized, isRegion ? "region" : "enhancement");
}

function renderGlyphSymbol(glyphId) {
  const id = safeText(glyphId).toLowerCase();
  if (id === "crd") {
    return renderRegionSymbol({ section: "Cradle", className: "aa02-glyph-symbol" });
  }
  if (id === "worm") {
    return renderRegionSymbol({ section: "Worm", className: "aa02-glyph-symbol" });
  }
  if (id === "dcc") {
    return renderRegionSymbol({ section: "Dungeon Crawler Carl", className: "aa02-glyph-symbol" });
  }
  if (id === "aa") {
    return renderRegionSymbol({ section: "Arcane Ascension", className: "aa02-glyph-symbol" });
  }
  return renderArtifactSymbol({ artifactName: readableGlyphName(id), className: "aa02-glyph-symbol artifact-symbol" });
}

function statusMarkup(runtime) {
  const message = safeText(runtime && runtime.lastMessage);
  if (!message) {
    return "";
  }
  if (message.toLowerCase().startsWith("tome pull complete:")) {
    return "";
  }
  return `<p class="aa02-status-note">${escapeHtml(message)}</p>`;
}

export function initialAa02Runtime(context = {}) {
  return synchronizeAa02Runtime(normalizeRuntime({}), context);
}

export function synchronizeAa02Runtime(runtime, context = {}) {
  const current = normalizeRuntime(runtime);
  const now = context.now || Date.now();
  const hourKey = Math.floor(now / 3600000);
  const arcane = arcaneSystemFromState(context.state || {}, now);
  const routeNonce = Math.max(0, safeInt(context.routeVisitNonce, 0));
  const shouldClearReveal = current.revealQueue.length > 0 && routeNonce > current.lastRevealRouteNonce;
  const elapsed = Math.max(0, now - current.revealStartedAt);
  const revealTick = current.revealQueue.length
    ? Math.min(current.revealQueue.length, Math.floor(elapsed / TOME_FLASH_STEP_MS) + 1)
    : 0;
  const revealFinished = current.revealQueue.length > 0 && revealTick >= current.revealQueue.length;
  const shouldAutoClearReveal =
    revealFinished && elapsed > ((current.revealQueue.length + 1) * TOME_FLASH_STEP_MS);
  const revealQueue = shouldClearReveal || shouldAutoClearReveal ? [] : current.revealQueue;
  const revealTickValue = revealQueue.length ? revealTick : 0;
  const revealStartedAt = revealQueue.length ? current.revealStartedAt : 0;
  if (current.shopHourKey === hourKey && current.shopOffers.length) {
    if (revealTickValue !== current.revealTick || revealQueue !== current.revealQueue) {
      return {
        ...current,
        revealQueue,
        revealTick: revealTickValue,
        revealStartedAt,
      };
    }
    return current;
  }
  return {
    ...current,
    shopHourKey: hourKey,
    shopOffers: generateShopOffers(arcane, hourKey),
    revealQueue,
    revealTick: revealTickValue,
    revealStartedAt,
  };
}

export function validateAa02Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceAa02Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "aa02-open-tab") {
    const tab = safeText(action.tab).toLowerCase();
    const nextTab = tab === "auction" || tab === "tome" ? tab : "shop";
    const keepReveal = nextTab === "tome" && current.activeTab === "tome";
    return {
      ...current,
      activeTab: nextTab,
      revealQueue: keepReveal ? current.revealQueue : [],
      revealTick: keepReveal ? current.revealTick : 0,
      revealStartedAt: keepReveal ? current.revealStartedAt : 0,
    };
  }

  if (action.type === "aa02-buy-offer") {
    return {
      ...current,
      solved: current.solved || Boolean(action.applied),
      lastMessage: safeText(action.message) || (action.applied ? "Purchase completed." : "Purchase failed."),
    };
  }

  if (action.type === "aa02-sell-selected") {
    return {
      ...current,
      solved: current.solved || Boolean(action.applied),
      lastMessage: safeText(action.message) || (action.applied ? "Sale completed." : "Sale failed."),
    };
  }

  if (action.type === "aa02-tome-starter" || action.type === "aa02-tome-pull") {
    const grants = Array.isArray(action.grants)
      ? action.grants.map((entry) => safeText(entry).toLowerCase()).filter(Boolean)
      : safeText(action.grant)
        ? [safeText(action.grant).toLowerCase()]
        : [];
    return {
      ...current,
      solved: current.solved || Boolean(action.applied),
      revealQueue: grants,
      revealTick: grants.length ? 1 : 0,
      revealStartedAt: Date.now(),
      lastRevealRouteNonce: Math.max(0, safeInt(action.routeVisitNonce, current.lastRevealRouteNonce)),
      activeTab: "tome",
      lastMessage: safeText(action.message) || "The Tome remains quiet.",
    };
  }

  return current;
}

function tabButton(tabId, active, label) {
  return `
    <button
      type="button"
      data-node-id="${NODE_ID}"
      data-node-action="aa02-open-tab"
      data-tab="${escapeHtml(tabId)}"
      ${active ? "disabled" : ""}
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function shopMarkup(runtime, arcane) {
  const nowLabel = new Date(runtime.shopHourKey * 3600000).toLocaleString();
  return `
    <section class="card">
      <h3>Shop</h3>
      <p class="muted">Rotates hourly. Current rotation started: ${escapeHtml(nowLabel)}.</p>
      <div class="worm01-card-grid">
        ${runtime.shopOffers.map((offer) => `
          <article class="card">
            <h4>${escapeHtml(displayItemLabel(offer.lootDrop))}</h4>
            <p><strong>Rarity:</strong> ${escapeHtml(safeText(offer.lootDrop.rarity))}</p>
            <p><strong>Details:</strong> ${escapeHtml(normalizeItemDetail(offer.lootDrop))}</p>
            <p><strong>Cost:</strong> ${escapeHtml(String(offer.cost))} mana crystals</p>
            <button
              type="button"
              data-node-id="${NODE_ID}"
              data-node-action="aa02-buy-offer"
              data-offer-id="${escapeHtml(offer.id)}"
              data-cost="${escapeHtml(String(offer.cost))}"
              data-drop="${escapeHtml(serializeOfferDrop(offer.lootDrop))}"
              ${arcane.manaCrystals >= offer.cost ? "" : "disabled"}
            >
              Buy
            </button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function auctionMarkup(runtime, state, arcane) {
  const loot = lootInventoryFromState(state || {}, Date.now());
  const itemEntries = Object.values(loot.items || {}).sort((left, right) => left.label.localeCompare(right.label));
  if (!itemEntries.length) {
    return `
      <section class="card">
        <h3>Auction</h3>
        <p class="muted">No loot available to auction.</p>
      </section>
    `;
  }

  return `
    <section class="card">
      <h3>Auction</h3>
      <div class="worm01-card-grid">
        ${itemEntries.map((item) => {
          const base = estimateLootShopPrice(item, {
            totalSpentAtCourt: arcane.totalSpentAtCourt,
            buyDiscountPct: arcane.bonuses.buyDiscountPct,
            shopRegion: "aa",
          });
          const payout = Math.max(
            1,
            Math.floor(base * 0.75 * (1 + Math.max(0, Number(arcane.bonuses.sellBonusPct) || 0))),
          );
          const equipped = isLootItemEquipped(state || {}, item.id);
          return `
            <article class="card">
              <h4>${escapeHtml(displayItemLabel(item))}</h4>
              <p><strong>Quantity:</strong> ${escapeHtml(String(item.quantity))}</p>
              <p><strong>Details:</strong> ${escapeHtml(normalizeItemDetail(item))}</p>
              <p><strong>Payout:</strong> ${escapeHtml(String(payout))} mana crystals</p>
              <button
                type="button"
                data-node-id="${NODE_ID}"
                data-node-action="aa02-sell-selected"
                data-item-id="${escapeHtml(item.id)}"
                data-payout="${escapeHtml(String(payout))}"
                ${equipped ? "disabled" : ""}
              >
                ${equipped ? "Unequip first" : "Sell"}
              </button>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function tomeRevealMarkup(runtime) {
  if (!runtime.revealQueue.length || runtime.revealTick <= 0) {
    return "";
  }
  const index = Math.min(runtime.revealQueue.length - 1, runtime.revealTick - 1);
  const glyphId = runtime.revealQueue[index];
  if (!glyphId) {
    return "";
  }
  const niceName = readableGlyphName(glyphId);
  return `
    <div class="aa02-tome-flash ${runtime.revealQueue.length ? "is-revealing" : ""}" aria-live="polite">
      <div class="aa02-tome-flash-name">
        ${renderGlyphSymbol(glyphId)}
      </div>
      <p class="aa02-tome-flash-label">${escapeHtml(niceName)}</p>
    </div>
  `;
}

function tomeMarkup(state, arcane, runtime) {
  const pullCost = computeTomePullCost(state || {});
  const regionPoolSize = regionGlyphPool().length;
  const enhancementPoolSize = enhancementGlyphPool().length;
  const ownedRegionCount = arcane.grimoire.regionGlyphs.length;
  const ownedEnhancementCount = arcane.grimoire.enhancementGlyphs.length;
  const allCollected = ownedRegionCount >= regionPoolSize && ownedEnhancementCount >= enhancementPoolSize;
  return `
    <section class="card aa02-tome-book">
      <h3>Tome of Glyphs</h3>
      <div class="aa02-tome-spread">
        <section class="aa02-tome-page">
          ${tomeRevealMarkup(runtime)}
        </section>
      </div>
      <div class="toolbar">
        ${
          arcane.grimoire.starterGranted
            ? `<button type="button" data-node-id="${NODE_ID}" data-node-action="aa02-tome-pull" ${arcane.manaCrystals >= pullCost && !allCollected ? "" : "disabled"}>Offer ${escapeHtml(String(pullCost))} crystals to the tome</button>`
            : `<button type="button" data-node-id="${NODE_ID}" data-node-action="aa02-tome-starter">Inscribe Starter Glyphs</button>`
        }
      </div>
      ${allCollected ? `<p class="muted">All known glyphs acquired.</p>` : ""}
    </section>
  `;
}

export function renderAa02Experience(context) {
  const runtime = synchronizeAa02Runtime(context.runtime, context);
  const arcane = arcaneSystemFromState(context.state || {}, Date.now());
  const activeTab = runtime.activeTab || "shop";

  const body = activeTab === "auction"
    ? auctionMarkup(runtime, context.state || {}, arcane)
    : activeTab === "tome"
      ? tomeMarkup(context.state || {}, arcane, runtime)
      : shopMarkup(runtime, arcane);

  return `
    <article class="aa02-node" data-node-id="${NODE_ID}">
      <section class="card">
        <h3>Climber's Court</h3>
        <p><strong>Mana Crystals:</strong> ${escapeHtml(String(arcane.manaCrystals))}</p>
        <p><strong>Total Spent at Court:</strong> ${escapeHtml(String(arcane.totalSpentAtCourt))}</p>
        <p><strong>Enchanter Attunement:</strong> ${arcane.attunements.enchanter ? "Bound" : "Unbound"}</p>
        <div class="toolbar">
          ${tabButton("shop", activeTab === "shop", "Shop")}
          ${tabButton("auction", activeTab === "auction", "Auction")}
          ${tabButton("tome", activeTab === "tome", "Tome of Glyphs")}
        </div>
      </section>
      ${body}
      ${activeTab !== "tome" ? statusMarkup(runtime) : ""}
    </article>
  `;
}

export function buildAa02ActionFromElement(element) {
  const action = safeText(element.getAttribute("data-node-action"));
  if (!action) {
    return null;
  }
  if (action === "aa02-open-tab") {
    return {
      type: action,
      tab: safeText(element.getAttribute("data-tab")).toLowerCase(),
      at: Date.now(),
    };
  }
  if (action === "aa02-buy-offer") {
    return {
      type: action,
      offerId: safeText(element.getAttribute("data-offer-id")),
      cost: Math.max(1, safeInt(element.getAttribute("data-cost"), 1)),
      lootDrop: parseOfferDrop(element.getAttribute("data-drop")),
      at: Date.now(),
    };
  }
  if (action === "aa02-sell-selected") {
    return {
      type: action,
      itemId: safeText(element.getAttribute("data-item-id")),
      payout: Math.max(1, safeInt(element.getAttribute("data-payout"), 1)),
      at: Date.now(),
    };
  }
  if (action === "aa02-tome-starter" || action === "aa02-tome-pull") {
    return {
      type: action,
      grants: parseGlyphList(element.getAttribute("data-grants")),
      at: Date.now(),
    };
  }
  return null;
}

export const AA02_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialAa02Runtime,
  synchronizeRuntime: synchronizeAa02Runtime,
  render: renderAa02Experience,
  reduceRuntime: reduceAa02Runtime,
  validateRuntime: validateAa02Runtime,
  buildActionFromElement: buildAa02ActionFromElement,
};
