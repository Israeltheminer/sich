import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { CommunicationProfile, Interaction } from "../lib/sitch/types";

const DATA_DIR = path.join(process.cwd(), "data");

function now() {
  return new Date().toISOString();
}

const defaultProfile: CommunicationProfile = {
  id: "default",
  name: "Default (Untrained)",
  description: "A cold-start profile with no learned guidance yet — Sitch's starting point before it has seen any feedback.",
  version: 1,
  createdAt: now(),
  updatedAt: now(),
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

const marketplaceV1Snapshot = {
  traits: {
    formality: "High",
    directness: "Medium",
    warmth: "Medium",
    vocabulary: "Neutral/Formal",
    responseLength: "Medium",
    languageMixing: "None",
  },
  learnedPatterns: [] as string[],
};

const naijaMarketplaceProfile: CommunicationProfile = {
  id: "naija-marketplace",
  name: "Naija Marketplace Buyers",
  description:
    "Customers messaging a small online seller (phones, fashion, electronics) over chat. Learned from real feedback that this audience wants short, warm, informal, direct replies — not corporate customer-service language.",
  version: 2,
  createdAt: now(),
  updatedAt: now(),
  traits: {
    formality: "Low",
    directness: "High",
    warmth: "High",
    vocabulary: "Conversational",
    responseLength: "Short",
    languageMixing: "Context dependent",
  },
  learnedPatterns: [
    "Prefer concise responses — one or two short sentences, not paragraphs.",
    "Avoid corporate customer-service language (\"Certainly!\", \"I'd be happy to assist you\").",
    "Match the user's level of informality — if they write casually, reply casually.",
    "Use local expressions when the user's own message uses them (e.g. \"na\", \"dey\", \"abeg\").",
    "Be direct about availability, price, and next steps — don't bury the answer.",
  ],
  history: [
    {
      version: 1,
      timestamp: now(),
      traits: marketplaceV1Snapshot.traits,
      learnedPatterns: marketplaceV1Snapshot.learnedPatterns,
      changeSummary: "Initial cold-start profile before any feedback was collected.",
      consumedInteractionIds: [],
    },
  ],
};

function interaction(partial: Partial<Interaction> & Pick<Interaction, "profileId" | "message" | "response">): Interaction {
  return {
    id: randomUUID(),
    timestamp: now(),
    profileVersionAtResponse: 1,
    systemPromptUsed: "(seed data)",
    llmModel: "seed",
    mocked: true,
    consumedByLearning: true,
    ...partial,
  };
}

const seedInteractions: Interaction[] = [
  interaction({
    profileId: "naija-marketplace",
    message: "Abeg, I need to know if this phone dey available.",
    response: "Yes, the phone is currently available in our inventory. Would you like to proceed with placing an order at this time?",
    feedback: {
      verdict: "bad",
      note: "Too stiff and corporate for how the customer is talking to us.",
      preferredResponse: "Yes, e dey available. You wan order am?",
      submittedAt: now(),
    },
  }),
  interaction({
    profileId: "naija-marketplace",
    message: "How much for the bag, and una deliver to Ikeja?",
    response: "The bag is priced at ₦15,000. We do offer delivery services; however, delivery availability to your specified location would need to be confirmed separately.",
    feedback: {
      verdict: "bad",
      note: "Way too long for a simple price + delivery question.",
      preferredResponse: "It's ₦15,000. Yes o, we deliver to Ikeja.",
      submittedAt: now(),
    },
  }),
  interaction({
    profileId: "naija-marketplace",
    message: "Can I pay on delivery?",
    response: "Yes, that works. We'll confirm the address before your order goes out.",
    feedback: { verdict: "good", submittedAt: now() },
  }),
  interaction({
    profileId: "naija-marketplace",
    message: "This laptop, na original or fairly used?",
    response: "We would like to inform you that all our laptop products undergo a thorough quality assurance process prior to listing, and this particular unit is classified as a fairly used device in good working condition.",
    feedback: {
      verdict: "bad",
      note: "Nobody talks like this over chat, way too formal.",
      preferredResponse: "It's fairly used, but tested and working fine.",
      submittedAt: now(),
    },
  }),
  interaction({
    profileId: "naija-marketplace",
    message: "Do you have this in black?",
    response: "Yes, black is available. You want me hold one for you?",
    feedback: { verdict: "good", note: "This tone is exactly right.", submittedAt: now() },
  }),
];

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(DATA_DIR, "profiles.json"),
    JSON.stringify([defaultProfile, naijaMarketplaceProfile], null, 2)
  );
  await fs.writeFile(path.join(DATA_DIR, "interactions.json"), JSON.stringify(seedInteractions, null, 2));
  console.log(`Seeded ${2} profiles and ${seedInteractions.length} example interactions into ${DATA_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
