import { CommunicationProfile, CommunicationTraits } from "@/lib/sitch/types";

const TRAIT_LABELS: [keyof CommunicationTraits, string][] = [
  ["formality", "Formality"],
  ["directness", "Directness"],
  ["warmth", "Warmth"],
  ["vocabulary", "Vocabulary"],
  ["responseLength", "Response length"],
  ["languageMixing", "Language mixing"],
];

export function ProfileCard({ profile }: { profile: CommunicationProfile }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-lg">{profile.name}</h3>
        <span className="text-xs uppercase tracking-wide text-white/40">v{profile.version}</span>
      </div>
      <p className="mt-1 text-sm text-white/50">{profile.description}</p>

      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        {TRAIT_LABELS.map(([key, label]) => (
          <div key={key} className="contents">
            <dt className="text-white/50">{label}</dt>
            <dd className="text-right font-medium">{profile.traits[key]}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-white/40">Learned patterns</h4>
        {profile.learnedPatterns.length === 0 ? (
          <p className="mt-2 text-sm text-white/40 italic">
            Nothing learned yet — this profile is at its cold-start default.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {profile.learnedPatterns.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[var(--sitch-accent)]">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
