import { SitchMark } from "@/components/icons";
import { Playground } from "@/components/Playground";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
          <SitchMark className="h-9 w-9" />
          <div>
            <div className="text-lg font-semibold tracking-tight">Sitch</div>
            <div className="text-xs text-white/40">Self-Improvement Communication Harness</div>
          </div>
          <p className="ml-auto hidden max-w-sm text-right text-sm text-white/50 sm:block">
            AI should adapt to how people communicate — not the other way around.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Playground />
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/30">
        Sitch Playground · POST /api/sitch/respond for the developer API · see README for architecture
      </footer>
    </div>
  );
}
