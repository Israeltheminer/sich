import { randomUUID } from "crypto";
import { readJson, writeJson } from "./store";
import { Interaction, InteractionFeedback } from "./types";

const FILE = "interactions.json";

export async function getAllInteractions(): Promise<Interaction[]> {
  return readJson<Interaction[]>(FILE, []);
}

export async function getInteractionsForProfile(profileId: string): Promise<Interaction[]> {
  const all = await getAllInteractions();
  return all.filter((i) => i.profileId === profileId);
}

export async function getUnconsumedFeedbackInteractions(profileId: string): Promise<Interaction[]> {
  const all = await getInteractionsForProfile(profileId);
  return all.filter((i) => !i.consumedByLearning && i.feedback);
}

export async function addInteraction(
  interaction: Omit<Interaction, "id" | "timestamp" | "consumedByLearning">
): Promise<Interaction> {
  const all = await getAllInteractions();
  const full: Interaction = {
    ...interaction,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    consumedByLearning: false,
  };
  all.push(full);
  await writeJson(FILE, all);
  return full;
}

export async function attachFeedback(
  interactionId: string,
  feedback: Omit<InteractionFeedback, "submittedAt">
): Promise<Interaction | null> {
  const all = await getAllInteractions();
  const idx = all.findIndex((i) => i.id === interactionId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    feedback: { ...feedback, submittedAt: new Date().toISOString() },
    consumedByLearning: false,
  };
  await writeJson(FILE, all);
  return all[idx];
}

export async function markConsumed(interactionIds: string[]): Promise<void> {
  if (interactionIds.length === 0) return;
  const all = await getAllInteractions();
  const idSet = new Set(interactionIds);
  const updated = all.map((i) => (idSet.has(i.id) ? { ...i, consumedByLearning: true } : i));
  await writeJson(FILE, updated);
}
