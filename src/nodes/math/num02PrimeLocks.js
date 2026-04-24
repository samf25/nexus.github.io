import { createMathStageNodeExperience } from "./mathStageNodeEngine.js";
import { integerCheck } from "./mathAnswerChecks.js";

const NUM02_CONFIG = {
  nodeId: "NUM02",
  title: "Prime Locks",
  subtitle: "Use inverses and gcd structure to crack each modular lock.",
  solvedMessage: "PRIME TEETH Recovered",
  stages: [
    {
      id: "num02-s1",
      label: "Inverse Key",
      prompt: "Solve 7x congruent to 1 (mod 26). Give the smallest nonnegative x.",
      placeholder: "x",
      check: integerCheck(15),
      hint: "Find the multiplicative inverse of 7 modulo 26.",
      solvedText: "Inverse spindle set.",
    },
    {
      id: "num02-s2",
      label: "Scaled Inverse",
      prompt: "Solve 9x congruent to 5 (mod 23). Smallest nonnegative x?",
      placeholder: "x",
      check: integerCheck(21),
      hint: "Invert 9 modulo 23, then multiply by 5.",
      solvedText: "Second lock calibrated.",
    },
    {
      id: "num02-s3",
      label: "Reduced Congruence",
      prompt: "Solve 14x congruent to 8 (mod 30). Smallest nonnegative x?",
      placeholder: "x",
      check: integerCheck(7),
      hint: "Divide by gcd first, then solve modulo 15.",
      solvedText: "Reduced channel stabilized.",
    },
    {
      id: "num02-s4",
      label: "Multiplicity",
      prompt: "How many incongruent solutions modulo 30 does 14x congruent to 8 (mod 30) have?",
      placeholder: "count",
      check: integerCheck(2),
      hint: "When gcd(a,m)=d and d divides b, there are d solutions modulo m.",
      solvedText: "Lockset fully opened.",
    },
  ],
};

export const NUM02_NODE_EXPERIENCE = createMathStageNodeExperience(NUM02_CONFIG);
