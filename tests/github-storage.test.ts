import assert from "node:assert/strict";
import test from "node:test";
import { storeBytes } from "../src/lib/github-storage";

test("GitHub storage failure returns an inline artifact with a visible warning", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_MEDIA_TOKEN;
  const originalRepo = process.env.GITHUB_MEDIA_REPO;
  const originalError = console.error;

  process.env.GITHUB_MEDIA_TOKEN = "test-token";
  process.env.GITHUB_MEDIA_REPO = "TS-mfon/xlayer-estate-media";
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  console.error = () => undefined;

  try {
    const stored = await storeBytes("assets/test.webp", Buffer.from("asset-bytes"), "image/webp");

    assert.equal(stored.storage, "data");
    assert.match(stored.uri, /^data:image\/webp;base64,/);
    assert.match(stored.warning ?? "", /GitHub media storage failed \(503\)/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (originalToken === undefined) delete process.env.GITHUB_MEDIA_TOKEN;
    else process.env.GITHUB_MEDIA_TOKEN = originalToken;
    if (originalRepo === undefined) delete process.env.GITHUB_MEDIA_REPO;
    else process.env.GITHUB_MEDIA_REPO = originalRepo;
  }
});
