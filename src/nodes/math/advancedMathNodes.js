import { escapeHtml } from "../../templates/shared.js";

function normalizeChoiceRuntime(candidate, rows) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const selections = source.selections && typeof source.selections === "object" ? source.selections : {};
  const normalizedSelections = {};

  for (const row of rows) {
    const selected = String(selections[row.id] || "");
    normalizedSelections[row.id] = row.choices.includes(selected) ? selected : "";
  }

  const solved = rows.every((row) => normalizedSelections[row.id] === row.target);
  return {
    selections: normalizedSelections,
    solved: Boolean(source.solved) || solved,
    lastMessage: String(source.lastMessage || ""),
  };
}

function createChoiceNodeExperience(config) {
  const { nodeId, title, subtitle, rows, solvedMessage } = config;
  const rowById = Object.freeze(Object.fromEntries(rows.map((row) => [row.id, row])));

  function initialState() {
    return normalizeChoiceRuntime({}, rows);
  }

  function validateRuntime(runtime) {
    return Boolean(normalizeChoiceRuntime(runtime, rows).solved);
  }

  function reduceRuntime(runtime, action) {
    const current = normalizeChoiceRuntime(runtime, rows);
    if (!action || typeof action !== "object") {
      return current;
    }
    if (action.type !== "math-choose") {
      return current;
    }

    const rowId = String(action.rowId || "");
    const choice = String(action.choice || "");
    const row = rowById[rowId];
    if (!row || !row.choices.includes(choice)) {
      return current;
    }

    const nextSelections = {
      ...current.selections,
      [rowId]: choice,
    };
    const solved = rows.every((entry) => nextSelections[entry.id] === entry.target);
    return {
      ...current,
      selections: nextSelections,
      solved,
      lastMessage: solved ? solvedMessage : "",
    };
  }

  function buildActionFromElement(element) {
    if (element.getAttribute("data-node-action") !== "math-choose") {
      return null;
    }
    return {
      type: "math-choose",
      rowId: element.getAttribute("data-row-id") || "",
      choice: element.getAttribute("data-choice") || "",
      at: Date.now(),
    };
  }

  function render(context) {
    const runtime = normalizeChoiceRuntime(context.runtime, rows);
    return `
      <article class="math-choice-node" data-node-id="${escapeHtml(nodeId)}">
        <section class="card math-choice-head">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(subtitle)}</p>
        </section>
        <section class="math-choice-grid">
          ${rows.map((row) => {
            const selected = runtime.selections[row.id];
            const correct = selected && selected === row.target;
            return `
              <article class="card math-choice-row ${correct ? "is-correct" : ""}">
                <h4>${escapeHtml(row.label)}</h4>
                <div class="math-choice-options">
                  ${row.choices.map((choice) => {
                    const isSelected = selected === choice;
                    return `
                      <button
                        type="button"
                        class="math-choice-option ${isSelected ? "is-selected" : ""}"
                        data-node-id="${escapeHtml(nodeId)}"
                        data-node-action="math-choose"
                        data-row-id="${escapeHtml(row.id)}"
                        data-choice="${escapeHtml(choice)}"
                      >
                        ${escapeHtml(choice)}
                      </button>
                    `;
                  }).join("")}
                </div>
              </article>
            `;
          }).join("")}
        </section>
        ${runtime.lastMessage ? `<p class="key-hint">${escapeHtml(runtime.lastMessage)}</p>` : ""}
      </article>
    `;
  }

  return {
    nodeId,
    initialState,
    render,
    reduceRuntime,
    validateRuntime,
    buildActionFromElement,
  };
}

const LOG03_CONFIG = {
  nodeId: "LOG03",
  title: "Fitch Staircase",
  subtitle: "Pick the correct rule or conclusion for each proof step.",
  solvedMessage: "Proof frame assembled.",
  rows: [
    {
      id: "log03-r1",
      label: "From p -> q and p, conclude:",
      choices: ["q", "p", "not q"],
      target: "q",
    },
    {
      id: "log03-r2",
      label: "To prove p -> q in a direct proof, begin by assuming:",
      choices: ["p", "q", "not p"],
      target: "p",
    },
    {
      id: "log03-r3",
      label: "If an assumption leads to contradiction, infer:",
      choices: ["negation of the assumption", "repeat the assumption", "a tautology"],
      target: "negation of the assumption",
    },
    {
      id: "log03-r4",
      label: "Rule turning (p -> q) and (q -> r) into (p -> r):",
      choices: ["hypothetical syllogism", "DeMorgan", "contraposition"],
      target: "hypothetical syllogism",
    },
  ],
};

const LOG04_CONFIG = {
  nodeId: "LOG04",
  title: "Modality Lanterns",
  subtitle: "Align modal meanings with their correct scope.",
  solvedMessage: "Necessity lens calibrated.",
  rows: [
    {
      id: "log04-r1",
      label: "Necessary means true in:",
      choices: ["all worlds", "at least one world", "no worlds"],
      target: "all worlds",
    },
    {
      id: "log04-r2",
      label: "Possible means true in:",
      choices: ["at least one world", "all worlds", "no worlds"],
      target: "at least one world",
    },
    {
      id: "log04-r3",
      label: "Impossible means true in:",
      choices: ["no worlds", "all worlds", "exactly two worlds"],
      target: "no worlds",
    },
    {
      id: "log04-r4",
      label: "If a claim is necessary, it is also:",
      choices: ["possible", "impossible", "independent"],
      target: "possible",
    },
  ],
};

const LOG05_CONFIG = {
  nodeId: "LOG05",
  title: "Self-Reference Cell",
  subtitle: "Resolve the metamathematical statements into their right category.",
  solvedMessage: "Consistency key stabilized.",
  rows: [
    {
      id: "log05-r1",
      label: "Sentence: 'This sentence is false' is:",
      choices: ["paradoxical", "necessary", "tautological"],
      target: "paradoxical",
    },
    {
      id: "log05-r2",
      label: "A consistent system cannot prove both P and:",
      choices: ["not P", "Q", "P and Q"],
      target: "not P",
    },
    {
      id: "log05-r3",
      label: "A Godel-style sentence encodes a claim about:",
      choices: ["provability", "geometry", "probability"],
      target: "provability",
    },
    {
      id: "log05-r4",
      label: "To avoid collapse, a formal system needs:",
      choices: ["consistency", "randomness", "infinite axioms"],
      target: "consistency",
    },
  ],
};

const LOG06_CONFIG = {
  nodeId: "LOG06",
  title: "Proof of Passage",
  subtitle: "Finalize the gate by selecting the proper proof instruments.",
  solvedMessage: "Proof stamp impressed.",
  rows: [
    {
      id: "log06-r1",
      label: "From P and (P -> Q), validly infer:",
      choices: ["Q", "not Q", "P -> Q"],
      target: "Q",
    },
    {
      id: "log06-r2",
      label: "From not not P, infer:",
      choices: ["P", "not P", "P and not P"],
      target: "P",
    },
    {
      id: "log06-r3",
      label: "From for all x P(x), infer:",
      choices: ["P(c)", "exists x not P(x)", "for all x not P(x)"],
      target: "P(c)",
    },
    {
      id: "log06-r4",
      label: "A formal proof is complete when each line has:",
      choices: ["a justification", "a color code", "a contradiction"],
      target: "a justification",
    },
  ],
};

const NUM03_CONFIG = {
  nodeId: "NUM03",
  title: "Chinese Gate",
  subtitle: "Set the congruence components to open the paired lock.",
  solvedMessage: "Congruence pair secured.",
  rows: [
    {
      id: "num03-r1",
      label: "n mod 3 should be:",
      choices: ["0", "1", "2"],
      target: "2",
    },
    {
      id: "num03-r2",
      label: "n mod 5 should be:",
      choices: ["2", "3", "4"],
      target: "4",
    },
    {
      id: "num03-r3",
      label: "n mod 7 should be:",
      choices: ["0", "1", "6"],
      target: "1",
    },
    {
      id: "num03-r4",
      label: "The theorem used to combine coprime congruences is:",
      choices: ["Chinese remainder theorem", "Euclidean algorithm", "Fermat little theorem"],
      target: "Chinese remainder theorem",
    },
  ],
};

const NUM04_CONFIG = {
  nodeId: "NUM04",
  title: "Quadratic Orchard",
  subtitle: "Classify root behavior and complete the orchard chart.",
  solvedMessage: "Square-root lantern lit.",
  rows: [
    {
      id: "num04-r1",
      label: "If discriminant > 0, a quadratic has:",
      choices: ["two distinct real roots", "one repeated real root", "two non-real roots"],
      target: "two distinct real roots",
    },
    {
      id: "num04-r2",
      label: "If discriminant = 0, a quadratic has:",
      choices: ["one repeated real root", "two distinct real roots", "no roots"],
      target: "one repeated real root",
    },
    {
      id: "num04-r3",
      label: "If discriminant < 0, a quadratic has:",
      choices: ["two non-real roots", "one repeated real root", "two distinct real roots"],
      target: "two non-real roots",
    },
    {
      id: "num04-r4",
      label: "Completing the square rewrites ax^2+bx+c into:",
      choices: ["vertex form", "prime form", "residue form"],
      target: "vertex form",
    },
  ],
};

const NUM05_CONFIG = {
  nodeId: "NUM05",
  title: "Totient Telegraph",
  subtitle: "Tune the channel by matching each value with its Euler totient.",
  solvedMessage: "Public-private key generated.",
  rows: [
    {
      id: "num05-r1",
      label: "phi(9) equals:",
      choices: ["4", "6", "8"],
      target: "6",
    },
    {
      id: "num05-r2",
      label: "phi(10) equals:",
      choices: ["2", "4", "6"],
      target: "4",
    },
    {
      id: "num05-r3",
      label: "phi(14) equals:",
      choices: ["4", "6", "8"],
      target: "6",
    },
    {
      id: "num05-r4",
      label: "For prime p, phi(p) is:",
      choices: ["p - 1", "p + 1", "1"],
      target: "p - 1",
    },
  ],
};

const NUM06_CONFIG = {
  nodeId: "NUM06",
  title: "Calendar of Remainders",
  subtitle: "Resolve the final residue calendar across all dials.",
  solvedMessage: "Congruence lens focused.",
  rows: [
    {
      id: "num06-r1",
      label: "Set n mod 4 to:",
      choices: ["0", "1", "2", "3"],
      target: "1",
    },
    {
      id: "num06-r2",
      label: "Set n mod 6 to:",
      choices: ["1", "3", "5"],
      target: "5",
    },
    {
      id: "num06-r3",
      label: "Set n mod 9 to:",
      choices: ["2", "4", "8"],
      target: "2",
    },
    {
      id: "num06-r4",
      label: "Set n mod 11 to:",
      choices: ["1", "7", "9"],
      target: "7",
    },
  ],
};

const ALG01_CONFIG = {
  nodeId: "ALG01",
  title: "Cayley Banquet",
  subtitle: "Match each product in the cyclic table.",
  solvedMessage: "Operation card stamped.",
  rows: [
    {
      id: "alg01-r1",
      label: "In C3 with generator r, r * r equals:",
      choices: ["e", "r", "r^2"],
      target: "r^2",
    },
    {
      id: "alg01-r2",
      label: "r * r^2 equals:",
      choices: ["e", "r", "r^2"],
      target: "e",
    },
    {
      id: "alg01-r3",
      label: "r^2 * r^2 equals:",
      choices: ["e", "r", "r^2"],
      target: "r",
    },
    {
      id: "alg01-r4",
      label: "Identity element action:",
      choices: ["leaves every element unchanged", "squares each element", "maps all to e"],
      target: "leaves every element unchanged",
    },
  ],
};

const ALG02_CONFIG = {
  nodeId: "ALG02",
  title: "Permutation Dance",
  subtitle: "Track the cycle map through each position.",
  solvedMessage: "Orbit ribbon braided.",
  rows: [
    {
      id: "alg02-r1",
      label: "For cycle (1 2 3), image of 1 is:",
      choices: ["2", "3", "1"],
      target: "2",
    },
    {
      id: "alg02-r2",
      label: "For cycle (1 2 3), image of 2 is:",
      choices: ["1", "2", "3"],
      target: "3",
    },
    {
      id: "alg02-r3",
      label: "For cycle (1 2 3), image of 3 is:",
      choices: ["1", "2", "3"],
      target: "1",
    },
    {
      id: "alg02-r4",
      label: "Inverse of (1 2 3) is:",
      choices: ["(1 3 2)", "(1 2 3)", "(2 3)"],
      target: "(1 3 2)",
    },
  ],
};

const ALG03_CONFIG = {
  nodeId: "ALG03",
  title: "Isomorphism Mirror",
  subtitle: "Choose the defining properties of an isomorphism.",
  solvedMessage: "Mirror pair aligned.",
  rows: [
    {
      id: "alg03-r1",
      label: "An isomorphism must be:",
      choices: ["bijective", "constant", "partial"],
      target: "bijective",
    },
    {
      id: "alg03-r2",
      label: "It must preserve the:",
      choices: ["operation", "node color", "set size only"],
      target: "operation",
    },
    {
      id: "alg03-r3",
      label: "Identity maps to:",
      choices: ["identity", "generator", "zero divisor"],
      target: "identity",
    },
    {
      id: "alg03-r4",
      label: "Inverse elements map to:",
      choices: ["inverse elements", "identity always", "idempotents"],
      target: "inverse elements",
    },
  ],
};

const ALG04_CONFIG = {
  nodeId: "ALG04",
  title: "Subgroup Lattice",
  subtitle: "Lock each lattice statement to the correct algebraic fact.",
  solvedMessage: "Lattice hook secured.",
  rows: [
    {
      id: "alg04-r1",
      label: "Order of H divides order of G by:",
      choices: ["Lagrange theorem", "Sylow theorem", "Noether normalization"],
      target: "Lagrange theorem",
    },
    {
      id: "alg04-r2",
      label: "Index [G:H] equals:",
      choices: ["|G| / |H|", "|H| / |G|", "|G| + |H|"],
      target: "|G| / |H|",
    },
    {
      id: "alg04-r3",
      label: "Quotient group G/H exists when H is:",
      choices: ["normal", "cyclic", "finite"],
      target: "normal",
    },
    {
      id: "alg04-r4",
      label: "Normality condition is:",
      choices: ["gHg^-1 = H", "gH = H for one g", "H subseteq g for all g"],
      target: "gHg^-1 = H",
    },
  ],
};

const ALG05_CONFIG = {
  nodeId: "ALG05",
  title: "Ringwork Workshop",
  subtitle: "Route each ring-homomorphism fact to its proper socket.",
  solvedMessage: "Homomorphism key forged.",
  rows: [
    {
      id: "alg05-r1",
      label: "A ring homomorphism preserves:",
      choices: ["addition and multiplication", "only multiplication", "only additive inverses"],
      target: "addition and multiplication",
    },
    {
      id: "alg05-r2",
      label: "Kernel of a ring homomorphism is an:",
      choices: ["ideal", "orbit", "basis"],
      target: "ideal",
    },
    {
      id: "alg05-r3",
      label: "Homomorphism is injective iff kernel is:",
      choices: ["{0}", "whole ring", "a maximal ideal"],
      target: "{0}",
    },
    {
      id: "alg05-r4",
      label: "Image of a ring homomorphism is a:",
      choices: ["subring", "quotient module", "field always"],
      target: "subring",
    },
  ],
};

const ALG06_CONFIG = {
  nodeId: "ALG06",
  title: "Action on the Archive",
  subtitle: "Finalize the group-action console with orbit and stabilizer facts.",
  solvedMessage: "Symmetry mirror awakened.",
  rows: [
    {
      id: "alg06-r1",
      label: "Orbit-stabilizer theorem states:",
      choices: ["|G| = |Orb(x)| * |Stab(x)|", "|G| = |Orb(x)| + |Stab(x)|", "|G| = |Stab(x)|^2"],
      target: "|G| = |Orb(x)| * |Stab(x)|",
    },
    {
      id: "alg06-r2",
      label: "A transitive action has:",
      choices: ["one orbit", "one stabilizer only", "no fixed points"],
      target: "one orbit",
    },
    {
      id: "alg06-r3",
      label: "x is fixed when g.x = x for:",
      choices: ["every g in G", "one nontrivial g", "all x only"],
      target: "every g in G",
    },
    {
      id: "alg06-r4",
      label: "Burnside's lemma averages:",
      choices: ["fixed points", "orbit sizes directly", "kernel dimensions"],
      target: "fixed points",
    },
  ],
};

const GEO01_CONFIG = {
  nodeId: "GEO01",
  title: "Geodesic Postcards",
  subtitle: "Identify the shortest-path geometry for each surface.",
  solvedMessage: "Path thread wound tight.",
  rows: [
    {
      id: "geo01-r1",
      label: "Geodesics on a sphere are:",
      choices: ["great circles", "latitude circles only", "straight chords"],
      target: "great circles",
    },
    {
      id: "geo01-r2",
      label: "Geodesics on a plane are:",
      choices: ["straight lines", "parabolas", "spirals"],
      target: "straight lines",
    },
    {
      id: "geo01-r3",
      label: "A cylinder geodesic can be viewed as:",
      choices: ["a straight line on the unwrapped sheet", "a circle around the axis", "a random curve"],
      target: "a straight line on the unwrapped sheet",
    },
    {
      id: "geo01-r4",
      label: "Shortest paths are determined by the:",
      choices: ["metric", "coloring", "chart name"],
      target: "metric",
    },
  ],
};

const GEO02_CONFIG = {
  nodeId: "GEO02",
  title: "Atlas Transition",
  subtitle: "Match each atlas rule to its transition-map requirement.",
  solvedMessage: "Chart pair synchronized.",
  rows: [
    {
      id: "geo02-r1",
      label: "Overlap maps between charts should be:",
      choices: ["smooth", "piecewise random", "integer-valued"],
      target: "smooth",
    },
    {
      id: "geo02-r2",
      label: "A transition map converts:",
      choices: ["coordinates in one chart to coordinates in another", "points to colors", "vectors to scalars only"],
      target: "coordinates in one chart to coordinates in another",
    },
    {
      id: "geo02-r3",
      label: "Jacobian matrix tracks changes of:",
      choices: ["coordinate basis directions", "topology class", "curvature sign only"],
      target: "coordinate basis directions",
    },
    {
      id: "geo02-r4",
      label: "A compatible atlas needs transitions that are:",
      choices: ["smooth and invertible", "constant", "linear only"],
      target: "smooth and invertible",
    },
  ],
};

const GEO03_CONFIG = {
  nodeId: "GEO03",
  title: "Curvature Defects",
  subtitle: "Assign each curvature statement to its correct regime.",
  solvedMessage: "Curvature chip seated.",
  rows: [
    {
      id: "geo03-r1",
      label: "Triangle angle sum on a sphere is:",
      choices: ["greater than 180", "equal to 180", "less than 180"],
      target: "greater than 180",
    },
    {
      id: "geo03-r2",
      label: "Triangle angle sum on hyperbolic space is:",
      choices: ["less than 180", "equal to 180", "greater than 180"],
      target: "less than 180",
    },
    {
      id: "geo03-r3",
      label: "Gaussian curvature of Euclidean plane is:",
      choices: ["0", "1", "-1"],
      target: "0",
    },
    {
      id: "geo03-r4",
      label: "Positive curvature tends to make geodesics:",
      choices: ["converge", "diverge", "stay parallel forever"],
      target: "converge",
    },
  ],
};

const GEO04_CONFIG = {
  nodeId: "GEO04",
  title: "Tangent Courier",
  subtitle: "Route vectors through transport and connection rules.",
  solvedMessage: "Transport arrow fixed.",
  rows: [
    {
      id: "geo04-r1",
      label: "A tangent vector at x belongs to:",
      choices: ["the tangent space at x", "the cotangent space at all points", "only Euclidean R3"],
      target: "the tangent space at x",
    },
    {
      id: "geo04-r2",
      label: "Parallel transport along a Levi-Civita connection preserves:",
      choices: ["inner products", "coordinates exactly", "curvature value"],
      target: "inner products",
    },
    {
      id: "geo04-r3",
      label: "A connection defines:",
      choices: ["directional differentiation of vector fields", "global coordinates", "group multiplication"],
      target: "directional differentiation of vector fields",
    },
    {
      id: "geo04-r4",
      label: "Holonomy captures:",
      choices: ["net rotation after transporting around a loop", "total area only", "distance to origin"],
      target: "net rotation after transporting around a loop",
    },
  ],
};

const GEO05_CONFIG = {
  nodeId: "GEO05",
  title: "Vector Field Garden",
  subtitle: "Bind each field diagnostic to the right physical meaning.",
  solvedMessage: "Field marker planted.",
  rows: [
    {
      id: "geo05-r1",
      label: "Positive divergence indicates a local:",
      choices: ["source", "sink", "shear only"],
      target: "source",
    },
    {
      id: "geo05-r2",
      label: "Curl in 2D tracks local:",
      choices: ["rotation", "compression", "translation"],
      target: "rotation",
    },
    {
      id: "geo05-r3",
      label: "Gradient points toward:",
      choices: ["steepest ascent", "steepest descent", "zero change always"],
      target: "steepest ascent",
    },
    {
      id: "geo05-r4",
      label: "Zero winding around a loop suggests:",
      choices: ["no net topological turn", "maximal vortex strength", "positive curvature"],
      target: "no net topological turn",
    },
  ],
};

const GEO06_CONFIG = {
  nodeId: "GEO06",
  title: "Cartographer's Manifold",
  subtitle: "Complete the manifold axioms and metric machinery.",
  solvedMessage: "Curvature compass aligned.",
  rows: [
    {
      id: "geo06-r1",
      label: "A manifold locally looks like:",
      choices: ["Euclidean space", "a finite field", "a single polygon"],
      target: "Euclidean space",
    },
    {
      id: "geo06-r2",
      label: "Manifold dimension is the number of:",
      choices: ["local coordinates in a chart", "connected components", "boundary points"],
      target: "local coordinates in a chart",
    },
    {
      id: "geo06-r3",
      label: "A Riemannian metric assigns:",
      choices: ["an inner product on each tangent space", "a global vector field", "one scalar to each chart"],
      target: "an inner product on each tangent space",
    },
    {
      id: "geo06-r4",
      label: "Geodesic equations are built from metric and:",
      choices: ["Christoffel symbols", "Fourier coefficients", "group presentations"],
      target: "Christoffel symbols",
    },
  ],
};

export const LOG03_NODE_EXPERIENCE = createChoiceNodeExperience(LOG03_CONFIG);
export const LOG04_NODE_EXPERIENCE = createChoiceNodeExperience(LOG04_CONFIG);
export const LOG05_NODE_EXPERIENCE = createChoiceNodeExperience(LOG05_CONFIG);
export const LOG06_NODE_EXPERIENCE = createChoiceNodeExperience(LOG06_CONFIG);

export const NUM03_NODE_EXPERIENCE = createChoiceNodeExperience(NUM03_CONFIG);
export const NUM04_NODE_EXPERIENCE = createChoiceNodeExperience(NUM04_CONFIG);
export const NUM05_NODE_EXPERIENCE = createChoiceNodeExperience(NUM05_CONFIG);
export const NUM06_NODE_EXPERIENCE = createChoiceNodeExperience(NUM06_CONFIG);

export const ALG01_NODE_EXPERIENCE = createChoiceNodeExperience(ALG01_CONFIG);
export const ALG02_NODE_EXPERIENCE = createChoiceNodeExperience(ALG02_CONFIG);
export const ALG03_NODE_EXPERIENCE = createChoiceNodeExperience(ALG03_CONFIG);
export const ALG04_NODE_EXPERIENCE = createChoiceNodeExperience(ALG04_CONFIG);
export const ALG05_NODE_EXPERIENCE = createChoiceNodeExperience(ALG05_CONFIG);
export const ALG06_NODE_EXPERIENCE = createChoiceNodeExperience(ALG06_CONFIG);

export const GEO01_NODE_EXPERIENCE = createChoiceNodeExperience(GEO01_CONFIG);
export const GEO02_NODE_EXPERIENCE = createChoiceNodeExperience(GEO02_CONFIG);
export const GEO03_NODE_EXPERIENCE = createChoiceNodeExperience(GEO03_CONFIG);
export const GEO04_NODE_EXPERIENCE = createChoiceNodeExperience(GEO04_CONFIG);
export const GEO05_NODE_EXPERIENCE = createChoiceNodeExperience(GEO05_CONFIG);
export const GEO06_NODE_EXPERIENCE = createChoiceNodeExperience(GEO06_CONFIG);
