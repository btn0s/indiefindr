"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import {
  createJudgmentSession,
  insertJudgment,
  sessionExists,
} from "@/lib/trainer/persist";
import type { SubmitJudgmentInput } from "@/lib/trainer/types";

const SESSION_COOKIE = "trainer_session_id";

const judgmentSchema = z.object({
  seedAppid: z.number().int().positive(),
  shownAppids: z.array(z.number().int().positive()).min(2).max(12),
  pickedAppids: z.array(z.number().int().positive()),
  rejectedAppids: z.array(z.number().int().positive()),
  bestAppid: z.number().int().positive().nullable(),
  facet: z.enum(["vibe", "mechanics"]).nullable(),
  samplerVersion: z.string().min(1),
  latencyMs: z.number().int().nonnegative(),
});

export async function submitJudgment(
  input: SubmitJudgmentInput
): Promise<{ success: boolean; error?: string }> {

  const parsed = judgmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid judgment payload" };
  }

  const judgment = parsed.data;
  const shown = new Set(judgment.shownAppids);
  const allReferenced = [
    ...judgment.pickedAppids,
    ...judgment.rejectedAppids,
    ...(judgment.bestAppid ? [judgment.bestAppid] : []),
  ];
  if (allReferenced.some((appid) => !shown.has(appid))) {
    return { success: false, error: "Picked games must be among shown games" };
  }

  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId || !(await sessionExists(sessionId))) {
    sessionId = await createJudgmentSession({ source: "human" });
    cookieStore.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  try {
    await insertJudgment(sessionId, judgment);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
