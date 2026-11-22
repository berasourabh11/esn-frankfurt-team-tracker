import { describe, expect, it } from "vitest";

import { createHttpAuthService } from "./authService";

function respond(status: number, body?: unknown) {
  return (async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    })) as unknown as typeof fetch;
}

describe("auth service", () => {
  it("returns null when nobody is signed in", async () => {
    const auth = createHttpAuthService({
      baseUrl: "https://api.test",
      fetchImpl: respond(401, { error: "Please sign in first." }),
    });
    await expect(auth.me()).resolves.toBeNull();
  });

  it("returns the signed-in member", async () => {
    const member = { id: "m1", name: "Aisha Khan", email: "a@b.example", role: "member" };
    const auth = createHttpAuthService({
      baseUrl: "https://api.test",
      fetchImpl: respond(200, member),
    });
    await expect(auth.login("a@b.example", "pw")).resolves.toEqual(member);
  });

  it("surfaces the API's sign-in error", async () => {
    const auth = createHttpAuthService({
      baseUrl: "https://api.test",
      fetchImpl: respond(401, { error: "Wrong e-mail or password." }),
    });
    await expect(auth.login("a@b.example", "nope")).rejects.toThrow("Wrong e-mail or password.");
  });
});
