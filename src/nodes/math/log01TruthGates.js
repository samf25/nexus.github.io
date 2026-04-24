import { createMathStageNodeExperience } from "./mathStageNodeEngine.js";

const LOG01_CONFIG = {
  nodeId: "LOG01",
  title: "Implication Hall",
  subtitle: "Stabilize the gate by resolving implication and equivalence checks.",
  solvedMessage: "LEMMA OF IMPLICATION Recovered",
  stages: [
    {
      id: "log01-s1",
      label: "Truth Fault",
      prompt: "Enter pq as two bits for the only assignment that makes (p -> q) false.",
      placeholder: "example: 10",
      answers: ["10", "p=1,q=0", "p1q0"],
      hint: "An implication fails only when the premise is true and the conclusion is false.",
      solvedText: "Failure signature pinned.",
    },
    {
      id: "log01-s2",
      label: "Nested Check",
      prompt: "Evaluate ((p -> q) and p) -> q at p=1, q=0. Enter 1 for true or 0 for false.",
      placeholder: "0 or 1",
      answers: ["1", "true", "t"],
      hint: "If the antecedent is false, the implication is automatically true.",
      solvedText: "Inference chain confirmed.",
    },
    {
      id: "log01-s3",
      label: "Contrapositive",
      prompt: "Is (p -> q) logically equivalent to (~q -> ~p)? Enter T or F.",
      placeholder: "T/F",
      answers: ["t", "true"],
      hint: "Implication and contrapositive always match in classical logic.",
      solvedText: "Equivalence mirror aligned.",
    },
    {
      id: "log01-s4",
      label: "Rewrite",
      prompt: "Write an equivalent disjunction for (p -> q).",
      placeholder: "not p or q",
      answers: ["not p or q", "~p or q", "~p v q", "q or not p"],
      hint: "Replace implication with a disjunction that forbids the single failure case.",
      solvedText: "Hall lock released.",
    },
  ],
};

export const LOG01_NODE_EXPERIENCE = createMathStageNodeExperience(LOG01_CONFIG);
