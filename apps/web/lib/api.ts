export class ApiError extends Error {
  constructor(
    readonly status: number,
    message?: string,
    // Parsed JSON error body: { code, message, ...data } for coded errors.
    readonly body?: unknown,
  ) {
    super(message ?? `Request failed with status ${status}`);
  }
}

// Auth endpoints own their 401s: wrong password, dead refresh token, logout.
const NO_REFRESH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

let refreshing: Promise<boolean> | null = null;

// Single flight: parallel 401s must not rotate the same refresh token twice (reuse detection revokes all).
function refreshSession() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData needs the browser to set Content-Type itself (the multipart boundary).
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const send = () => fetch(`/api${path}`, { ...init, credentials: "include", headers });

  let res = await send();
  if (res.status === 401 && !NO_REFRESH_PATHS.includes(path) && (await refreshSession())) {
    res = await send();
  }

  if (!res.ok) throw new ApiError(res.status, undefined, await res.json().catch(() => undefined));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
