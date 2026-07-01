import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type CDPSession, type Page } from "playwright";
import {
  BROWSER_ACTION_TIMEOUT_MS,
  BROWSER_DEFAULT_VIEWPORT,
  BROWSER_EVICTION_INTERVAL_MS,
  BROWSER_HOME_URL,
  BROWSER_HUMAN_CONTROL_GRACE_MS,
  BROWSER_IDLE_MS,
  BROWSER_PROFILES_DIR,
  BROWSER_SCREENCAST_QUALITY,
  MAX_BROWSERS,
} from "../config/constants";
import { childLogger } from "../lib/logger";
import { BrowserError } from "./BrowserError";

const log = childLogger({ module: "BrowserProcessService" });

export type ControllerKind = "agent" | "human";
export type MouseButton = "left" | "right" | "middle";

/** Input forwarded from the operator's screencast view (coordinates are page pixels). */
export type BrowserInputEvent =
  | { type: "mousemove"; x: number; y: number }
  | { type: "mousedown"; x: number; y: number; button: MouseButton }
  | { type: "mouseup"; x: number; y: number; button: MouseButton }
  | { type: "click"; x: number; y: number; button: MouseButton }
  | { type: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
  | { type: "keydown"; key: string }
  | { type: "keyup"; key: string }
  | { type: "text"; text: string };

/** Broadcast notices (not frames) pushed to viewers so the UI chrome stays in sync. */
export type BrowserBroadcast =
  | { type: "navigate"; url: string; title: string; tabs: TabInfo[] }
  | { type: "controller"; controller: ControllerKind | null }
  | { type: "closed" };

/** What the WS relay subscribes with: live JPEG frames + chrome-sync notices. */
export interface BrowserFrameSubscriber {
  onFrame: (dataBase64: string) => void;
  onEvent?: (event: BrowserBroadcast) => void;
}

export interface TabInfo {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

/** Public browser metadata (never exposes a Playwright handle). */
export interface BrowserInfo {
  sessionId: number;
  createdAt: string;
  controller: ControllerKind | null;
  tabs: TabInfo[];
}

interface LiveTab {
  id: string;
  page: Page;
  cdp: CDPSession | null;
}

interface LiveBrowser {
  sessionId: number;
  context: BrowserContext;
  createdAt: string;
  tabs: LiveTab[];
  activeTabId: string;
  subscribers: Set<BrowserFrameSubscriber>;
  lastFrame: string | null;
  screencasting: boolean;
  controller: ControllerKind | null;
  controllerSince: number;
  lastActivityAt: number;
}

interface ScreencastFramePayload {
  data: string;
  sessionId: number;
}

/**
 * Owns the lifecycle of session-scoped Playwright browsers — one persistent
 * Chromium per DevEasy session, kept in memory for the server's lifetime. Both the
 * operator (via /ws/browser) and the agent (via the MCP server) drive the SAME
 * browser through this one registry, so it is also the single chokepoint for the
 * input-contention lock. Detaching a viewer only stops the screencast; the browser
 * keeps running so a reload reattaches. Profiles persist on disk (login survives
 * reload and restart); only closeAndWipe() deletes them. All contexts are reaped on
 * SIGINT/SIGTERM/SIGBREAK.
 *
 * Three-state lifecycle: close() suspends (kill process, keep profile);
 * closeAndWipe() deletes (kill + wipe profile); a crash leaves the profile on disk
 * for gcOrphanProfiles() to reconcile at startup.
 */
export class BrowserProcessService {
  private static readonly live = new Map<number, LiveBrowser>();
  private static signalsBound = false;
  private static evictionTimer: NodeJS.Timeout | null = null;

  /** Launch (or return the existing) browser for a session. Lazy — first UI open OR first agent tool call. */
  static async ensureForSession(sessionId: number): Promise<BrowserInfo> {
    this.bindSignals();
    this.startEvictionTimer();

    const existing = this.live.get(sessionId);
    if (existing) return this.toInfo(existing);

    if (this.live.size >= MAX_BROWSERS) {
      throw new BrowserError(
        "BROWSER_LIMIT_REACHED",
        `Too many browsers (max ${MAX_BROWSERS}). Close one and retry.`,
        { live: this.live.size },
      );
    }

    const entry = await this.launch(sessionId);
    this.live.set(sessionId, entry);
    log.info({ sessionId, tabs: entry.tabs.length }, "Browser launched");
    return this.toInfo(entry);
  }

  /** Live browsers (for reattach after reload). */
  static list(): BrowserInfo[] {
    return [...this.live.values()].map((e) => this.toInfo(e));
  }

  static getInfo(sessionId: number): BrowserInfo | null {
    const entry = this.live.get(sessionId);
    return entry ? this.toInfo(entry) : null;
  }

  static has(sessionId: number): boolean {
    return this.live.has(sessionId);
  }

  /**
   * Subscribe to a browser: replays the last frame immediately, then starts the
   * screencast if this is the first viewer. Returns a detach fn that stops the
   * screencast when the last viewer leaves — but never kills the browser.
   */
  static attach(sessionId: number, subscriber: BrowserFrameSubscriber): () => void {
    const entry = this.mustGet(sessionId);
    entry.subscribers.add(subscriber);
    this.touch(sessionId);
    if (entry.lastFrame) subscriber.onFrame(entry.lastFrame);
    // Replay the current URL + tab list (and controller) so the address bar and tab
    // strip populate immediately on (re)connect — not only on the next navigation.
    this.replayState(subscriber, entry);
    if (!entry.screencasting) void this.startScreencast(entry);
    return () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) void this.stopScreencast(entry);
    };
  }

  /** Forward an operator input event to the active tab; acquires human control (§ lock). */
  static async dispatchInput(sessionId: number, event: BrowserInputEvent): Promise<void> {
    const entry = this.mustGet(sessionId);
    this.acquireControl(sessionId, "human");
    this.touch(sessionId);
    const page = this.activeTab(entry).page;
    const mouse = page.mouse;
    switch (event.type) {
      case "mousemove": await mouse.move(event.x, event.y); break;
      case "mousedown": await mouse.move(event.x, event.y); await mouse.down({ button: event.button }); break;
      case "mouseup": await mouse.up({ button: event.button }); break;
      case "click": await mouse.click(event.x, event.y, { button: event.button }); break;
      case "wheel": await mouse.move(event.x, event.y); await mouse.wheel(event.deltaX, event.deltaY); break;
      case "keydown": await page.keyboard.down(event.key); break;
      case "keyup": await page.keyboard.up(event.key); break;
      case "text": await page.keyboard.insertText(event.text); break;
    }
  }

  /** Resize the active page viewport and re-arm the screencast. */
  static async resize(sessionId: number, width: number, height: number): Promise<void> {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return;
    const entry = this.live.get(sessionId);
    if (!entry) return;
    try {
      await this.activeTab(entry).page.setViewportSize({ width, height });
      if (entry.screencasting) {
        await this.stopScreencast(entry);
        await this.startScreencast(entry);
      }
    } catch (err) {
      log.warn({ sessionId, err }, "Browser resize failed");
    }
  }

  // --- control lock (single chokepoint, §5.4) ---

  /**
   * Acquire the driving lock for one side. The operator always wins; an agent call
   * within the human grace window is refused with BROWSER_HUMAN_DRIVING so the tool
   * can surface it and retry.
   */
  static acquireControl(sessionId: number, who: ControllerKind): void {
    const entry = this.mustGet(sessionId);
    const now = Date.now();
    if (
      who === "agent" &&
      entry.controller === "human" &&
      now - entry.controllerSince < BROWSER_HUMAN_CONTROL_GRACE_MS
    ) {
      throw new BrowserError("BROWSER_HUMAN_DRIVING", "The operator is currently driving this browser.", {
        sessionId,
      });
    }
    if (entry.controller !== who) {
      entry.controller = who;
      this.broadcast(entry, { type: "controller", controller: who });
    }
    entry.controllerSince = now;
  }

  static touch(sessionId: number): void {
    const entry = this.live.get(sessionId);
    if (entry) entry.lastActivityAt = Date.now();
  }

  // --- tabs ---

  static listTabs(sessionId: number): TabInfo[] {
    return this.mustGet(sessionId).tabs.map((t) => this.toTabInfo(this.mustGet(sessionId), t));
  }

  static async newTab(sessionId: number): Promise<TabInfo> {
    const entry = this.mustGet(sessionId);
    const page = await entry.context.newPage();
    const tab = this.wireTab(entry, page);
    entry.tabs.push(tab);
    await this.setActiveTab(sessionId, tab.id);
    return this.toTabInfo(entry, tab);
  }

  static async closeTab(sessionId: number, tabId: string): Promise<void> {
    const entry = this.mustGet(sessionId);
    const idx = entry.tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;
    const [tab] = entry.tabs.splice(idx, 1);
    await tab.page.close().catch((err) => log.warn({ sessionId, tabId, err }, "Tab close failed"));
    if (entry.tabs.length === 0) {
      const page = await entry.context.newPage();
      entry.tabs.push(this.wireTab(entry, page));
    }
    if (entry.activeTabId === tabId) await this.setActiveTab(sessionId, entry.tabs[0].id);
  }

  static async setActiveTab(sessionId: number, tabId: string): Promise<void> {
    const entry = this.mustGet(sessionId);
    const tab = entry.tabs.find((t) => t.id === tabId);
    if (!tab) throw new BrowserError("BROWSER_TAB_NOT_FOUND", "No such tab.", { sessionId, tabId });
    if (entry.activeTabId === tabId) return;
    await this.stopScreencast(entry);
    entry.activeTabId = tabId;
    await tab.page.bringToFront().catch(() => undefined);
    if (entry.subscribers.size > 0) await this.startScreencast(entry);
    this.broadcastNav(entry, tab);
  }

  /** The active page — the target of agent semantic actions (BrowserActionService). */
  static activePage(sessionId: number): Page {
    return this.activeTab(this.mustGet(sessionId)).page;
  }

  // --- teardown ---

  /** Suspend: kill the process, KEEP the profile (login survives). Reopen re-launches. */
  static close(sessionId: number): void {
    const entry = this.live.get(sessionId);
    if (!entry) return;
    void this.teardown(entry, { wipe: false });
  }

  /** Delete: kill the process AND wipe the profile. Wired into session deletion. */
  static async closeAndWipe(sessionId: number): Promise<void> {
    const entry = this.live.get(sessionId);
    if (entry) {
      await this.teardown(entry, { wipe: true });
      return;
    }
    // No live process (suspended or never opened) — the profile may still be on disk.
    await this.wipeProfile(sessionId);
  }

  /** Startup reconciliation: drop profile dirs that no longer map to a session. */
  static async gcOrphanProfiles(keep: Set<number>): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(BROWSER_PROFILES_DIR);
    } catch {
      return; // dir absent yet — nothing to reconcile
    }
    for (const name of entries) {
      const id = Number(name);
      if (!Number.isInteger(id) || keep.has(id)) continue;
      await this.wipeProfile(id);
      log.info({ sessionId: id }, "GC'd orphan browser profile");
    }
  }

  // --- internals ---

  private static async launch(sessionId: number): Promise<LiveBrowser> {
    const userDataDir = path.join(BROWSER_PROFILES_DIR, String(sessionId));
    await mkdir(userDataDir, { recursive: true });
    let context: BrowserContext;
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        viewport: { ...BROWSER_DEFAULT_VIEWPORT },
        args: ["--no-first-run", "--no-default-browser-check"],
      });
    } catch (err) {
      throw new BrowserError("BROWSER_LAUNCH_FAILED", "Failed to start the browser.", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    const entry: LiveBrowser = {
      sessionId,
      context,
      createdAt: new Date().toISOString(),
      tabs: [],
      activeTabId: "",
      subscribers: new Set(),
      lastFrame: null,
      screencasting: false,
      controller: null,
      controllerSince: 0,
      lastActivityAt: Date.now(),
    };
    const first = context.pages()[0] ?? (await context.newPage());
    const tab = this.wireTab(entry, first);
    entry.tabs.push(tab);
    entry.activeTabId = tab.id;
    // Open the home page in the background so a fresh browser isn't a blank void.
    // Fire-and-forget: ensureForSession returns immediately and the screencast shows
    // the page load. Only new launches navigate — reattaching keeps the current page.
    void first
      .goto(BROWSER_HOME_URL, { waitUntil: "domcontentloaded", timeout: BROWSER_ACTION_TIMEOUT_MS })
      .catch((err) => log.warn({ sessionId, err }, "Home-page navigation failed"));
    return entry;
  }

  private static wireTab(entry: LiveBrowser, page: Page): LiveTab {
    const tab: LiveTab = { id: randomUUID(), page, cdp: null };
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && entry.activeTabId === tab.id) this.broadcastNav(entry, tab);
    });
    return tab;
  }

  private static activeTab(entry: LiveBrowser): LiveTab {
    const tab = entry.tabs.find((t) => t.id === entry.activeTabId);
    if (!tab) throw new BrowserError("BROWSER_NO_TAB", "No active tab.", { sessionId: entry.sessionId });
    return tab;
  }

  private static async startScreencast(entry: LiveBrowser): Promise<void> {
    if (entry.screencasting) return;
    const tab = this.activeTab(entry);
    try {
      if (!tab.cdp) {
        tab.cdp = await entry.context.newCDPSession(tab.page);
        tab.cdp.on("Page.screencastFrame", (params) =>
          this.handleFrame(entry, tab, params as ScreencastFramePayload),
        );
      }
      await tab.cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: BROWSER_SCREENCAST_QUALITY,
        maxWidth: BROWSER_DEFAULT_VIEWPORT.width,
        maxHeight: BROWSER_DEFAULT_VIEWPORT.height,
      });
      entry.screencasting = true;
    } catch (err) {
      log.warn({ sessionId: entry.sessionId, err }, "startScreencast failed");
    }
  }

  private static async stopScreencast(entry: LiveBrowser): Promise<void> {
    if (!entry.screencasting) return;
    entry.screencasting = false;
    const tab = entry.tabs.find((t) => t.id === entry.activeTabId);
    if (tab?.cdp) {
      try {
        await tab.cdp.send("Page.stopScreencast");
      } catch (err) {
        log.warn({ sessionId: entry.sessionId, err }, "stopScreencast failed");
      }
    }
  }

  private static handleFrame(entry: LiveBrowser, tab: LiveTab, params: ScreencastFramePayload): void {
    entry.lastFrame = params.data;
    for (const sub of entry.subscribers) {
      try {
        sub.onFrame(params.data);
      } catch (err) {
        log.error({ sessionId: entry.sessionId, err }, "Frame subscriber threw; continuing");
      }
    }
    tab.cdp
      ?.send("Page.screencastFrameAck", { sessionId: params.sessionId })
      .catch((err) => log.warn({ sessionId: entry.sessionId, err }, "screencastFrameAck failed"));
  }

  private static broadcast(entry: LiveBrowser, event: BrowserBroadcast): void {
    for (const sub of entry.subscribers) {
      try {
        sub.onEvent?.(event);
      } catch {
        // ignore — a broken subscriber is dropped on its own WS close
      }
    }
  }

  /** Send the current chrome state (url + tabs + controller) to one newly-attached viewer. */
  private static replayState(subscriber: BrowserFrameSubscriber, entry: LiveBrowser): void {
    const tab = entry.tabs.find((t) => t.id === entry.activeTabId);
    if (!tab) return;
    subscriber.onEvent?.({ type: "navigate", url: tab.page.url(), title: "", tabs: this.tabInfos(entry) });
    if (entry.controller) subscriber.onEvent?.({ type: "controller", controller: entry.controller });
  }

  private static broadcastNav(entry: LiveBrowser, tab: LiveTab): void {
    const url = tab.page.url();
    void tab.page
      .title()
      .then((title) => this.broadcast(entry, { type: "navigate", url, title, tabs: this.tabInfos(entry) }))
      .catch(() => this.broadcast(entry, { type: "navigate", url, title: url, tabs: this.tabInfos(entry) }));
  }

  private static async teardown(entry: LiveBrowser, { wipe }: { wipe: boolean }): Promise<void> {
    this.live.delete(entry.sessionId);
    this.broadcast(entry, { type: "closed" });
    try {
      await entry.context.close();
    } catch (err) {
      log.warn({ sessionId: entry.sessionId, err }, "context.close failed");
    }
    log.info({ sessionId: entry.sessionId, wipe }, "Browser torn down");
    if (wipe) await this.wipeProfile(entry.sessionId);
  }

  private static async wipeProfile(sessionId: number): Promise<void> {
    const dir = path.join(BROWSER_PROFILES_DIR, String(sessionId));
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      log.warn({ sessionId, err }, "Failed to wipe browser profile");
    }
  }

  private static tabInfos(entry: LiveBrowser): TabInfo[] {
    return entry.tabs.map((t) => this.toTabInfo(entry, t));
  }

  private static toTabInfo(entry: LiveBrowser, tab: LiveTab): TabInfo {
    return { id: tab.id, title: "", url: tab.page.url(), active: tab.id === entry.activeTabId };
  }

  private static toInfo(entry: LiveBrowser): BrowserInfo {
    return {
      sessionId: entry.sessionId,
      createdAt: entry.createdAt,
      controller: entry.controller,
      tabs: this.tabInfos(entry),
    };
  }

  private static mustGet(sessionId: number): LiveBrowser {
    const entry = this.live.get(sessionId);
    if (!entry) throw new BrowserError("BROWSER_NOT_FOUND", "No live browser for this session.", { sessionId });
    return entry;
  }

  private static startEvictionTimer(): void {
    if (this.evictionTimer) return;
    this.evictionTimer = setInterval(() => void this.evictIdle(), BROWSER_EVICTION_INTERVAL_MS);
    this.evictionTimer.unref?.();
  }

  private static evictIdle(): void {
    const now = Date.now();
    for (const entry of this.live.values()) {
      if (entry.subscribers.size === 0 && now - entry.lastActivityAt > BROWSER_IDLE_MS) {
        log.info({ sessionId: entry.sessionId }, "Evicting idle browser (suspend; profile kept)");
        this.close(entry.sessionId);
      }
    }
  }

  private static killAll(): void {
    for (const entry of this.live.values()) void this.teardown(entry, { wipe: false });
  }

  private static bindSignals(): void {
    if (this.signalsBound) return;
    this.signalsBound = true;
    const onSignal = (signal: NodeJS.Signals): void => {
      log.info({ signal, live: this.live.size }, "Signal received; reaping live browsers");
      this.killAll();
    };
    process.on("SIGINT", () => onSignal("SIGINT"));
    process.on("SIGTERM", () => onSignal("SIGTERM"));
    process.on("SIGBREAK", () => onSignal("SIGBREAK")); // Windows Ctrl+Break
  }
}
