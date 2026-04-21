const FALLBACK_SYMBOL_KEY = "nexus";

const SYMBOL_SPECS = Object.freeze({
  "nexus": {
    label: "Nexus Hub",
    paths: [
      "M12 2.5L21.5 12L12 21.5L2.5 12Z",
      "M12 5.2V18.8",
      "M5.2 12H18.8",
    ],
  },
  "cradle": {
    label: "Cradle",
    paths: [
      "M4.2 15.2C6.1 18.7 8.7 20.1 12 20.1C15.3 20.1 17.9 18.7 19.8 15.2",
      "M7.4 15.2H16.6",
      "M12 4.2L15 10.2H9Z",
    ],
  },
  "wandering-inn": {
    label: "The Wandering Inn",
    paths: [
      "M4.2 11.4L12 4.4L19.8 11.4",
      "M6.3 10.9V19.3H17.7V10.9",
      "M10.2 19.3V14.6H13.8V19.3",
      "M8.5 13.1H8.5",
      "M15.5 13.1H15.5",
    ],
  },
  "worm": {
    label: "Worm",
    paths: [
      "M6 6.2C7.5 4.9 9.8 4.6 11.8 5.4C14.1 6.3 15.6 8.6 15.4 11C15.1 14 12.3 16.3 9.2 16",
      "M9.2 16C7.3 15.8 5.8 14.5 5.4 12.7",
      "M10.8 8.8L13.9 12",
      "M8.3 11.5L11.4 14.7",
    ],
  },
  "mother-of-learning": {
    label: "Mother of Learning",
    paths: [
      "M7.1 4.4H16.9V9.1H7.1Z",
      "M7.1 14.9H16.9V19.6H7.1Z",
      "M9.2 9.1C9.2 11 10.6 12 12 12C13.4 12 14.8 13 14.8 14.9",
      "M14.8 9.1C14.8 11 13.4 12 12 12C10.6 12 9.2 13 9.2 14.9",
    ],
  },
  "hall-of-proofs": {
    label: "Hall of Proofs",
    paths: [
      "M3.8 12H10.7",
      "M10.7 6.1V17.9",
      "M10.7 12H20.2",
      "M17.1 8.9L20.2 12L17.1 15.1",
    ],
  },
  "prime-vault": {
    label: "Prime Vault",
    paths: [
      "M12 4.1L18.5 7.9V16.1L12 19.9L5.5 16.1V7.9Z",
      "M12 8V16",
      "M8.6 10.1H15.4",
      "M9.3 13.4H14.7",
    ],
  },
  "arcane-ascension": {
    label: "Arcane Ascension",
    paths: [
      "M12 3.8L18.9 20.2H5.1Z",
      "M9.3 14.4L12 11.5L14.7 14.4",
      "M12 11.5V18.3",
      "M8.1 17.2H15.9",
    ],
  },
  "symmetry-forge": {
    label: "Symmetry Forge",
    paths: [
      "M6 5.4L12 9.1L18 5.4",
      "M6 18.6L12 14.9L18 18.6",
      "M6 5.4V18.6",
      "M18 5.4V18.6",
      "M12 9.1V14.9",
    ],
  },
  "cosmere": {
    label: "The Cosmere",
    paths: [
      "M12 6.2C15.2 6.2 17.8 8.8 17.8 12C17.8 15.2 15.2 17.8 12 17.8C8.8 17.8 6.2 15.2 6.2 12C6.2 8.8 8.8 6.2 12 6.2Z",
      "M3.9 12C5.8 9.1 8.7 7.4 12 7.4C15.3 7.4 18.2 9.1 20.1 12",
      "M3.9 12C5.8 14.9 8.7 16.6 12 16.6C15.3 16.6 18.2 14.9 20.1 12",
    ],
  },
  "dungeon-crawler-carl": {
    label: "Dungeon Crawler Carl",
    paths: [
      "M6.2 7.2H17.8V16.8H6.2Z",
      "M9 10H9",
      "M15 10H15",
      "M12 14H12",
      "M8.1 6.4L12 3.8L15.9 6.4",
    ],
  },
  "curved-atlas": {
    label: "Curved Atlas",
    paths: [
      "M12 4.1C16.2 4.1 19.9 7.8 19.9 12C19.9 16.2 16.2 19.9 12 19.9C7.8 19.9 4.1 16.2 4.1 12C4.1 7.8 7.8 4.1 12 4.1Z",
      "M7.4 8.1C9.2 9.5 10.4 10.8 12 12C13.6 13.2 14.8 14.5 16.6 15.9",
      "M8.2 16.4C9.5 14.8 10.8 13.6 12 12C13.2 10.4 14.5 9.2 15.8 7.6",
    ],
  },
  "practical-guide": {
    label: "A Practical Guide to Evil",
    paths: [
      "M12 4.1V18.8",
      "M6.2 8.1H17.8",
      "M7.2 8.1L5.4 12.2H9Z",
      "M16.8 8.1L15 12.2H18.6Z",
      "M9 18.8H15",
    ],
  },
  "convergence": {
    label: "Convergence",
    paths: [
      "M6.2 6.2L17.8 17.8",
      "M17.8 6.2L6.2 17.8",
      "M12 3.8V20.2",
      "M3.8 12H20.2",
      "M8.5 8.5L15.5 15.5",
      "M15.5 8.5L8.5 15.5",
    ],
  },
  "final-arc": {
    label: "Final Arc",
    paths: [
      "M12 3.8L20.2 8.6V15.4L12 20.2L3.8 15.4V8.6Z",
      "M12 7.4V16.6",
      "M8.6 10.6L12 12.6L15.4 10.6",
      "M8.6 13.4L12 15.4L15.4 13.4",
    ],
  },
});

const SECTION_SYMBOL_KEY = Object.freeze({
  "Nexus Hub": "nexus",
  "Cradle": "cradle",
  "The Wandering Inn": "wandering-inn",
  "Wandering Inn": "wandering-inn",
  "Worm": "worm",
  "Mother of Learning": "mother-of-learning",
  "MoL": "mother-of-learning",
  "Hall of Proofs": "hall-of-proofs",
  "Logic": "hall-of-proofs",
  "Prime Vault": "prime-vault",
  "Number Theory": "prime-vault",
  "Arcane Ascension": "arcane-ascension",
  "Symmetry Forge": "symmetry-forge",
  "Abstract Algebra": "symmetry-forge",
  "The Cosmere": "cosmere",
  "Cosmere": "cosmere",
  "Dungeon Crawler Carl": "dungeon-crawler-carl",
  "Curved Atlas": "curved-atlas",
  "Differential Geometry": "curved-atlas",
  "A Practical Guide to Evil": "practical-guide",
  "Practical Guide": "practical-guide",
  "Final Arc": "final-arc",
  "Crossovers": "convergence",
  "Convergence I": "convergence",
  "Convergence II": "convergence",
  "Convergence III": "convergence",
  "Convergence IV": "convergence",
  "Convergence V": "convergence",
  "Convergence VI": "convergence",
  "Convergence VII": "convergence",
  "Convergence VIII": "convergence",
});

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function symbolKeyForSection(sectionName) {
  const key = SECTION_SYMBOL_KEY[String(sectionName || "")];
  if (key && SYMBOL_SPECS[key]) {
    return key;
  }
  return FALLBACK_SYMBOL_KEY;
}

export function symbolSpecForKey(symbolKey) {
  return SYMBOL_SPECS[symbolKey] || SYMBOL_SPECS[FALLBACK_SYMBOL_KEY];
}

export function symbolLabelForKey(symbolKey) {
  return symbolSpecForKey(symbolKey).label;
}

export function symbolKeyForNode(node) {
  if (!node || typeof node !== "object") {
    return FALLBACK_SYMBOL_KEY;
  }
  return symbolKeyForSection(node.section || node.sheet || "");
}

export function renderRegionSymbol({ section, symbolKey, className = "", decorative = true } = {}) {
  const resolvedKey = symbolKey && SYMBOL_SPECS[symbolKey]
    ? symbolKey
    : symbolKeyForSection(section);
  const spec = symbolSpecForKey(resolvedKey);
  const classes = ["region-symbol", className].filter(Boolean).join(" ");
  const aria = decorative
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-label="${escapeAttribute(spec.label)}"`;

  return `
    <svg class="${escapeAttribute(classes)}" data-symbol-key="${escapeAttribute(resolvedKey)}" viewBox="0 0 24 24" ${aria}>
      <circle class="region-symbol-orbit" cx="12" cy="12" r="10"></circle>
      ${spec.paths
    .map((path) => `<path class="region-symbol-line" d="${escapeAttribute(path)}"></path>`)
    .join("")}
    </svg>
  `;
}

export function regionSymbolKeys() {
  return Object.keys(SYMBOL_SPECS);
}
