import { createMathStageNodeExperience } from "./mathStageNodeEngine.js";
import { integerCheck } from "./mathAnswerChecks.js";

const NUM01_CONFIG = {
  nodeId: "NUM01",
  title: "Residue Clock",
  subtitle: "Solve the congruence chain. Each stage extends the previous lock.",
  solvedMessage: "MOD WHEEL Recovered",
  stages: [
    {
      id: "num01-s1",
      label: "Dual Lock",
      prompt: "Smallest n with n congruent to 2 (mod 3) and congruent to 1 (mod 4).",
      placeholder: "smallest n",
      check: integerCheck(5),
      hint: "List numbers congruent to 2 mod 3 and test mod 4.",
      solvedText: "First residue wheel aligned.",
    },
    {
      id: "num01-s2",
      label: "Triple Lock",
      prompt: "Now also require n congruent to 4 (mod 5). Smallest n?",
      placeholder: "smallest n",
      check: integerCheck(29),
      hint: "Use your previous solution as a base and step by lcm(3,4)=12.",
      solvedText: "Third dial synchronized.",
    },
    {
      id: "num01-s3",
      label: "Full Chain",
      prompt: "Add n congruent to 6 (mod 7). Smallest n satisfying all four conditions?",
      placeholder: "smallest n",
      check: integerCheck(209),
      hint: "Step by lcm(3,4,5)=60 from the previous stage.",
      solvedText: "Clock core locked.",
    },
    {
      id: "num01-s4",
      label: "Residue Echo",
      prompt: "For that smallest n, compute n mod 11.",
      placeholder: "remainder",
      check: integerCheck(0),
      hint: "Reduce your stage-3 answer modulo 11.",
      solvedText: "Chronometric residue resolved.",
    },
  ],
};

export const NUM01_NODE_EXPERIENCE = createMathStageNodeExperience(NUM01_CONFIG);
