import { createClient } from "@supabase/supabase-js";
export const cloudConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
export const supabase = cloudConfigured
  ? createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    )
  : null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public current?: unknown,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  action: string,
  payload: unknown = {},
  kiosk?: string,
): Promise<T> {
  const session = await supabase?.auth.getSession();
  const token = kiosk || session?.data.session?.access_token;
  if (!token) throw new ApiError("Please sign in again to continue.", 401);
  const res = await fetch("/api/app", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({
    error:
      "The account could not be reached. Your pending entries are safe on this device.",
  }));
  if (!res.ok)
    throw new ApiError(
      body.error || "The change could not be saved.",
      res.status,
      body.current,
    );
  return body;
}
