import { createMathStageNodeExperience } from "./mathStageNodeEngine.js";
import { integerCheck } from "./mathAnswerChecks.js";

const LOG02_CONFIG = {
  nodeId: "LOG02",
  title: "Witness Grid",
  subtitle: "Use the domain {1,2,3,4,5}. Supply witnesses, counterexamples, and truth status.",
  solvedMessage: "WITNESS TOKEN Recovered",
  stages: [
    {
      id: "log02-s1",
      label: "Witness",
      prompt: "Give one witness x for: there exists x such that x^2 = 9.",
      placeholder: "integer x",
      check: integerCheck(3),
      hint: "Choose from the stated domain only.",
      solvedText: "Existential witness accepted.",
    },
    {
      id: "log02-s2",
      label: "Counterexample",
      prompt: "Give a counterexample x to: for all x, (Prime(x) -> Odd(x)).",
      placeholder: "integer x",
      check: integerCheck(2),
      hint: "You need a prime that is not odd.",
      solvedText: "Universal claim broken correctly.",
    },
    {
      id: "log02-s3",
      label: "Finite Domain Logic",
      prompt: "Truth value of: for all x there exists y with y > x (over {1,2,3,4,5}). Enter T or F.",
      placeholder: "T/F",
      answers: ["f", "false"],
      hint: "Check the largest value in the domain.",
      solvedText: "Bounded-domain guard verified.",
    },
    {
      id: "log02-s4",
      label: "Extremal Witness",
      prompt: "Truth value of: there exists x such that for all y, x <= y (same domain). Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "Does the domain have a smallest element?",
      solvedText: "Grid adjudication complete.",
    },
  ],
};

export const LOG02_NODE_EXPERIENCE = createMathStageNodeExperience(LOG02_CONFIG);
