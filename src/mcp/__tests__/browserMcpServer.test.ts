import type { Express, Request } from "express";
import { describe, expect, it, vi } from "vitest";
import { MCP_PATH } from "../../config/constants";
import { attachBrowserMcp, authorizeMcpRequest } from "../browserMcpServer";
import { issueBrowserMcpToken, revokeBrowserMcpToken, validateBrowserMcpToken } from "../browserMcpTokens";

function fakeReq(opts: { ip?: string; headers?: Record<string, string> }): Request {
  const headers = opts.headers ?? {};
  return {
    ip: opts.ip ?? "127.0.0.1",
    socket: { remoteAddress: opts.ip ?? "127.0.0.1" },
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe("browserMcpTokens", () => {
  it("validates only the issued token and revokes it", () => {
    const token = issueBrowserMcpToken(11);
    expect(validateBrowserMcpToken(11, token)).toBe(true);
    expect(validateBrowserMcpToken(11, "nope")).toBe(false);
    expect(validateBrowserMcpToken(11, "")).toBe(false);
    expect(validateBrowserMcpToken(12, token)).toBe(false);
    revokeBrowserMcpToken(11);
    expect(validateBrowserMcpToken(11, token)).toBe(false);
  });
});

describe("authorizeMcpRequest", () => {
  it("accepts a loopback request with the matching session token", () => {
    const token = issueBrowserMcpToken(21);
    const result = authorizeMcpRequest(
      fakeReq({ ip: "127.0.0.1", headers: { "x-deveasy-session": "21", "x-deveasy-token": token } }),
    );
    expect(result).toEqual({ ok: true, sessionId: 21 });
  });

  it("refuses a non-loopback origin", () => {
    const token = issueBrowserMcpToken(22);
    const result = authorizeMcpRequest(
      fakeReq({ ip: "10.0.0.5", headers: { "x-deveasy-session": "22", "x-deveasy-token": token } }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses an invalid session id", () => {
    const result = authorizeMcpRequest(
      fakeReq({ headers: { "x-deveasy-session": "abc", "x-deveasy-token": "x" } }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a wrong token", () => {
    issueBrowserMcpToken(23);
    const result = authorizeMcpRequest(
      fakeReq({ headers: { "x-deveasy-session": "23", "x-deveasy-token": "wrong" } }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("attachBrowserMcp", () => {
  it("registers POST/GET/DELETE on the MCP path", () => {
    const app = { post: vi.fn(), get: vi.fn(), delete: vi.fn() } as unknown as Express;
    attachBrowserMcp(app);
    expect(app.post).toHaveBeenCalledWith(MCP_PATH, expect.any(Function));
    expect(app.get).toHaveBeenCalledWith(MCP_PATH, expect.any(Function));
    expect(app.delete).toHaveBeenCalledWith(MCP_PATH, expect.any(Function));
  });
});
