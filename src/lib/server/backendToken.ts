import { createHmac } from "crypto";

const TOKEN_TTL_SECONDS = 120;
const WS_TICKET_TTL_SECONDS = 30;

// The backend rejects anything shorter, so fail here where the cause is visible
// rather than turning every request into a 500.
const MIN_SECRET_LENGTH = 32;

function requireSecret(): string {
  const secret = process.env.AUTH_SECRET_KEY;
  if (!secret) {
    throw new Error("AUTH_SECRET_KEY is not set");
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET_KEY must be at least ${MIN_SECRET_LENGTH} characters`
    );
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function mintBackendToken(userId: string | number, email = ""): string {
  const secret = requireSecret();

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: String(userId),
      email,
      aud: "api",
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    })
  );

  const signature = base64url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest()
  );

  return `${header}.${payload}.${signature}`;
}

export function mintWsTicket(userId: string | number, courseId: number): string {
  const secret = requireSecret();

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: String(userId),
      aud: "ws",
      course_id: courseId,
      iat: now,
      exp: now + WS_TICKET_TTL_SECONDS,
    })
  );

  const signature = base64url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest()
  );

  return `${header}.${payload}.${signature}`;
}
