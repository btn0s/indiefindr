#!/usr/bin/env npx tsx

/**
 * Source B: agent trainer runs — a cheap model plays the same labeling task
 * as the human /trainer route. Hard budget cap; rows are tagged
 * source='agent' so training can down-weight or exclude them.
 *
 * Run E7 (agent-fidelity gate) before any bulk run: agents must agree with
 * human picks on shared screens before their labels are trusted at volume.
 *
 * Usage:
 *   npx tsx scripts/trainer/run-agents.ts [--screens 20] [--budget-usd 0.50] [--model openai/gpt-4o-mini] [--persona cozy-player]
 */

import { config } from "dotenv";
config({ path: [".env.local"] });

import { generateText } from "ai";
import { buildTrainerScreen } from "../../src/lib/trainer/sampler";
import {
  createJudgmentSession,
  insertJudgment,
} from "../../src/lib/trainer/persist";
import type { TrainerScreen } from "../../src/lib/trainer/types";

const args = process.argv.slice(2);

function numArg(name: string, fallback: number): number {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= args.length) return fallback;
  const parsed = parseFloat(args[index + 1]);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function strArg(name: string, fallback: string): string {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
}

const SCREENS = numArg("screens", 20);
const BUDGET_USD = numArg("budget-usd", 0.5);
const MODEL = strArg("model", "openai/gpt-4o-mini");
const PERSONA_ID = strArg("persona", "rotate");

// Approximate gpt-4o-mini pricing; update if the model flag changes.
const PRICE_PER_INPUT_TOKEN = 0.15 / 1_000_000;
const PRICE_PER_OUTPUT_TOKEN = 0.6 / 1_000_000;

const PERSONAS: Record<string, string> = {
  "indie-generalist":
    "You play a wide range of indie games and judge similarity by overall feel: tone, pacing, and what kind of evening the game is for.",
  "cozy-player":
    "You play relaxing, low-stress games. Two games are similar only if they share that gentle, comforting quality — mechanics matter less than mood.",
  "mechanics-purist":
    "You care about gameplay systems above all. Two games are similar only if their core loops and skill demands genuinely overlap; ignore theme and art style.",
  "art-game-connoisseur":
    "You seek experimental, unconventional games. Similarity means shared artistic ambition and strangeness, not genre labels.",
  "narrative-lover":
    "You play for story and characters. Similarity means comparable emotional journeys and writing quality.",
};

function questionFor(screen: TrainerScreen): string {
  if (screen.facet === "vibe") return "Which candidates FEEL like the seed game (tone, mood, atmosphere)?";
  if (screen.facet === "mechanics") return "Which candidates PLAY like the seed game (core loop, systems)?";
  return "Which candidates are genuinely similar to the seed game?";
}

function buildPrompt(screen: TrainerScreen, personaSpec: string): string {
  const candidateList = screen.candidates
    .map(
      (c) =>
        `- appid ${c.appid}: "${c.title}" | tags: ${c.topTags.join(", ") || "none"} | ${(c.short_description ?? "").slice(0, 200)}`
    )
    .join("\n");

  return `You are labeling game similarity for a recommender. Persona: ${personaSpec}

SEED GAME: "${screen.seed.title}"
Tags: ${screen.seed.topTags.join(", ") || "none"}
Description: ${(screen.seed.short_description ?? "").slice(0, 400)}

CANDIDATES:
${candidateList}

QUESTION: ${questionFor(screen)}

Rules:
- "picked": candidates a player who loves the seed would also enjoy for the SAME reasons.
- "rejected": candidates that would clearly disappoint that player (wrong tone or wrong kind of game). Leave out anything you're unsure about.
- It is fine to pick none.

Return ONLY JSON: {"picked":[appids],"rejected":[appids]}`;
}

type AgentAnswer = { picked: number[]; rejected: number[] };

function parseAnswer(text: string, shown: Set<number>): AgentAnswer | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { picked?: unknown; rejected?: unknown };
    const clamp = (value: unknown): number[] =>
      Array.isArray(value)
        ? value
            .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
            .filter((v) => Number.isInteger(v) && shown.has(v))
        : [];
    const picked = clamp(parsed.picked);
    const rejectedRaw = clamp(parsed.rejected);
    const pickedSet = new Set(picked);
    return { picked, rejected: rejectedRaw.filter((v) => !pickedSet.has(v)) };
  } catch {
    return null;
  }
}

async function main() {
  const personaIds =
    PERSONA_ID === "rotate" ? Object.keys(PERSONAS) : [PERSONA_ID];
  for (const id of personaIds) {
    if (!PERSONAS[id]) {
      console.error(`Unknown persona "${id}". Available: ${Object.keys(PERSONAS).join(", ")}, rotate`);
      process.exit(1);
    }
  }

  console.log(
    `Agent trainer run: ${SCREENS} screens, model ${MODEL}, personas [${personaIds.join(", ")}], budget $${BUDGET_USD.toFixed(2)}`
  );

  const sessionIds = new Map<string, string>();
  let spentUsd = 0;
  let saved = 0;
  let failed = 0;

  for (let i = 0; i < SCREENS; i++) {
    if (spentUsd >= BUDGET_USD) {
      console.log(`Budget reached ($${spentUsd.toFixed(4)}), stopping.`);
      break;
    }

    const personaId = personaIds[i % personaIds.length];
    const screen = await buildTrainerScreen();

    try {
      const start = Date.now();
      const result = await generateText({
        model: MODEL,
        prompt: buildPrompt(screen, PERSONAS[personaId]),
      });

      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;
      spentUsd +=
        inputTokens * PRICE_PER_INPUT_TOKEN + outputTokens * PRICE_PER_OUTPUT_TOKEN;

      const shown = new Set(screen.candidates.map((c) => c.appid));
      const answer = parseAnswer(result.text, shown);
      if (!answer) {
        failed++;
        console.log(`[${i + 1}/${SCREENS}] ${personaId}: unparseable answer, skipped`);
        continue;
      }

      let sessionId = sessionIds.get(personaId);
      if (!sessionId) {
        sessionId = await createJudgmentSession({
          source: "agent",
          agentModel: MODEL,
          personaId,
        });
        sessionIds.set(personaId, sessionId);
      }

      await insertJudgment(sessionId, {
        seedAppid: screen.seed.appid,
        shownAppids: screen.candidates.map((c) => c.appid),
        pickedAppids: answer.picked,
        rejectedAppids: answer.rejected,
        bestAppid: null,
        facet: screen.facet,
        samplerVersion: screen.samplerVersion,
        latencyMs: Date.now() - start,
      });

      saved++;
      console.log(
        `[${i + 1}/${SCREENS}] ${personaId}: seed "${screen.seed.title}" → ${answer.picked.length} picked, ${answer.rejected.length} rejected ($${spentUsd.toFixed(4)} spent)`
      );
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${i + 1}/${SCREENS}] ${personaId}: ${message}`);
    }
  }

  console.log(
    `\nDone. ${saved} judgments saved, ${failed} failed, total spend ~$${spentUsd.toFixed(4)}.`
  );
}

void main();
