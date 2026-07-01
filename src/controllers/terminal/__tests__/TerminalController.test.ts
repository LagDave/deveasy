import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TerminalError, TerminalProcessService } from "../../../services/TerminalProcessService";
import { TerminalController } from "../TerminalController";

// Mock the service the controller consumes — the REST surface is tested in
// isolation (§20.1), asserting the { success, data, error } contract and the
// error/throw paths (§20.2). The controller is a pure input -> service ->
// envelope function, so mocked req/res exercises it directly (mirrors
// BrowserController.test.ts). TerminalError is a real export used unchanged so
// the controller's `throw new TerminalError(...)` and the status mapper line up.
vi.mock("../../../services/TerminalProcessService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/TerminalProcessService")>();
  return {
    ...actual,
    TerminalProcessService: {
      create: vi.fn(),
      list: vi.fn(),
      listBySession: vi.fn(),
      kill: vi.fn(),
    },
  };
});

const service = vi.mocked(TerminalProcessService);

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

function mockReq(opts: { body?: unknown; query?: Record<string, string> } = {}): Request {
  return { body: opts.body ?? {}, query: opts.query ?? {} } as unknown as Request;
}

const INFO = { id: "t-1", projectId: 1, sessionId: null, createdAt: "2026-07-02T00:00:00.000Z" };
const SESSION_INFO = { id: "t-2", projectId: 1, sessionId: 42, createdAt: "2026-07-02T00:00:00.000Z" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("TerminalController", () => {
  it("create passes a valid sessionId through to the service", async () => {
    service.create.mockResolvedValue(SESSION_INFO);
    const { res, captured } = mockRes();

    await TerminalController.create(mockReq({ body: { projectId: 1, sessionId: 42 } }), res);

    expect(service.create).toHaveBeenCalledWith(1, 42);
    expect(captured.status).toBe(201);
    expect(captured.body).toEqual({ success: true, data: SESSION_INFO, error: null });
  });

  it("create without a sessionId passes null (project-only terminal)", async () => {
    service.create.mockResolvedValue(INFO);
    const { res, captured } = mockRes();

    await TerminalController.create(mockReq({ body: { projectId: 1 } }), res);

    expect(service.create).toHaveBeenCalledWith(1, null);
    expect(captured.status).toBe(201);
    expect(captured.body).toEqual({ success: true, data: INFO, error: null });
  });

  it("create rejects an invalid sessionId with 400 TERMINAL_INPUT_INVALID", async () => {
    const { res, captured } = mockRes();

    await TerminalController.create(mockReq({ body: { projectId: 1, sessionId: 0 } }), res);

    expect(service.create).not.toHaveBeenCalled();
    expect(captured.status).toBe(400);
    expect(captured.body.success).toBe(false);
    expect(captured.body.error?.code).toBe("TERMINAL_INPUT_INVALID");
  });

  it("create rejects a missing projectId with 400 TERMINAL_NO_PROJECT", async () => {
    const { res, captured } = mockRes();

    await TerminalController.create(mockReq({ body: {} }), res);

    expect(service.create).not.toHaveBeenCalled();
    expect(captured.status).toBe(400);
    expect(captured.body.error?.code).toBe("TERMINAL_NO_PROJECT");
  });

  it("list with ?sessionId= returns listBySession under { terminals }", async () => {
    service.listBySession.mockReturnValue([SESSION_INFO]);
    const { res, captured } = mockRes();

    await TerminalController.list(mockReq({ query: { sessionId: "42" } }), res);

    expect(service.listBySession).toHaveBeenCalledWith(42);
    expect(service.list).not.toHaveBeenCalled();
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ success: true, data: { terminals: [SESSION_INFO] }, error: null });
  });

  it("list with ?projectId= keeps the project-based behavior", async () => {
    service.list.mockReturnValue([INFO]);
    const { res, captured } = mockRes();

    await TerminalController.list(mockReq({ query: { projectId: "1" } }), res);

    expect(service.list).toHaveBeenCalledWith(1);
    expect(service.listBySession).not.toHaveBeenCalled();
    expect(captured.body).toEqual({ success: true, data: { terminals: [INFO] }, error: null });
  });

  it("list with an invalid sessionId returns 400 TERMINAL_INPUT_INVALID", async () => {
    const { res, captured } = mockRes();

    await TerminalController.list(mockReq({ query: { sessionId: "abc" } }), res);

    expect(service.listBySession).not.toHaveBeenCalled();
    expect(captured.status).toBe(400);
    expect(captured.body.error?.code).toBe("TERMINAL_INPUT_INVALID");
  });

  it("maps a thrown TERMINAL_LIMIT_REACHED to 429", async () => {
    service.create.mockRejectedValue(
      new TerminalError("TERMINAL_LIMIT_REACHED", "Too many terminals.", { live: 12 }),
    );
    const { res, captured } = mockRes();

    await TerminalController.create(mockReq({ body: { projectId: 1 } }), res);

    expect(captured.status).toBe(429);
    expect(captured.body.error?.code).toBe("TERMINAL_LIMIT_REACHED");
  });
});
