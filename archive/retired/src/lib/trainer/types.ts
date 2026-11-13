export type TrainerFacet = "vibe" | "mechanics";

export type CandidateSlot = "top" | "near" | "random";

export type TrainerGame = {
  appid: number;
  title: string;
  header_image: string | null;
  short_description: string | null;
  topTags: string[];
};

export type TrainerCandidate = TrainerGame & {
  /** How the sampler chose this candidate (logged via sampler_version semantics) */
  slot: CandidateSlot;
};

export type TrainerScreen = {
  seed: TrainerGame;
  candidates: TrainerCandidate[];
  facet: TrainerFacet | null;
  samplerVersion: string;
};

export type SubmitJudgmentInput = {
  seedAppid: number;
  shownAppids: number[];
  pickedAppids: number[];
  rejectedAppids: number[];
  bestAppid: number | null;
  facet: TrainerFacet | null;
  samplerVersion: string;
  latencyMs: number;
};
