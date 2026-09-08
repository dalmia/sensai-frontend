/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }));

const { getServerSession } = require("next-auth");

process.env.BACKEND_URL = "http://backend.internal:8001";
process.env.AUTH_SECRET_KEY = "test-secret-key";

const { GET, POST, DELETE } = require("@/app/api/backend/[...path]/route");

function req(url: string, init: RequestInit = {}) {
  return new NextRequest(new Request(url, init));
}

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("backend proxy", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn().mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } })
    );
  });

  describe("authentication", () => {
    it("rejects an unauthenticated request", async () => {
      getServerSession.mockResolvedValue(null);
      const res = await GET(req("http://localhost/api/backend/users/1"), ctx(["users", "1"]));
      expect(res.status).toBe(401);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("rejects a session with no user id", async () => {
      getServerSession.mockResolvedValue({ user: { email: "a@b.com" } });
      const res = await GET(req("http://localhost/api/backend/users/1"), ctx(["users", "1"]));
      expect(res.status).toBe(401);
    });

    it("attaches a bearer token for an authenticated user", async () => {
      getServerSession.mockResolvedValue({ user: { id: "42", email: "a@b.com" } });
      await GET(req("http://localhost/api/backend/users/42"), ctx(["users", "42"]));

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const auth = (options.headers as Headers).get("Authorization");
      expect(auth).toMatch(/^Bearer /);

      const payload = JSON.parse(
        Buffer.from(auth!.split(".")[1], "base64").toString()
      );
      expect(payload.sub).toBe("42");
      expect(payload.exp - payload.iat).toBe(120);
    });
  });

  describe("open proxy protection", () => {
    beforeEach(() => getServerSession.mockResolvedValue({ user: { id: "1" } }));

    it("refuses a path outside the allowlist", async () => {
      const res = await GET(req("http://localhost/api/backend/admin"), ctx(["admin"]));
      expect(res.status).toBe(404);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("refuses traversal segments", async () => {
      const res = await GET(req("http://localhost/api/backend/users/../secrets"), ctx(["users", "..", "secrets"]));
      expect(res.status).toBe(404);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("refuses the unmounted integrations router", async () => {
      const res = await GET(req("http://localhost/api/backend/integrations"), ctx(["integrations"]));
      expect(res.status).toBe(404);
    });
  });

  describe("header handling", () => {
    beforeEach(() => getServerSession.mockResolvedValue({ user: { id: "7" } }));

    it("never forwards a caller-supplied Authorization header", async () => {
      await GET(
        req("http://localhost/api/backend/users/7", {
          headers: { Authorization: "Bearer attacker-supplied" },
        }),
        ctx(["users", "7"])
      );
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect((options.headers as Headers).get("Authorization")).not.toContain("attacker-supplied");
    });

    it("never forwards cookies upstream", async () => {
      await GET(
        req("http://localhost/api/backend/users/7", { headers: { Cookie: "next-auth.session-token=abc" } }),
        ctx(["users", "7"])
      );
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect((options.headers as Headers).get("Cookie")).toBeNull();
    });
  });

  describe("forwarding", () => {
    beforeEach(() => getServerSession.mockResolvedValue({ user: { id: "5" } }));

    it("preserves the path and query string", async () => {
      await GET(
        req("http://localhost/api/backend/cohorts/3/leaderboard?view=all"),
        ctx(["cohorts", "3", "leaderboard"])
      );
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe("http://backend.internal:8001/cohorts/3/leaderboard?view=all");
    });

    it("preserves the HTTP method", async () => {
      await DELETE(req("http://localhost/api/backend/tasks/9", { method: "DELETE" }), ctx(["tasks", "9"]));
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.method).toBe("DELETE");
    });

    it("returns 502 when the backend is unreachable", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("ECONNREFUSED"));
      const res = await GET(req("http://localhost/api/backend/users/5"), ctx(["users", "5"]));
      expect(res.status).toBe(502);
    });

    it("passes a streaming body through without buffering", async () => {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('{"chunk":1}\n'));
          c.close();
        },
      });
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(stream, { status: 200, headers: { "content-type": "application/x-ndjson" } })
      );
      const res = await POST(req("http://localhost/api/backend/ai/chat", { method: "POST" }), ctx(["ai", "chat"]));
      expect(res.headers.get("content-type")).toBe("application/x-ndjson");
      expect(await res.text()).toContain('{"chunk":1}');
    });
  });

  describe("redirects", () => {
    // The backend 307s between /scorecards and /scorecards/. Next strips the
    // trailing slash before this handler runs, so the redirect has to be
    // followed here - handing it to the browser leaks the backend URL and
    // bounces off Next's normalisation for ever.
    it("follows a same-origin redirect and returns the final response", async () => {
      getServerSession.mockResolvedValue({ user: { id: "42" } });
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 307,
            headers: { location: "http://backend.internal:8001/scorecards/" },
          })
        )
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

      const res = await GET(
        req("http://localhost/api/backend/scorecards?org_id=4"),
        ctx(["scorecards"])
      );

      expect(res.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe(
        "http://backend.internal:8001/scorecards/"
      );
      expect(res.headers.get("location")).toBeNull();
    });

    it("does not follow a redirect to another origin, and never re-sends the token", async () => {
      getServerSession.mockResolvedValue({ user: { id: "42" } });
      global.fetch = jest.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.example.com/steal" },
        })
      );

      const res = await GET(
        req("http://localhost/api/backend/users/1"),
        ctx(["users", "1"])
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(502);
      expect(res.headers.get("location")).toBeNull();
    });

    it("gives up rather than looping for ever", async () => {
      getServerSession.mockResolvedValue({ user: { id: "42" } });
      global.fetch = jest.fn().mockResolvedValue(
        new Response(null, {
          status: 307,
          headers: { location: "http://backend.internal:8001/users/1/" },
        })
      );

      const res = await GET(
        req("http://localhost/api/backend/users/1"),
        ctx(["users", "1"])
      );

      expect(res.status).toBe(502);
      expect((global.fetch as jest.Mock).mock.calls.length).toBeLessThanOrEqual(5);
    });
  });

  describe("misconfiguration", () => {
    it("returns 500 when the signing secret is missing", async () => {
      getServerSession.mockResolvedValue({ user: { id: "42" } });
      const original = process.env.AUTH_SECRET_KEY;
      delete process.env.AUTH_SECRET_KEY;
      try {
        const res = await GET(req("http://localhost/api/backend/users/1"), ctx(["users", "1"]));
        expect(res.status).toBe(500);
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        process.env.AUTH_SECRET_KEY = original;
      }
    });
  });

});
