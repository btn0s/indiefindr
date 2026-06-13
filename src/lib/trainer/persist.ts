import { getSupabaseServiceClient } from "../supabase/service";
import type { SubmitJudgmentInput } from "./types";

export type SessionSource = "human" | "agent";

export async function createJudgmentSession(params: {
  source: SessionSource;
  agentModel?: string;
  personaId?: string;
}): Promise<string> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("judgment_sessions")
    .insert({
      source: params.source,
      agent_model: params.agentModel ?? null,
      persona_id: params.personaId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create judgment session: ${error?.message}`);
  }
  return data.id as string;
}

export async function sessionExists(sessionId: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("judgment_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();
  return Boolean(data);
}

export async function insertJudgment(
  sessionId: string,
  judgment: SubmitJudgmentInput
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("similarity_judgments").insert({
    session_id: sessionId,
    seed_appid: judgment.seedAppid,
    shown_appids: judgment.shownAppids,
    picked_appids: judgment.pickedAppids,
    best_appid: judgment.bestAppid,
    rejected_appids: judgment.rejectedAppids,
    facet: judgment.facet,
    sampler_version: judgment.samplerVersion,
    latency_ms: judgment.latencyMs,
  });

  if (error) {
    throw new Error(`Failed to insert judgment: ${error.message}`);
  }
}
