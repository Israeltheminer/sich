export function SitchMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="46" height="46" rx="14" fill="var(--sitch-accent)" />
      <path
        d="M13 30.5V18a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v6.5a4 4 0 0 1-4 4H20.5L14 34v-3.5Z"
        fill="var(--sitch-bg)"
      />
      <circle cx="19.5" cy="21.5" r="1.7" fill="var(--sitch-accent)" />
      <circle cx="24" cy="21.5" r="1.7" fill="var(--sitch-accent)" />
      <circle cx="28.5" cy="21.5" r="1.7" fill="var(--sitch-accent)" />
    </svg>
  );
}
