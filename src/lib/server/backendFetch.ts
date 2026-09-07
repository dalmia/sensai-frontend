import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { mintBackendToken } from "./backendToken";

/**
 * Call the backend from a server component or route handler.
 *
 * Server-side code cannot go through /api/backend (that proxy exists for the
 * browser), so it mints its own short-lived token from the current session.
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = process.env.BACKEND_URL;
  if (!baseUrl) {
    throw new Error("BACKEND_URL is not set");
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const headers = new Headers(init.headers);
  if (userId) {
    headers.set("Authorization", `Bearer ${mintBackendToken(userId, session?.user?.email ?? "")}`);
  }

  return fetch(`${baseUrl}${path}`, { ...init, headers });
}
