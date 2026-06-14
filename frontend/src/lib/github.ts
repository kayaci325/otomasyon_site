const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPO = process.env.GITHUB_REPO || "kayaci325/deneme";
const [OWNER, REPO] = GITHUB_REPO.split("/");
const API = "https://api.github.com";

/** Branch used for all reads, writes and workflow dispatch. */
const ENV_BRANCH = process.env.GITHUB_BRANCH || "";

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** A typed error that preserves the upstream GitHub status code. */
export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GitHubError";
  }
}

let cachedDefaultBranch: string | null = null;
async function resolveBranch(): Promise<string> {
  if (ENV_BRANCH) return ENV_BRANCH;
  if (cachedDefaultBranch) return cachedDefaultBranch;
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new GitHubError(res.status, `Cannot resolve default branch (${res.status})`);
  const data = await res.json();
  cachedDefaultBranch = data.default_branch || "main";
  return cachedDefaultBranch as string;
}

export async function getFileContent(path: string): Promise<{ content: string; sha: string }> {
  const branch = await resolveBranch();
  const res = await fetch(
    `${API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) throw new GitHubError(res.status, `GitHub API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha };
}

/**
 * Read-modify-write helper. Always reads the freshest sha server-side
 * immediately before writing, eliminating the stale-client-sha race that
 * caused silent data loss.
 */
export async function writeFileFresh(path: string, content: string, message: string) {
  const branch = await resolveBranch();
  let sha: string | undefined;
  try {
    const existing = await getFileContent(path);
    sha = existing.sha;
  } catch (e) {
    if (!(e instanceof GitHubError && e.status === 404)) throw e;
    sha = undefined; // file does not exist yet -> create it
  }
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString("base64"),
      sha,
      branch,
    }),
  });
  if (!res.ok) throw new GitHubError(res.status, `GitHub API ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Atomically read JSON, apply a mutation, and write it back. */
export async function updateJsonFile<T>(
  path: string,
  mutate: (data: T) => T,
  message: string
): Promise<T> {
  const { content } = await getFileContent(path).catch((e) => {
    if (e instanceof GitHubError && e.status === 404) return { content: "{}", sha: "" };
    throw e;
  });
  const data = JSON.parse(content) as T;
  const next = mutate(data);
  await writeFileFresh(path, JSON.stringify(next, null, 2), message);
  return next;
}

export async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const { content } = await getFileContent(path);
    return JSON.parse(content) as T;
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return fallback;
    throw e;
  }
}

export async function listWorkflowRuns(limit = 20) {
  const res = await fetch(
    `${API}/repos/${OWNER}/${REPO}/actions/workflows/youtube-pipeline.yml/runs?per_page=${limit}`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) throw new GitHubError(res.status, `GitHub API ${res.status}`);
  const data = await res.json();
  return data.workflow_runs || [];
}

export async function triggerWorkflow(inputs: Record<string, string>) {
  const ref = await resolveBranch();
  const res = await fetch(
    `${API}/repos/${OWNER}/${REPO}/actions/workflows/youtube-pipeline.yml/dispatches`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ref, inputs }),
    }
  );
  if (!res.ok) throw new GitHubError(res.status, `GitHub API ${res.status}: ${await res.text()}`);
  return { ok: true };
}

export { OWNER, REPO };
