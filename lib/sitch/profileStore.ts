import { readJson, writeJson } from "./store";
import { CommunicationProfile } from "./types";

const FILE = "profiles.json";

export async function getAllProfiles(): Promise<CommunicationProfile[]> {
  return readJson<CommunicationProfile[]>(FILE, []);
}

export async function getProfile(id: string): Promise<CommunicationProfile | null> {
  const all = await getAllProfiles();
  return all.find((p) => p.id === id) ?? null;
}

export async function saveProfile(profile: CommunicationProfile): Promise<void> {
  const all = await getAllProfiles();
  const idx = all.findIndex((p) => p.id === profile.id);
  if (idx === -1) all.push(profile);
  else all[idx] = profile;
  await writeJson(FILE, all);
}

export async function createProfile(input: {
  id: string;
  name: string;
  description: string;
}): Promise<CommunicationProfile> {
  const now = new Date().toISOString();
  const profile: CommunicationProfile = {
    id: input.id,
    name: input.name,
    description: input.description,
    version: 1,
    createdAt: now,
    updatedAt: now,
    traits: {
      formality: "Medium",
      directness: "Medium",
      warmth: "Medium",
      vocabulary: "Neutral",
      responseLength: "Medium",
      languageMixing: "None",
    },
    learnedPatterns: [],
    history: [],
  };
  await saveProfile(profile);
  return profile;
}
