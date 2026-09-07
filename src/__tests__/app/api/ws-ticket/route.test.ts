/**
 * @jest-environment node
 */
import { createHmac } from "crypto";

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: () => mockGetServerSession() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }));

import { GET } from "@/app/api/ws-ticket/route";
import { NextRequest } from "next/server";

const SECRET = "test-ws-secret";

function call(url: string) {
  return GET(new NextRequest(url));
}

function decode(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString());
}

describe("ws-ticket route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SECRET_KEY = SECRET;
    mockGetServerSession.mockResolvedValue({ user: { id: "42", email: "a@b.c" } });
  });

  it("rejects an unauthenticated caller", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await call("http://localhost:3000/api/ws-ticket?courseId=7");
    expect(res.status).toBe(401);
  });

  it("rejects a missing or non-numeric courseId", async () => {
    expect((await call("http://localhost:3000/api/ws-ticket")).status).toBe(400);
    expect((await call("http://localhost:3000/api/ws-ticket?courseId=abc")).status).toBe(400);
  });

  it("mints a ticket bound to the user, course and ws audience", async () => {
    const res = await call("http://localhost:3000/api/ws-ticket?courseId=7");
    expect(res.status).toBe(200);

    const { ticket } = await res.json();
    const [, payload] = ticket.split(".");
    const claims = decode(payload);

    expect(claims.sub).toBe("42");
    expect(claims.course_id).toBe(7);
    expect(claims.aud).toBe("ws");
    expect(claims.exp - claims.iat).toBe(30);
  });

  it("signs the ticket with AUTH_SECRET_KEY", async () => {
    const res = await call("http://localhost:3000/api/ws-ticket?courseId=7");
    const { ticket } = await res.json();
    const [header, payload, signature] = ticket.split(".");

    const expected = createHmac("sha256", SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");

    expect(signature).toBe(expected);
  });

  it("fails closed when the secret is missing", async () => {
    delete process.env.AUTH_SECRET_KEY;
    const res = await call("http://localhost:3000/api/ws-ticket?courseId=7");
    expect(res.status).toBe(500);
  });

  it("reports an empty origin so the client stays same-origin", async () => {
    delete process.env.WS_PUBLIC_ORIGIN;
    const res = await call("http://localhost:3000/api/ws-ticket?courseId=7");
    expect((await res.json()).origin).toBe("");
  });
});
