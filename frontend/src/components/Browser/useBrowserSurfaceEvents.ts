import { useEffect } from "react";
import type { BrowserButton, BrowserInputEvent } from "../../hooks/useBrowserSocket";

/**
 * Wires native pointer/keyboard/wheel listeners on the screencast surface and maps
 * them into remote-page coordinates + protocol events. Kept out of BrowserView so
 * the component stays a lean renderer (§13.2). Frames are the page viewport at a
 * fixed logical size (PAGE_W×PAGE_H); the <img> is shown at an arbitrary CSS size,
 * so every pointer coordinate is scaled back to page pixels.
 *
 * Keyboard listeners live on the surface element itself (not window), so they only
 * fire while the surface is focused/hovered — typing in the chat composer is never
 * hijacked. Printable characters go out as {type:"text"} via beforeinput; named
 * non-printable keys (Enter, Backspace, Tab, arrows…) go as keydown/keyup.
 */

/** Logical page viewport the server renders frames at. */
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
  sendResize: (width: number, height: number) => void;
}

export function useBrowserSurfaceEvents({ surfaceRef, sendInput, sendResize }: Options): void {
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    // Map a pointer event's client coords into page pixels off the element's rect.
    const toPage = (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = el.getBoundingClientRect();
      const x = rect.width > 0 ? (clientX - rect.left) * (PAGE_W / rect.width) : 0;
      const y = rect.height > 0 ? (clientY - rect.top) * (PAGE_H / rect.height) : 0;
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
    const onClick = (e: MouseEvent) => {
      const { x, y } = toPage(e.clientX, e.clientY);
      sendInput({ type: "click", x, y, button: mapButton(e.button) });
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = toPage(e.clientX, e.clientY);
      sendInput({ type: "wheel", x, y, deltaX: e.deltaX, deltaY: e.deltaY });
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    // Only named non-printable keys go through keydown/keyup; printable text is sent
    // via beforeinput as {type:"text"} so IME/composition and modifiers resolve first.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) return;
      e.preventDefault();
      sendInput({ type: "keydown", key: e.key });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) return;
      e.preventDefault();
      sendInput({ type: "keyup", key: e.key });
    };
    const onBeforeInput = (e: Event) => {
      const data = (e as InputEvent).data;
      if (typeof data === "string" && data.length > 0) {
        e.preventDefault();
        sendInput({ type: "text", text: data });
      }
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("click", onClick);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("keyup", onKeyUp);
    el.addEventListener("beforeinput", onBeforeInput);

    // Report the surface's real pixel size so the server can lay out the page.
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        sendResize(Math.round(rect.width), Math.round(rect.height));
      }
    });
    ro.observe(el);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("click", onClick);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("beforeinput", onBeforeInput);
    };
  }, [surfaceRef, sendInput, sendResize]);
}
