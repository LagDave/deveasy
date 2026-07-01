import { useEffect, useRef, useState } from "react";
import type { BrowserController } from "../../api/browser";
import {
  useActivateTab,
  useCloseBrowser,
  useCloseTab,
  useNewTab,
  useOpenBrowser,
} from "../../hooks/queries/useBrowserQueries";
import { useBrowserSocket } from "../../hooks/useBrowserSocket";
import { Icon } from "../ui/Icon";
import { BrowserTabStrip } from "./BrowserTabStrip";
import { useBrowserSurfaceEvents } from "./useBrowserSurfaceEvents";

interface Props {
  sessionId: number;
  /** Called after the browser is closed-and-freed, to collapse the pane. */
  onClose: () => void;
}

const CONTROLLER_LABEL: Record<"agent" | "human", string> = {
  agent: "Agent",
  human: "You",
};

/**
 * Per-session browser shell: a top bar (tabs + address + controller + close) over a
 * live screencast surface. Mounting this launches Chromium (openBrowser) and opens
 * the /ws/browser socket; frames render to a native <img> wired for pointer/keyboard
 * input (§14.1 — REST via hooks, live stream via useBrowserSocket).
 */
export function BrowserView({ sessionId, onClose }: Props) {
  const { frameImgRef, tabs, url, controller, connState, errorMessage, sendInput, sendNavigate } =
    useBrowserSocket(sessionId);

  const openBrowser = useOpenBrowser(sessionId);
  const closeBrowser = useCloseBrowser(sessionId);
  const newTab = useNewTab(sessionId);
  const closeTab = useCloseTab(sessionId);
  const activateTab = useActivateTab(sessionId);

  const surfaceRef = useRef<HTMLImageElement | null>(null);
  useBrowserSurfaceEvents({ surfaceRef, sendInput });

  // Address-bar text, seeded from the live URL as the page navigates.
  const [address, setAddress] = useState("");
  useEffect(() => {
    if (url) setAddress(url);
  }, [url]);

  // Launching the pane is what boots Chromium. Fire once per session mount.
  const launchedRef = useRef(false);
  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    openBrowser.mutate();
    // openBrowser identity is stable across renders (React Query); intentional one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Hide the pane but leave the browser running server-side — reopening reattaches
  // (detach never kills, § persistence). This is the everyday dismiss.
  const handleHide = () => onClose();
  // Explicitly kill Chromium and reclaim its memory, then collapse the pane.
  const handleCloseAndFree = () => closeBrowser.mutate(undefined, { onSettled: onClose });

  // Grab the human lock by nudging the pointer — a no-op input that claims control.
  const takeControl = () => sendInput({ type: "mousemove", x: 0, y: 0 });

  return (
    <div className="flex h-full min-w-0 flex-col bg-[#0b0b0b]">
      <BrowserTabStrip
        tabs={tabs}
        onSelect={(id) => activateTab.mutate(id)}
        onClose={(id) => closeTab.mutate(id)}
        onNew={() => newTab.mutate()}
      />

      <div className="flex items-center gap-2.5 border-b border-line px-3 py-2">
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            const target = address.trim();
            if (target) sendNavigate(target);
          }}
        >
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={connState === "open" ? "Enter a URL and press Enter" : "Connecting…"}
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-md border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs text-ink outline-none placeholder:text-faint focus:border-accent"
          />
        </form>
        <ControllerIndicator controller={controller} onTakeControl={takeControl} />
        <button
          type="button"
          onClick={handleCloseAndFree}
          title="Close browser & free memory"
          aria-label="Close browser and free memory"
          className="grid h-7 w-7 shrink-0 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink"
        >
          <Icon name="delete" size={15} />
        </button>
        <button
          type="button"
          onClick={handleHide}
          title="Hide browser (keeps running)"
          aria-label="Hide browser"
          className="grid h-7 w-7 shrink-0 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <img
          ref={(node) => {
            frameImgRef.current = node;
            surfaceRef.current = node;
          }}
          tabIndex={0}
          alt="Browser screencast"
          draggable={false}
          className="h-full w-full select-none object-contain outline-none"
        />
        {(connState === "error" || errorMessage) && (
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-[#9b1c1c]/90 px-3 py-1.5 text-center text-xs text-white">
            {errorMessage ?? "Browser connection lost"}
          </div>
        )}
      </div>
    </div>
  );
}

/** Small "who's driving" indicator; offers "Take control" when the agent holds it. */
function ControllerIndicator({
  controller,
  onTakeControl,
}: {
  controller: BrowserController;
  onTakeControl: () => void;
}) {
  if (controller === "agent") {
    return (
      <button
        type="button"
        onClick={onTakeControl}
        title="Agent is driving — click to take control"
        className="shrink-0 rounded border border-line px-2 py-0.5 text-[11px] font-semibold text-muted hover:bg-surface-2 hover:text-ink"
      >
        Agent · Take control
      </button>
    );
  }
  return (
    <span className="shrink-0 rounded border border-line px-2 py-0.5 text-[11px] font-semibold text-faint">
      {controller ? CONTROLLER_LABEL[controller] : "Idle"}
    </span>
  );
}
