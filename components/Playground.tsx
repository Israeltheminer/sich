"use client";

import { useCallback, useEffect, useState } from "react";
import { CommunicationProfile, Interaction, LearningProposal } from "@/lib/sitch/types";
import { ProfileCard } from "./ProfileCard";
import { LearningActivity } from "./LearningActivity";

interface CompareResult {
  interactionId: string;
  baseline: { response: string; mocked: boolean };
  guided: { response: string; mocked: boolean; usedFallback: boolean };
  profile: Pick<CommunicationProfile, "id" | "name" | "version" | "traits" | "learnedPatterns">;
}

const EXAMPLE_MESSAGES = [
  "Abeg, is this phone still available?",
  "I need to book a barber for tomorrow.",
  "How much for delivery to Lekki?",
  "Can I get a refund if I no like it?",
];

export function Playground() {
  const [profiles, setProfiles] = useState<CommunicationProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("naija-marketplace");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [showBaseline, setShowBaseline] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [feedbackNote, setFeedbackNote] = useState("");
  const [preferredResponse, setPreferredResponse] = useState("");
  const [feedbackSent, setFeedbackSent] = useState<"good" | "bad" | null>(null);

  const [pendingCount, setPendingCount] = useState(0);
  const [learnLoading, setLearnLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [proposal, setProposal] = useState<LearningProposal | null>(null);

  const selectedProfile = profiles.find((p) => p.id === profileId) ?? null;

  const refreshPendingCount = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/sitch/profiles/${id}`);
      if (!res.ok) return;
      const data: { interactions: Interaction[] } = await res.json();
      const pending = data.interactions.filter((i) => i.feedback && !i.consumedByLearning).length;
      setPendingCount(pending);
    } catch {
      // non-critical; leave count as-is
    }
  }, []);

  useEffect(() => {
    fetch("/api/sitch/profiles")
      .then((res) => res.json())
      .then((data) => setProfiles(data.profiles ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sitch/profiles/${profileId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { interactions: Interaction[] } | null) => {
        if (cancelled || !data) return;
        setPendingCount(data.interactions.filter((i) => i.feedback && !i.consumedByLearning).length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  function handleProfileChange(nextId: string) {
    setProfileId(nextId);
    setResult(null);
    setProposal(null);
    setFeedbackSent(null);
  }

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    setResult(null);
    setFeedbackSent(null);
    setFeedbackNote("");
    setPreferredResponse("");
    try {
      const res = await fetch("/api/sitch/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context: context || undefined, profileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function handleFeedback(verdict: "good" | "bad") {
    if (!result) return;
    try {
      const res = await fetch("/api/sitch/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interactionId: result.interactionId,
          verdict,
          note: feedbackNote || undefined,
          preferredResponse: preferredResponse || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      setFeedbackSent(verdict);
      refreshPendingCount(profileId);
    } catch {
      setError("Failed to submit feedback");
    }
  }

  async function handleRunLearning() {
    setLearnLoading(true);
    setProposal(null);
    setError(null);
    try {
      const res = await fetch("/api/sitch/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Learning cycle failed");
      setProposal(data.proposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Learning cycle failed");
    } finally {
      setLearnLoading(false);
    }
  }

  async function handleApplyProposal() {
    if (!proposal) return;
    setApplyLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sitch/learn/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to apply");
      setProfiles((prev) => prev.map((p) => (p.id === data.profile.id ? data.profile : p)));
      setProposal(null);
      refreshPendingCount(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply proposal");
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-white/50">Audience</label>
            <select
              value={profileId}
              onChange={(e) => handleProfileChange(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <label className="ml-auto flex items-center gap-2 text-sm text-white/50">
              <input
                type="checkbox"
                checked={showBaseline}
                onChange={(e) => setShowBaseline(e.target.checked)}
              />
              Show generic AI response for comparison
            </label>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message the way a real user would send it…"
            rows={3}
            className="mt-4 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-[var(--sitch-accent)]"
          />

          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder='Optional task context, e.g. "product inquiry"'
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm outline-none focus:border-[var(--sitch-accent)]"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_MESSAGES.map((m) => (
              <button
                key={m}
                onClick={() => setMessage(m)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 hover:border-white/30 hover:text-white"
              >
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="mt-4 rounded-lg bg-[var(--sitch-accent)] px-5 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            {sending ? "Sitch is responding…" : "Send"}
          </button>
          {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        </div>

        {result && (
          <div className={`grid gap-4 ${showBaseline ? "sm:grid-cols-2" : ""}`}>
            {showBaseline && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Before Sitch (generic AI)
                </h4>
                <p className="mt-2 text-sm">{result.baseline.response}</p>
              </div>
            )}
            <div className="rounded-2xl border border-[var(--sitch-accent)]/30 bg-[var(--sitch-accent)]/[0.06] p-5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--sitch-accent)]">
                After Sitch — {result.profile.name}
              </h4>
              <p className="mt-2 text-sm">{result.guided.response}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold">Was the Sitch-guided response right for this audience?</h4>

            {!feedbackSent && (
              <div className="mt-3 space-y-2">
                <input
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="Optional note about what felt off…"
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm"
                />
                <input
                  value={preferredResponse}
                  onChange={(e) => setPreferredResponse(e.target.value)}
                  placeholder="Optional: what should Sitch have said instead?"
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm"
                />
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleFeedback("good")}
                disabled={!!feedbackSent}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  feedbackSent === "good" ? "border-emerald-400 text-emerald-300" : "border-white/10 hover:border-white/30"
                }`}
              >
                👍 Nailed the tone
              </button>
              <button
                onClick={() => handleFeedback("bad")}
                disabled={!!feedbackSent}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  feedbackSent === "bad" ? "border-rose-400 text-rose-300" : "border-white/10 hover:border-white/30"
                }`}
              >
                👎 Missed the tone
              </button>
            </div>

            {feedbackSent && (
              <p className="mt-2 text-xs text-white/40">
                Feedback logged — it&apos;ll be included in the next learning cycle.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {selectedProfile && <ProfileCard profile={selectedProfile} />}
        <LearningActivity
          proposal={proposal}
          loading={learnLoading}
          applying={applyLoading}
          onRun={handleRunLearning}
          onApply={handleApplyProposal}
          pendingCount={pendingCount}
        />
        {selectedProfile && selectedProfile.history.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="font-semibold">Profile history</h3>
            <ol className="mt-3 space-y-3 text-sm">
              {[...selectedProfile.history].reverse().map((h) => (
                <li key={h.version} className="border-l-2 border-white/10 pl-3">
                  <div className="text-xs text-white/40">
                    v{h.version} → v{h.version + 1}
                  </div>
                  <div>{h.changeSummary}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
