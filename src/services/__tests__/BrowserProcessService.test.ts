import { rm } from "node:fs/promises";
import { chromium } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BROWSERS } from "../../config/constants";
import { BrowserError } from "../BrowserError";
import { BrowserProcessService } from "../BrowserProcessService";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
}));

function makePage() {
  return {
    url: () => "about:blank",
    title: () => Promise.resolve("Blank"),
    on: vi.fn(),
    mainFrame: () => ({}),
    close: vi.fn().mockResolvedValue(undefined),
    bringToFront: vi.fn().mockResolvedValue(undefined),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    mouse: {
      move: vi.fn().mockResolvedValue(undefined),
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      wheel: vi.fn().mockResolvedValue(undefined),
    },
    keyboard: {
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
      insertText: vi.fn().mockResolvedValue(undefined),
    },
    locator: vi.fn().mockReturnValue({ ariaSnapshot: vi.fn().mockResolvedValue("- WebArea") }),
  };
}

function makeContext() {
  const pages = [makePage()];
  return {
    pages: () => pages,
    newPage: vi.fn().mockImplementation(() => {
      const p = makePage();
      pages.push(p);
      return Promise.resolve(p);
    }),
    newCDPSession: vi.fn().mockResolvedValue({ on: vi.fn(), send: vi.fn().mockResolvedValue(undefined) }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

vi.mock("playwright", () => ({
  chromium: { launchPersistentContext: vi.fn() },
}));

const launchMock = vi.mocked(chromium.launchPersistentContext);

describe("BrowserProcessService", () => {
  beforeEach(() => {
    launchMock.mockImplementation(() => Promise.resolve(makeContext() as never));
  });

  afterEach(() => {
    for (const info of BrowserProcessService.list()) BrowserProcessService.close(info.sessionId);
    vi.clearAllMocks();
  });

  it("launches one persistent context per session and reuses it", async () => {
    await BrowserProcessService.ensureForSession(1);
    await BrowserProcessService.ensureForSession(1);
    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(BrowserProcessService.has(1)).toBe(true);
  });

  it("enforces the concurrency cap", async () => {
    for (let i = 0; i < MAX_BROWSERS; i++) await BrowserProcessService.ensureForSession(1000 + i);
    await expect(BrowserProcessService.ensureForSession(9999)).rejects.toMatchObject({
      code: "BROWSER_LIMIT_REACHED",
    });
  });

  it("refuses agent control while the operator is driving (grace window)", async () => {
    await BrowserProcessService.ensureForSession(2);
    BrowserProcessService.acquireControl(2, "human");
    expect(() => BrowserProcessService.acquireControl(2, "agent")).toThrow(BrowserError);
    try {
      BrowserProcessService.acquireControl(2, "agent");
    } catch (err) {
      expect((err as BrowserError).code).toBe("BROWSER_HUMAN_DRIVING");
    }
  });

  it("close keeps the profile; closeAndWipe removes it", async () => {
    await BrowserProcessService.ensureForSession(3);
    BrowserProcessService.close(3);
    expect(rm).not.toHaveBeenCalled();
    expect(BrowserProcessService.has(3)).toBe(false);

    await BrowserProcessService.ensureForSession(4);
    await BrowserProcessService.closeAndWipe(4);
    expect(rm).toHaveBeenCalledTimes(1);
    expect(BrowserProcessService.has(4)).toBe(false);
  });

  it("attach replays the last frame and detach never kills the browser", async () => {
    await BrowserProcessService.ensureForSession(5);
    const frames: string[] = [];
    const detach = BrowserProcessService.attach(5, { onFrame: (d) => frames.push(d) });
    detach();
    expect(BrowserProcessService.has(5)).toBe(true);
  });

  it("throws BROWSER_NOT_FOUND for actions on an unknown session", () => {
    expect(() => BrowserProcessService.activePage(99)).toThrow(BrowserError);
  });
});
