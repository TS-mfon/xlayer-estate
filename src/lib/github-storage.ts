import { createHash } from "node:crypto";

interface StoredObject { uri: string; storage: "github" | "data"; sha256: string; warning?: string }

const githubHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

function config() {
  const token = process.env.GITHUB_MEDIA_TOKEN;
  const repo = process.env.GITHUB_MEDIA_REPO ?? "TS-mfon/xlayer-estate-media";
  const branch = process.env.GITHUB_MEDIA_BRANCH ?? "main";
  return token ? { token, repo, branch } : null;
}

export async function storeBytes(path: string, bytes: Buffer, contentType: string): Promise<StoredObject> {
  const digest = createHash("sha256").update(bytes).digest("hex");
  const github = config();
  if (!github) return { uri: `data:${contentType};base64,${bytes.toString("base64")}`, storage: "data", sha256: digest };
  try {
    const endpoint = `https://api.github.com/repos/${github.repo}/contents/${path}`;
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { ...githubHeaders(github.token), "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Store XLayer Estate artifact ${digest.slice(0, 12)}`, content: bytes.toString("base64"), branch: github.branch }),
    });
    if (!response.ok && response.status !== 422) throw new Error(`GitHub media storage failed (${response.status})`);
    const data = await response.json() as { commit?: { sha?: string } };
    let commitSha = data.commit?.sha;
    if (!commitSha) {
      const existing = await fetch(`${endpoint}?ref=${github.branch}`, { headers: githubHeaders(github.token) });
      const current = await existing.json() as { content?: string; encoding?: string };
      if (!existing.ok || current.encoding !== "base64" || !current.content) throw new Error("Stored artifact could not be resolved");
      const existingDigest = createHash("sha256").update(Buffer.from(current.content.replace(/\n/g, ""), "base64")).digest("hex");
      if (existingDigest !== digest) throw new Error("Immutable media path already contains different content");
      const commits = await fetch(`https://api.github.com/repos/${github.repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(github.branch)}&per_page=1`, { headers: githubHeaders(github.token) });
      const history = await commits.json() as Array<{ sha?: string }>;
      commitSha = history[0]?.sha;
      if (!commits.ok || !commitSha) throw new Error("Stored artifact commit could not be resolved");
    }
    return { uri: `https://raw.githubusercontent.com/${github.repo}/${commitSha}/${path}`, storage: "github", sha256: digest };
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub media storage failed";
    console.error("media storage fallback", message);
    return { uri: `data:${contentType};base64,${bytes.toString("base64")}`, storage: "data", sha256: digest, warning: `${message}. Compact inline storage was used instead.` };
  }
}

export async function storeJson(path: string, value: unknown) {
  return storeBytes(path, Buffer.from(JSON.stringify(value, null, 2)), "application/json");
}
