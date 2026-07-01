import { useEffect } from "react";
import type { BrowserButton, BrowserInputEvent } from "../../hooks/useBrowserSocket";

/**
 * Wires native pointer/keyboard/wheel listeners on the screencast surface and maps
 * them into remote-page coordinates + protocol events. Kept out of BrowserView so
 * the component stays a lean renderer (§13.2).
 *
 * Frames are the page viewport at a FIXED logical size (PAGE_W×PAGE_H) — the server
 * never resizes it — and the <img> is shown object-contain, so pointer coordinates
 * are mapped through the letterboxed content rect (scale + centering offset), not the
 * raw element rect.
 *
 * Keyboard listeners live on the surface element itself (not window), so they only
 * fire while it's focused — typing in the chat composer is never hijacked. Printable
 * characters are sent as {type:"text"}; named non-printable keys and shortcuts go as
 * keydown/keyup.
 */

/** Logical page viewport the server renders frames at (fixed; matches the screencast size). */
const PAGE_W = 1280;
const PAGE_H = 800;

function mapButton(button: number): BrowserButton {
  if (button === 1) return "middle";
  if (button === 2) return "right";
  return "left";
}

function clamp(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

interface Options {
  surfaceRef: React.RefObject<HTMLElement | null>;
  sendInput: (event: BrowserInputEvent) => void;
}

export function useBrowserSurfaceEvents({ surfaceRef, sendInput }: Options): void {
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    // Map client coords -> page pixels through the object-contain content rect: the
    // image is letterboxed inside the element, so account for the scale and centering.
    const toPage = (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
      const scale = Math.min(rect.width / PAGE_W, rect.height / PAGE_H);
      const offX = (rect.width - PAGE_W * scale) / 2;
      const offY = (rect.height - PAGE_H * scale) / 2;
      const x = (clientX - rect.left - offX) / scale;
      const y = (clientY - rect.top - offY) / scale;
      return { x: Math.round(clamp(x, PAGE_W)), y: Math.round(clamp(y, PAGE_H)) };
    };

    // Throttle mousemove to one send per animation frame — the pointer fires far
    // more often than the screencast can use.
    let rafId: number | null = null;
    let pending: { x: number; y: number } | null = null;
    const flushMove = () => {
      rafId = null;
      if (pending) {
        sendInput({ type: "mousemove", x: pending.x, y: pending.y });
        pending = null;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      pending = toPage(e.clientX, e.clientY);
      if (rafId === null) rafId = requestAnimationFrame(flushMove);
    };
    const onMouseDown = (e: MouseEvent) => {
      const { x, y } = toPage(e.clientX, e.clientY);
      sendInput({ type: "mousedown", x, y, button: mapButton(e.button) });
    };
    const onMouseUp = (e: MouseEvent) => {
      const { x, y } = toPage(e.clientX, e.clientY);
      sendInput({ type: "mouseup", x, y, button: mapButton(e.button) });
    };
    // No separate "click" — mousedown + mouseup already compose one click in the
    // page. Sending click too would double it (select-then-deselect on toggles).
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = toPage(e.clientX, e.clientY);
      sendInput({ type: "wheel", x, y, deltaX: e.deltaX, deltaY: e.deltaY });
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    // Printable single char (no ctrl/meta) -> insert as text; everything else
    // (Enter, Backspace, Tab, arrows, shortcuts) -> keydown/keyup.
    const isPrintable = (e: KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (isPrintable(e)) sendInput({ type: "text", text: e.key });
      else sendInput({ type: "keydown", key: e.key });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isPrintable(e)) return; // printable was handled on keydown
      e.preventDefault();
      sendInput({ type: "keyup", key: e.key });
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("keyup", onKeyUp);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("keyup", onKeyUp);
    };
  }, [surfaceRef, sendInput]);
}
