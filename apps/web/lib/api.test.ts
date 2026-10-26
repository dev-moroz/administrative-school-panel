import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";

function stubFetch() {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const sentHeaders = (fetchMock: ReturnType<typeof stubFetch>) =>
  new Headers((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers);

describe("apiFetch content type", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends application/json by default", async () => {
    const fetchMock = stubFetch();
    await apiFetch("/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(sentHeaders(fetchMock).get("Content-Type")).toBe("application/json");
  });

  it("leaves Content-Type unset for FormData so the browser adds the multipart boundary", async () => {
    const fetchMock = stubFetch();
    const body = new FormData();
    body.set("file", new File(["x"], "a.png", { type: "image/png" }));
    await apiFetch("/x", { method: "POST", body });
    expect(sentHeaders(fetchMock).has("Content-Type")).toBe(false);
  });
});
