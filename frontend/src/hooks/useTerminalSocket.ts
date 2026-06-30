import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";

/**
 * Owns one terminal's xterm.js instance and its /ws/terminal WebSocket (§14.3):
 * pipes PTY output → the terminal and keystrokes/resizes → the PTY. On connect the
 * backend replays scrollback, so reattaching after a reload restores recent output.
 * Returns a ref to attach to the container element.
 */
function buildWsUrl(terminalId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/terminal?terminalId=${encodeURIComponent(terminalId)}`;
}

export function useTerminalSocket(terminalId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: "var(--font-terminal), ui-monospace, monospace",
      fontSize: 13,
      // Comic Code has generous sidebearings, so claw spacing back hard. This is
      // CSS pixels of inter-cell spacing; negative tightens. Tune here if needed.
      letterSpacing: -6,
      cursorBlink: true,
      cursorStyle: "bar",
      theme: { background: "#0b0b0b" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    try {
      fit.fit();
    } catch {
      // container may not be laid out yet; the ResizeObserver below will refit
    }

    // The bundled font loads async; re-measure once it's ready so cell metrics
    // match the real glyphs instead of the fallback.
    let fontsCancelled = false;
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (fontsCancelled) return;
        try {
          fit.fit();
        } catch {
          // ignore
        }
      });
    }

    const ws = new WebSocket(buildWsUrl(terminalId));

    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };

    ws.onopen = () => sendResize();
    ws.onmessage = (ev) => {
      let msg: { type?: string; data?: unknown; message?: unknown };
      try {
        msg = JSON.parse(ev.data as string) as typeof msg;
      } catch {
        return;
      }
      if (msg.type === "data" && typeof msg.data === "string") {
        term.write(msg.data);
      } else if (msg.type === "exit") {
        term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
      } else if (msg.type === "error" && typeof msg.message === "string") {
        term.write(`\r\n\x1b[31m${msg.message}\x1b[0m\r\n`);
      }
    };

    const inputSub = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input", data }));
    });
    const resizeSub = term.onResize(() => sendResize());

    // Refit when the container resizes (window resize, tab show, layout change).
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // ignore transient zero-size measurements
      }
    });
    ro.observe(container);

    return () => {
      fontsCancelled = true;
      inputSub.dispose();
      resizeSub.dispose();
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, [terminalId]);

  return containerRef;
}
