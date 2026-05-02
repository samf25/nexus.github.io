import { createMathStageNodeExperience } from "./mathStageNodeEngine.js";
import { integerCheck, numberCheck } from "./mathAnswerChecks.js";

const LOG03_CONFIG = {
  nodeId: "LOG03",
  title: "Fitch Staircase",
  subtitle: "Resolve SAT and inference checkpoints in sequence.",
  solvedMessage: "PROOF FRAME Recovered",
  stages: [
    {
      id: "log03-s1",
      label: "Clause Audit",
      prompt:
        "For (a or b) and (~a or c) and (~b or ~c), does a=1, b=0, c=1 satisfy all clauses? Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "Check all three clauses, not just the first two.",
      solvedText: "Satisfiable profile confirmed.",
    },
    {
      id: "log03-s2",
      label: "Two-True Model",
      prompt: "Enter abc bits for a satisfying assignment with exactly two true values.",
      placeholder: "example: 101",
      answers: ["101", "a=1,b=0,c=1", "a1b0c1"],
      hint: "The model from stage one already meets the two-true condition.",
      solvedText: "Model witness captured.",
    },
    {
      id: "log03-s3",
      label: "Unit Propagation",
      prompt: "From clauses (x) and (~x or y), what must y be? Enter 1 or 0.",
      placeholder: "1 or 0",
      answers: ["1", "true", "t"],
      hint: "x is forced first, then propagate into the second clause.",
      solvedText: "Propagation chain complete.",
    },
    {
      id: "log03-s4",
      label: "Unique Model",
      prompt: "For (p or q) and (~p or q) and (p or ~q), enter the only satisfying pq bits.",
      placeholder: "example: 11",
      answers: ["11", "p=1,q=1", "p1q1"],
      hint: "Each mixed clause eliminates one corner of the truth table.",
      solvedText: "Proof frame locked in.",
    },
  ],
};

const LOG04_CONFIG = {
  nodeId: "LOG04",
  title: "Modality Lanterns",
  subtitle: "Kripke frame: w0 -> {w1,w2}, w1 -> {w1}, w2 -> {w2}. p@w1, q@w2, r@{w1,w2}.",
  solvedMessage: "NECESSITY LENS Recovered",
  stages: [
    {
      id: "log04-s1",
      label: "Possibility",
      prompt: "At w0, is Diamond p true? Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "Diamond asks for at least one accessible world.",
      solvedText: "Possibility channel lit.",
    },
    {
      id: "log04-s2",
      label: "Necessity",
      prompt: "At w0, is Box p true? Enter T or F.",
      placeholder: "T/F",
      answers: ["f", "false"],
      hint: "Box requires truth in every accessible world.",
      solvedText: "Necessity channel corrected.",
    },
    {
      id: "log04-s3",
      label: "Universal Reach",
      prompt: "At w0, is Box r true? Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "r is true in both worlds reachable from w0.",
      solvedText: "Shared truth stabilized.",
    },
    {
      id: "log04-s4",
      label: "Nested Modal",
      prompt: "At w0, is Box Diamond q true? Enter T or F.",
      placeholder: "T/F",
      answers: ["f", "false"],
      hint: "Check whether every world reachable from w0 can itself reach a q-world.",
      solvedText: "Lens calibration complete.",
    },
  ],
};

const LOG05_CONFIG = {
  nodeId: "LOG05",
  title: "Quantifier Chamber",
  subtitle: "Domain is {-2,-1,0,1,2}. Resolve truth values and quantifier negation.",
  solvedMessage: "PARADOX FERRYMAN TOKEN Recovered",
  stages: [
    {
      id: "log05-s1",
      label: "Existential Response",
      prompt: "Truth of: for all x there exists y with x + y = 0. Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "Try y = -x for each domain value.",
      solvedText: "Universal-existential check accepted.",
    },
    {
      id: "log05-s2",
      label: "Universal Trap",
      prompt: "Truth of: there exists x such that for all y, x + y = 0. Enter T or F.",
      placeholder: "T/F",
      answers: ["f", "false"],
      hint: "One fixed x cannot cancel every possible y.",
      solvedText: "False universal witness rejected.",
    },
    {
      id: "log05-s3",
      label: "Square Bound",
      prompt: "Truth of: for all x, x^2 >= 0. Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "Squares over integers are never negative.",
      solvedText: "Order axiom logged.",
    },
    {
      id: "log05-s4",
      label: "Negation Law",
      prompt: "Is not(for all x P(x)) equivalent to there exists x not P(x)? Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "This is the standard quantifier-negation rule.",
      solvedText: "Consistency lock secured.",
    },
  ],
};

const LOG06_CONFIG = {
  nodeId: "LOG06",
  title: "Proof of Passage",
  subtitle: "Name the inference instrument or resulting form at each checkpoint.",
  solvedMessage: "GYRE OF MODUS TOLLENS Recovered",
  stages: [
    {
      id: "log06-s1",
      label: "Inference Name",
      prompt: "From (p -> q) and not q, infer not p. Enter the rule name.",
      placeholder: "rule name",
      answers: ["modus tollens"],
      hint: "It is the contrapositive-style elimination rule.",
      solvedText: "Rule stamp accepted.",
    },
    {
      id: "log06-s2",
      label: "DeMorgan Form",
      prompt: "Rewrite not(p or q) using DeMorgan.",
      placeholder: "not p and not q",
      answers: ["not p and not q", "~p and ~q", "~p ^ ~q"],
      hint: "Negated disjunction becomes conjunction of negations.",
      solvedText: "Negation transform applied.",
    },
    {
      id: "log06-s3",
      label: "Consistency Check",
      prompt: "If a system proves both r and not r, is it consistent? Enter T or F.",
      placeholder: "T/F",
      answers: ["f", "false"],
      hint: "Consistency forbids deriving contradictions.",
      solvedText: "Contradiction sensor tripped.",
    },
    {
      id: "log06-s4",
      label: "Chain Rule",
      prompt: "From (p -> q) and (q -> r), infer (p -> r) by what rule?",
      placeholder: "rule name",
      answers: ["hypothetical syllogism", "transitivity"],
      hint: "It is the implication-chain rule.",
      solvedText: "Final proof seal impressed.",
    },
  ],
};

const NUM03_CONFIG = {
  nodeId: "NUM03",
  title: "Bezout Beacon",
  subtitle: "Track gcd structure and congruence solution multiplicity.",
  solvedMessage: "CONGRUENCE PAIR Recovered",
  stages: [
    {
      id: "num03-s1",
      label: "Core gcd",
      prompt: "Compute gcd(252, 198).",
      placeholder: "gcd",
      check: integerCheck(18),
      hint: "Use Euclid's algorithm.",
      solvedText: "gcd beacon activated.",
    },
    {
      id: "num03-s2",
      label: "Bezout Coefficient",
      prompt: "18 = 252u + 198v. If u = 4, what is v?",
      placeholder: "v",
      check: integerCheck(-5),
      hint: "Substitute u and solve the linear equation.",
      solvedText: "Coefficient pair anchored.",
    },
    {
      id: "num03-s3",
      label: "Reduced Congruence",
      prompt: "Solve 198x congruent to 18 (mod 252). Smallest nonnegative x?",
      placeholder: "x",
      check: integerCheck(9),
      hint: "Divide by gcd first, then invert modulo 14.",
      solvedText: "Reduced class solved.",
    },
    {
      id: "num03-s4",
      label: "Solution Count",
      prompt: "How many incongruent solutions modulo 252 does 198x congruent to 18 (mod 252) have?",
      placeholder: "count",
      check: integerCheck(18),
      hint: "Use gcd(a,m) when divisibility holds.",
      solvedText: "Beacon fully synchronized.",
    },
  ],
};

const NUM04_CONFIG = {
  nodeId: "NUM04",
  title: "Totient Telegraph",
  subtitle: "Compute totients, primitive-root counts, and a semiprime reconstruction.",
  solvedMessage: "SQUARE ROOT LANTERN Recovered",
  stages: [
    {
      id: "num04-s1",
      label: "Totient I",
      prompt: "Compute phi(45).",
      placeholder: "value",
      check: integerCheck(24),
      hint: "Use 45 = 3^2 * 5.",
      solvedText: "First totient channel tuned.",
    },
    {
      id: "num04-s2",
      label: "Totient II",
      prompt: "Compute phi(84).",
      placeholder: "value",
      check: integerCheck(24),
      hint: "Use 84 = 2^2 * 3 * 7.",
      solvedText: "Composite channel tuned.",
    },
    {
      id: "num04-s3",
      label: "Primitive Roots",
      prompt: "How many generators does multiplicative group modulo 17 have?",
      placeholder: "count",
      check: integerCheck(8),
      hint: "The group has size 16 and is cyclic.",
      solvedText: "Generator count confirmed.",
    },
    {
      id: "num04-s4",
      label: "Semiprime Recovery",
      prompt: "If n = pq (distinct odd primes) and phi(n) = 40, find n.",
      placeholder: "n",
      check: integerCheck(55),
      hint: "Solve (p-1)(q-1)=40 with prime p<q.",
      solvedText: "Lantern key recovered.",
    },
  ],
};

const NUM05_CONFIG = {
  nodeId: "NUM05",
  title: "Cycle Observatory",
  subtitle: "Use multiplicative order and cycle length to shortcut huge exponents.",
  solvedMessage: "REMAINDER RATTLEKEY Recovered",
  stages: [
    {
      id: "num05-s1",
      label: "Order Check",
      prompt: "What is the multiplicative order of 2 modulo 7?",
      placeholder: "order",
      check: integerCheck(3),
      hint: "Find smallest k with 2^k congruent to 1 (mod 7).",
      solvedText: "Order cycle measured.",
    },
    {
      id: "num05-s2",
      label: "Fast Power",
      prompt: "Compute 3^100 mod 7.",
      placeholder: "remainder",
      check: integerCheck(4),
      hint: "Reduce exponent by the cycle length modulo 6.",
      solvedText: "Exponent reduction complete.",
    },
    {
      id: "num05-s3",
      label: "Last Digit",
      prompt: "What is the last digit of 7^2026?",
      placeholder: "digit",
      check: integerCheck(9),
      hint: "Last digits of powers of 7 repeat with period 4.",
      solvedText: "Digit loop resolved.",
    },
    {
      id: "num05-s4",
      label: "Order Again",
      prompt: "Smallest k > 0 with 10^k congruent to 1 (mod 27)?",
      placeholder: "k",
      check: integerCheck(3),
      hint: "Compute powers: 10, 19, 1 mod 27.",
      solvedText: "Key cycle finalized.",
    },
  ],
};

const NUM06_CONFIG = {
  nodeId: "NUM06",
  title: "Chinese Gate",
  subtitle: "Build a CRT solution step-by-step, then verify and count classes.",
  solvedMessage: "CLOCK OF CHINESE LANTERNS Recovered",
  stages: [
    {
      id: "num06-s1",
      label: "Starter System",
      prompt: "Smallest x with x congruent to 1 (mod 8) and congruent to 2 (mod 3).",
      placeholder: "x",
      check: integerCheck(17),
      hint: "Step through numbers congruent to 1 mod 8.",
      solvedText: "Dual modulus aligned.",
    },
    {
      id: "num06-s2",
      label: "Add Third Dial",
      prompt: "Now also require x congruent to 4 (mod 5). Smallest x?",
      placeholder: "x",
      check: integerCheck(89),
      hint: "Use x = 17 + 24k and solve for k modulo 5.",
      solvedText: "Three-way CRT solved.",
    },
    {
      id: "num06-s3",
      label: "Cross-Check",
      prompt: "For that x, compute x mod 7.",
      placeholder: "remainder",
      check: integerCheck(5),
      hint: "Reduce your stage-2 value modulo 7.",
      solvedText: "Audit residue recorded.",
    },
    {
      id: "num06-s4",
      label: "Class Count",
      prompt: "How many incongruent solutions are there modulo 120 for the stage-2 system?",
      placeholder: "count",
      check: integerCheck(1),
      hint: "The moduli 8, 3, and 5 are pairwise coprime.",
      solvedText: "CRT lens focused.",
    },
  ],
};

const ALG01_CONFIG = {
  nodeId: "ALG01",
  title: "Permutation Dock",
  subtitle: "Let sigma=(1 2 3 4), tau=(1 3)(2 4). Composition is right-to-left.",
  solvedMessage: "OPERATION CARD Recovered",
  stages: [
    {
      id: "alg01-s1",
      label: "Image",
      prompt: "Compute sigma(3).",
      placeholder: "value",
      check: integerCheck(4),
      hint: "Follow the 4-cycle directly.",
      solvedText: "Cycle map started.",
    },
    {
      id: "alg01-s2",
      label: "Composition",
      prompt: "Compute (tau o sigma)(1).",
      placeholder: "value",
      check: integerCheck(4),
      hint: "Apply sigma first, then tau.",
      solvedText: "Composition verified.",
    },
    {
      id: "alg01-s3",
      label: "Power",
      prompt: "Compute sigma^2(1).",
      placeholder: "value",
      check: integerCheck(3),
      hint: "Apply sigma twice.",
      solvedText: "Second iterate confirmed.",
    },
    {
      id: "alg01-s4",
      label: "Order",
      prompt: "What is the order of sigma?",
      placeholder: "order",
      check: integerCheck(4),
      hint: "Cycle length equals order.",
      solvedText: "Permutation dock completed.",
    },
  ],
};

const ALG02_CONFIG = {
  nodeId: "ALG02",
  title: "Dihedral Watch",
  subtitle: "Use D4 with rotation r and reflection s relations.",
  solvedMessage: "ORBIT RIBBON Recovered",
  stages: [
    {
      id: "alg02-s1",
      label: "Rotation Closure",
      prompt: "In D4, is r^4 = e true? Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "A full turn returns to identity.",
      solvedText: "Rotation anchor set.",
    },
    {
      id: "alg02-s2",
      label: "Reflection Relation",
      prompt: "In D4, is srs = r^-1 true? Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "Reflection reverses orientation of rotation.",
      solvedText: "Conjugation relation accepted.",
    },
    {
      id: "alg02-s3",
      label: "Element Order",
      prompt: "What is the order of any reflection in D4?",
      placeholder: "order",
      check: integerCheck(2),
      hint: "Reflect twice.",
      solvedText: "Reflection period fixed.",
    },
    {
      id: "alg02-s4",
      label: "Group Size",
      prompt: "How many elements are in D4?",
      placeholder: "size",
      check: integerCheck(8),
      hint: "Count 4 rotations and 4 reflections.",
      solvedText: "Watch mechanism complete.",
    },
  ],
};

const ALG03_CONFIG = {
  nodeId: "ALG03",
  title: "Homomorphism Mirror",
  subtitle: "Map f: Z -> Z12 by f(n)=5n (mod 12).",
  solvedMessage: "MIRROR PAIR Recovered",
  stages: [
    {
      id: "alg03-s1",
      label: "Image Value",
      prompt: "Compute f(7).",
      placeholder: "value in Z12",
      check: integerCheck(11),
      hint: "Reduce 35 modulo 12.",
      solvedText: "Mirror output logged.",
    },
    {
      id: "alg03-s2",
      label: "Kernel Period",
      prompt: "Smallest positive n in ker(f)?",
      placeholder: "n",
      check: integerCheck(12),
      hint: "Solve 5n congruent to 0 (mod 12).",
      solvedText: "Kernel generator identified.",
    },
    {
      id: "alg03-s3",
      label: "Image Size",
      prompt: "How many distinct elements are in im(f)?",
      placeholder: "size",
      check: integerCheck(12),
      hint: "5 is invertible modulo 12.",
      solvedText: "Image cardinality measured.",
    },
    {
      id: "alg03-s4",
      label: "Injectivity",
      prompt: "Is f injective as a map from Z to Z12? Enter T or F.",
      placeholder: "T/F",
      answers: ["f", "false"],
      hint: "A nontrivial kernel blocks injectivity on Z.",
      solvedText: "Mirror theorem sealed.",
    },
  ],
};

const ALG04_CONFIG = {
  nodeId: "ALG04",
  title: "Subgroup Lattice",
  subtitle: "Blend matrix and subgroup facts to lock the lattice pins.",
  solvedMessage: "LATTICE HOOK Recovered",
  stages: [
    {
      id: "alg04-s1",
      label: "Determinant Pin",
      prompt: "For A=[[2,1],[5,3]], compute det(A).",
      placeholder: "determinant",
      check: integerCheck(1),
      hint: "Use ad-bc.",
      solvedText: "Matrix pin seated.",
    },
    {
      id: "alg04-s2",
      label: "Invertibility",
      prompt: "Is A invertible over R? Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "A 2x2 matrix is invertible iff determinant is nonzero.",
      solvedText: "Inverse latch engaged.",
    },
    {
      id: "alg04-s3",
      label: "Index",
      prompt: "If |G|=84 and |H|=12, what is index [G:H]?",
      placeholder: "index",
      check: integerCheck(7),
      hint: "Apply Lagrange: [G:H]=|G|/|H|.",
      solvedText: "Index rung aligned.",
    },
    {
      id: "alg04-s4",
      label: "Normal Quotient",
      prompt: "If H is normal in G, does G/H exist as a group? Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "Normality is exactly the quotient condition.",
      solvedText: "Lattice hook locked.",
    },
  ],
};

const ALG05_CONFIG = {
  nodeId: "ALG05",
  title: "Ringwork Workshop",
  subtitle: "Factor, divide, and classify polynomial behavior.",
  solvedMessage: "RINGBREAKER LOOKINGGLASS Recovered",
  stages: [
    {
      id: "alg05-s1",
      label: "Root Scan",
      prompt: "For x^2 - 5x + 6, enter the smaller integer root.",
      placeholder: "root",
      check: integerCheck(2),
      hint: "Factor into two linear terms.",
      solvedText: "First root fixed.",
    },
    {
      id: "alg05-s2",
      label: "Polynomial gcd",
      prompt: "gcd(x^2-1, x^2-3x+2) = ?",
      placeholder: "x-1",
      answers: ["x-1", "(x-1)"],
      hint: "Factor each polynomial first.",
      solvedText: "Common factor identified.",
    },
    {
      id: "alg05-s3",
      label: "Remainder",
      prompt: "Remainder when x^3 + 2x^2 + x + 5 is divided by x+1?",
      placeholder: "remainder",
      check: integerCheck(5),
      hint: "Use the Remainder Theorem at x=-1.",
      solvedText: "Division residue computed.",
    },
    {
      id: "alg05-s4",
      label: "Reducibility",
      prompt: "Is x^2 + 1 reducible over the integers? Enter T or F.",
      placeholder: "T/F",
      answers: ["f", "false"],
      hint: "No integer roots implies no linear integer factors.",
      solvedText: "Workshop lock completed.",
    },
  ],
};

const ALG06_CONFIG = {
  nodeId: "ALG06",
  title: "Action on the Archive",
  subtitle: "Resolve rank, nullity, and determinant constraints to finish symmetry control.",
  solvedMessage: "DIHEDRAL OATHMIRROR Recovered",
  stages: [
    {
      id: "alg06-s1",
      label: "Rank",
      prompt: "Rank of matrix [[1,2],[2,4]]?",
      placeholder: "rank",
      check: integerCheck(1),
      hint: "Second row is a scalar multiple of the first.",
      solvedText: "Rank channel set.",
    },
    {
      id: "alg06-s2",
      label: "Nullity",
      prompt: "Nullity of the same matrix over R?",
      placeholder: "nullity",
      check: integerCheck(1),
      hint: "Use rank-nullity in dimension 2.",
      solvedText: "Kernel dimension fixed.",
    },
    {
      id: "alg06-s3",
      label: "Parameterized Solve",
      prompt: "For x + 2y = 5, if y=1 then x=?",
      placeholder: "x",
      check: integerCheck(3),
      hint: "Substitute directly.",
      solvedText: "Linear constraint routed.",
    },
    {
      id: "alg06-s4",
      label: "Diagonal Determinant",
      prompt: "det(diag(3,2,5)) = ?",
      placeholder: "determinant",
      check: integerCheck(30),
      hint: "Multiply diagonal entries.",
      solvedText: "Archive action finalized.",
    },
  ],
};

const GEO01_CONFIG = {
  nodeId: "GEO01",
  title: "Curvature Defects",
  subtitle: "Track angle sums, excess, and defect across geometric worlds.",
  solvedMessage: "PATH THREAD Recovered",
  stages: [
    {
      id: "geo01-s1",
      label: "Euclidean Sum",
      prompt: "A Euclidean triangle has angles 50 deg and 60 deg. What is the third angle?",
      placeholder: "degrees",
      check: integerCheck(70),
      hint: "Euclidean angle sum is 180 deg.",
      solvedText: "Flat-space baseline set.",
    },
    {
      id: "geo01-s2",
      label: "Spherical Excess",
      prompt: "On a sphere, triangle angles are 90, 90, 90 degrees. What is the spherical excess (in degrees)?",
      placeholder: "degrees",
      check: integerCheck(90),
      hint: "Excess = (angle sum) - 180.",
      solvedText: "Positive curvature measured.",
    },
    {
      id: "geo01-s3",
      label: "Hyperbolic Defect",
      prompt: "Hyperbolic triangle angles are 50, 60, 60 degrees. What is the defect (in degrees)?",
      placeholder: "degrees",
      check: integerCheck(10),
      hint: "Defect = 180 - (angle sum).",
      solvedText: "Negative curvature measured.",
    },
    {
      id: "geo01-s4",
      label: "Radian Conversion",
      prompt: "Convert 90 degrees to radians as a decimal (two decimals).",
      placeholder: "example: 1.57",
      check: numberCheck(1.57, 0.02),
      hint: "Multiply by pi/180.",
      solvedText: "Curvature ledger closed.",
    },
  ],
};

const GEO02_CONFIG = {
  nodeId: "GEO02",
  title: "Atlas Transition",
  subtitle: "Transition map: u=x+y, v=x-y. Use local chart mechanics.",
  solvedMessage: "CHART PAIR Recovered",
  stages: [
    {
      id: "geo02-s1",
      label: "Jacobian",
      prompt: "Compute det(d(u,v)/d(x,y)).",
      placeholder: "determinant",
      check: integerCheck(-2),
      hint: "Jacobian matrix is [[1,1],[1,-1]].",
      solvedText: "Transition differential pinned.",
    },
    {
      id: "geo02-s2",
      label: "Inverse Map",
      prompt: "If u=6 and v=2, what is x?",
      placeholder: "x",
      check: integerCheck(4),
      hint: "x=(u+v)/2.",
      solvedText: "Inverse chart move validated.",
    },
    {
      id: "geo02-s3",
      label: "Metric Coefficient",
      prompt: "With Euclidean ds^2=dx^2+dy^2, what is the coefficient of du^2 in (u,v)-coordinates?",
      placeholder: "coefficient",
      check: numberCheck(0.5, 1e-6),
      hint: "dx=(du+dv)/2 and dy=(du-dv)/2.",
      solvedText: "Metric pullback computed.",
    },
    {
      id: "geo02-s4",
      label: "Orientation",
      prompt: "Does this chart transition preserve orientation? Enter T or F.",
      placeholder: "T/F",
      answers: ["f", "false"],
      hint: "Orientation is preserved only when Jacobian determinant is positive.",
      solvedText: "Atlas pair stabilized.",
    },
  ],
};

const GEO03_CONFIG = {
  nodeId: "GEO03",
  title: "Vector Field Garden",
  subtitle: "Analyze divergence, curl, gradients, and conservative circulation.",
  solvedMessage: "CURVATURE CHIP Recovered",
  stages: [
    {
      id: "geo03-s1",
      label: "Divergence",
      prompt: "For F(x,y)=(x,y), compute div(F).",
      placeholder: "value",
      check: integerCheck(2),
      hint: "Take partial derivatives of each component with respect to its variable.",
      solvedText: "Source strength measured.",
    },
    {
      id: "geo03-s2",
      label: "Curl",
      prompt: "For F(x,y)=(-y,x), compute scalar curl (dQ/dx - dP/dy).",
      placeholder: "value",
      check: integerCheck(2),
      hint: "Differentiate Q=x and P=-y.",
      solvedText: "Rotation intensity mapped.",
    },
    {
      id: "geo03-s3",
      label: "Gradient Component",
      prompt: "If f(x,y)=x^2+y^2, what is the x-component of grad(f) at (1,-2)?",
      placeholder: "component",
      check: integerCheck(2),
      hint: "grad(f)=(2x,2y).",
      solvedText: "Directional slope fixed.",
    },
    {
      id: "geo03-s4",
      label: "Closed Loop",
      prompt: "Line integral of grad(x^2+y^2) around a closed loop equals what number?",
      placeholder: "value",
      check: integerCheck(0),
      hint: "Conservative fields have path-independent potential differences.",
      solvedText: "Field cycle closed.",
    },
  ],
};

const GEO04_CONFIG = {
  nodeId: "GEO04",
  title: "Tangent Courier",
  subtitle: "Use holonomy intuition: flat loops rotate 0, curved loops rotate by enclosed curvature.",
  solvedMessage: "TRANSPORT ARROW Recovered",
  stages: [
    {
      id: "geo04-s1",
      label: "Flat Holonomy",
      prompt: "Parallel transport around a rectangle in the plane rotates a vector by how many degrees?",
      placeholder: "degrees",
      check: integerCheck(0),
      hint: "Flat curvature gives no net rotation.",
      solvedText: "Flat transport baseline set.",
    },
    {
      id: "geo04-s2",
      label: "Spherical Loop",
      prompt: "A spherical loop has enclosed excess of pi/2 radians. Holonomy in degrees?",
      placeholder: "degrees",
      check: integerCheck(90),
      hint: "Convert radians to degrees.",
      solvedText: "Curved transport verified.",
    },
    {
      id: "geo04-s3",
      label: "Integrated Curvature",
      prompt: "If enclosed total Gaussian curvature is 0.30 radians, holonomy angle is?",
      placeholder: "radians",
      check: numberCheck(0.3, 1e-6),
      hint: "For this setup they are equal.",
      solvedText: "Courier phase calibrated.",
    },
    {
      id: "geo04-s4",
      label: "Geodesic Behavior",
      prompt: "Positive curvature tends to make nearby geodesics converge. Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "Contrast with hyperbolic divergence.",
      solvedText: "Transport arrow fixed.",
    },
  ],
};

const GEO05_CONFIG = {
  nodeId: "GEO05",
  title: "Topology Lantern",
  subtitle: "Use Euler characteristic and genus relations for closed orientable surfaces.",
  solvedMessage: "ATLAS CAUSEWAY SPIKE Recovered",
  stages: [
    {
      id: "geo05-s1",
      label: "Sphere",
      prompt: "Euler characteristic of a sphere?",
      placeholder: "chi",
      check: integerCheck(2),
      hint: "Start from the classic polyhedron case.",
      solvedText: "Spherical invariant stamped.",
    },
    {
      id: "geo05-s2",
      label: "Torus",
      prompt: "Euler characteristic of a torus?",
      placeholder: "chi",
      check: integerCheck(0),
      hint: "Use chi = 2 - 2g with g=1.",
      solvedText: "Handle count integrated.",
    },
    {
      id: "geo05-s3",
      label: "Genus Recovery",
      prompt: "If chi = -2, what genus g does the closed orientable surface have?",
      placeholder: "g",
      check: integerCheck(2),
      hint: "Solve 2 - 2g = -2.",
      solvedText: "Genus checkpoint solved.",
    },
    {
      id: "geo05-s4",
      label: "Connected Sum",
      prompt: "Euler characteristic of torus # sphere equals?",
      placeholder: "chi",
      check: integerCheck(0),
      hint: "Sphere acts as identity for connected sum of closed surfaces.",
      solvedText: "Topology lantern complete.",
    },
  ],
};

const GEO06_CONFIG = {
  nodeId: "GEO06",
  title: "Cartographer's Manifold",
  subtitle: "Blend shortest-path geometry with great-circle distance and geodesic intuition.",
  solvedMessage: "COMPASS OF BENT ROADS Recovered",
  stages: [
    {
      id: "geo06-s1",
      label: "Euclidean Segment",
      prompt: "Distance squared from (0,0) to (2,1) in the plane?",
      placeholder: "distance squared",
      check: integerCheck(5),
      hint: "Use dx^2 + dy^2.",
      solvedText: "Planar metric locked.",
    },
    {
      id: "geo06-s2",
      label: "Rectangle Geodesic",
      prompt: "Distance squared from one corner to opposite in a 2 by 3 rectangle?",
      placeholder: "distance squared",
      check: integerCheck(13),
      hint: "Treat as a straight line in Euclidean coordinates.",
      solvedText: "Chart diagonal fixed.",
    },
    {
      id: "geo06-s3",
      label: "Great-Circle Arc",
      prompt: "On a unit sphere, central angle 60 deg gives arc length (decimal, two places).",
      placeholder: "example: 1.05",
      check: numberCheck(1.0472, 0.03),
      hint: "Arc length = radius * angle in radians.",
      solvedText: "Spherical route computed.",
    },
    {
      id: "geo06-s4",
      label: "Geodesic Fact",
      prompt: "In Euclidean geometry, geodesics are straight lines. Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "This is the defining flat-space case.",
      solvedText: "Cartographer compass aligned.",
    },
  ],
};

export const LOG03_NODE_EXPERIENCE = createMathStageNodeExperience(LOG03_CONFIG);
export const LOG04_NODE_EXPERIENCE = createMathStageNodeExperience(LOG04_CONFIG);
export const LOG05_NODE_EXPERIENCE = createMathStageNodeExperience(LOG05_CONFIG);
export const LOG06_NODE_EXPERIENCE = createMathStageNodeExperience(LOG06_CONFIG);

export const NUM03_NODE_EXPERIENCE = createMathStageNodeExperience(NUM03_CONFIG);
export const NUM04_NODE_EXPERIENCE = createMathStageNodeExperience(NUM04_CONFIG);
export const NUM05_NODE_EXPERIENCE = createMathStageNodeExperience(NUM05_CONFIG);
export const NUM06_NODE_EXPERIENCE = createMathStageNodeExperience(NUM06_CONFIG);

export const ALG01_NODE_EXPERIENCE = createMathStageNodeExperience(ALG01_CONFIG);
export const ALG02_NODE_EXPERIENCE = createMathStageNodeExperience(ALG02_CONFIG);
export const ALG03_NODE_EXPERIENCE = createMathStageNodeExperience(ALG03_CONFIG);
export const ALG04_NODE_EXPERIENCE = createMathStageNodeExperience(ALG04_CONFIG);
export const ALG05_NODE_EXPERIENCE = createMathStageNodeExperience(ALG05_CONFIG);
export const ALG06_NODE_EXPERIENCE = createMathStageNodeExperience(ALG06_CONFIG);

export const GEO01_NODE_EXPERIENCE = createMathStageNodeExperience(GEO01_CONFIG);
export const GEO02_NODE_EXPERIENCE = createMathStageNodeExperience(GEO02_CONFIG);
export const GEO03_NODE_EXPERIENCE = createMathStageNodeExperience(GEO03_CONFIG);
export const GEO04_NODE_EXPERIENCE = createMathStageNodeExperience(GEO04_CONFIG);
export const GEO05_NODE_EXPERIENCE = createMathStageNodeExperience(GEO05_CONFIG);
export const GEO06_NODE_EXPERIENCE = createMathStageNodeExperience(GEO06_CONFIG);
