export interface CommunicationTraits {
  formality: string;
  directness: string;
  warmth: string;
  vocabulary: string;
  responseLength: string;
  languageMixing: string;
}

export interface ProfileHistoryEntry {
  version: number;
  timestamp: string;
  traits: CommunicationTraits;
  learnedPatterns: string[];
  changeSummary: string;
  consumedInteractionIds: string[];
}

export interface CommunicationProfile {
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  traits: CommunicationTraits;
  learnedPatterns: string[];
  history: ProfileHistoryEntry[];
}

export interface InteractionFeedback {
  verdict: "good" | "bad";
  note?: string;
  preferredResponse?: string;
  submittedAt: string;
}

export interface Interaction {
  id: string;
  profileId: string;
  profileVersionAtResponse: number;
  timestamp: string;
  message: string;
  context?: string;
  response: string;
  systemPromptUsed: string;
  llmModel: string;
  mocked: boolean;
  feedback?: InteractionFeedback;
  consumedByLearning: boolean;
}

export interface PatternCandidate {
  pattern: string;
  confidence: "low" | "medium" | "high";
  evidence: string;
}

export interface LearningProposal {
  profileId: string;
  baseVersion: number;
  createdAt: string;
  reasoningTrace: string[];
  patternsDetected: PatternCandidate[];
  proposedTraits: CommunicationTraits;
  proposedLearnedPatterns: string[];
  changeSummary: string;
  meaningfulChange: boolean;
  consumedInteractionIds: string[];
  usedFallbackHeuristic: boolean;
}
