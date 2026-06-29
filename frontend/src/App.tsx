import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { AgentManagerPanel } from "./components/AgentManager/AgentManagerPanel";
import { CockpitPanel } from "./components/Cockpit/CockpitPanel";
import { SessionPanel } from "./components/Session/SessionPanel";
import { panelSwap } from "./components/ui/motion";
import { useActiveProject } from "./hooks/queries/useProjects";
import { ProjectPicker } from "./pages/ProjectPicker";

type SectionId = "projects" | "sessions" | "cockpit" | "agents";

interface Section {
  id: SectionId;
  label: string;
  glyph: string;
  blurb: string;
  render: () => React.ReactNode;
}

const SECTIONS: Section[] = [
  { id: "projects", label: "Projects", glyph: "◳", blurb: "Workspace", render: () => <ProjectPicker /> },
  { id: "sessions", label: "Sessions", glyph: "▤", blurb: "Chat with Claude", render: () => <SessionPanel /> },
  { id: "cockpit", label: "Cockpit", glyph: "◈", blurb: "Git & pull requests", render: () => <CockpitPanel /> },
  { id: "agents", label: "Agents", glyph: "✦", blurb: "Shared config", render: () => <AgentManagerPanel /> },
];

export default function App() {
  const { data: active } = useActiveProject();
  const [section, setSection] = useState<SectionId>("projects");
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <aside className="flex w-[256px] shrink-0 flex-col gap-7 border-r border-line px-5 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent font-mono text-sm font-bold text-[#1a1205]">D</span>
          <span className="font-mono text-lg font-semibold tracking-tight">DevEasy</span>
        </div>

        <nav className="flex flex-col gap-1">
          <p className="eyebrow mb-1 px-2">Workspace</p>
          {SECTIONS.map((s) => {
            const isActive = s.id === section;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  isActive ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface/60 hover:text-ink"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent"
                  />
                )}
                <span className={`font-mono text-base ${isActive ? "text-accent" : "text-faint group-hover:text-muted"}`}>
                  {s.glyph}
                </span>
                <span className="text-sm font-medium">{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="surface-2 flex flex-col gap-1 px-3.5 py-3">
            <span className="eyebrow">Active project</span>
            <span className="flex items-center gap-2 truncate font-mono text-sm">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-success" : "bg-faint"}`} />
              <span className="truncate">{active ? active.name : "None selected"}</span>
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-baseline justify-between border-b border-line px-8 py-5">
          <div>
            <p className="eyebrow">{current.blurb}</p>
            <h1 className="m-0 font-mono text-2xl font-semibold tracking-tight">{current.label}</h1>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.section
              key={current.id}
              variants={panelSwap}
              initial="hidden"
              animate="show"
              exit="exit"
              className="h-full overflow-hidden"
            >
              {current.render()}
            </motion.section>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
