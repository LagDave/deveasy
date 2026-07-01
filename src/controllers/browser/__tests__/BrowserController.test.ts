import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserError } from "../../../services/BrowserError";
import { BrowserProcessService } from "../../../services/BrowserProcessService";
import { BrowserController } from "../BrowserController";

// Mock the service the controller consumes — the REST surface is tested in
// isolation (§20.1), asserting the { success, data, error } contract and the
// error/throw paths (§20.2). supertest is intentionally not used: it is not a
// project dependency and the controller is a pure input -> service -> envelope
// function, so mocked req/res exercises it directly.
vi.mock("../../../services/BrowserProcessService", () => ({
  BrowserProcessService: {
    ensureForSession: vi.fn(),
    getInfo: vi.fn(),
    list: vi.fn(),
    close: vi.fn(),
    listTabs: vi.fn(),
    newTab: vi.fn(),
    closeTab: vi.fn(),
    setActiveTab: vi.fn(),
  },
}));

const service = vi.mocked(BrowserProcessService);

interface Captured {
  status: number;
  body: { success: boolean; data: unknown; error: { code: string; message: string } | null };
}

/** A minimal Express Response that records the status + JSON body the handler sends. */
function mockRes(): { res: Response; captured: Captured } {
  const captured: Captured = { status: 200, body: { success: false, data: null, error: null } };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: Captured["body"]) {
      captured.body = payload;
      return this;
    },
  } as unknown as Response;
  return { res, captured };
}

function mockReq(params: Record<string, string> = {}): Request {
  return { params } as unknown as Request;
}

const INFO = { sessionId: 1, createdAt: "2026-07-01T00:00:00.000Z", controller: null, tabs: [] };

afterEach(() => {
  vi.clearAllMocks();
});

describe("BrowserController", () => {
  it("open returns the success envelope with the browser info", async () => {
    service.ensureForSession.mockResolvedValue(INFO);
    const { res, captured } = mockRes();

    await BrowserController.open(mockReq({ sessionId: "1" }), res);

    expect(service.ensureForSession).toHaveBeenCalledWith(1);
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ success: true, data: INFO, error: null });
  });

  it("getInfo on an unknown session returns 404 BROWSER_NOT_FOUND", async () => {
    service.getInfo.mockReturnValue(null);
    const { res, captured } = mockRes();

    await BrowserController.getInfo(mockReq({ sessionId: "99" }), res);

    expect(captured.status).toBe(404);
    expect(captured.body.success).toBe(false);
    expect(captured.body.data).toBeNull();
    expect(captured.body.error?.code).toBe("BROWSER_NOT_FOUND");
  });

  it("rejects an invalid session id with 400 BROWSER_INPUT_INVALID", async () => {
    const { res, captured } = mockRes();

    await BrowserController.getInfo(mockReq({ sessionId: "abc" }), res);

    expect(service.getInfo).not.toHaveBeenCalled();
    expect(captured.status).toBe(400);
    expect(captured.body.success).toBe(false);
    expect(captured.body.error?.code).toBe("BROWSER_INPUT_INVALID");
  });

  it("maps a thrown BROWSER_LIMIT_REACHED to 429", async () => {
    service.ensureForSession.mockRejectedValue(
      new BrowserError("BROWSER_LIMIT_REACHED", "Too many browsers.", { live: 4 }),
    );
    const { res, captured } = mockRes();

    await BrowserController.open(mockReq({ sessionId: "5" }), res);

    expect(captured.status).toBe(429);
    expect(captured.body.success).toBe(false);
    expect(captured.body.error?.code).toBe("BROWSER_LIMIT_REACHED");
  });

  it("list returns the live browsers under { browsers }", async () => {
    service.list.mockReturnValue([INFO]);
    const { res, captured } = mockRes();

    await BrowserController.list(mockReq(), res);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ success: true, data: { browsers: [INFO] }, error: null });
  });

  it("closeTab without a tabId returns 400 BROWSER_INPUT_INVALID", async () => {
    const { res, captured } = mockRes();

    await BrowserController.closeTab(mockReq({ sessionId: "1" }), res);

    expect(service.closeTab).not.toHaveBeenCalled();
    expect(captured.status).toBe(400);
    expect(captured.body.error?.code).toBe("BROWSER_INPUT_INVALID");
  });
});
