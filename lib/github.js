/**
 * GitHub REST 읽기 클라이언트.
 *
 * 이 파일은 브라우저를 모르고, 호스트 쪽에서만 쓴다. 인증은 선택 사항이라
 * 토큰이 없어도 공개 레포를 읽는다(시간당 60회). 토큰을 넣으면 5,000회.
 *
 * 엔드포인트:
 *   /users/{login}                     사용자 프로필
 *   /users/{login}/repos               개인 레포 (org 는 /orgs 로 대체)
 *   /repos/{owner}/{repo}              레포 정보
 *   /repos/{owner}/{repo}/readme       README (base64)
 *   /repos/{owner}/{repo}/commits      최근 커밋
 *   /repos/{owner}/{repo}/languages    언어 바이트
 */

const API_ROOT = "https://api.github.com";
const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const README_LIMIT = 48 * 1024;

export class GithubError extends Error {
  constructor(message, { status = 0, kind = "http", resetAt = null } = {}) {
    super(message);
    this.name = "GithubError";
    this.status = status;
    this.kind = kind;
    this.resetAt = resetAt;
  }
}

/** "@ByungHyun21", "https://github.com/ByungHyun21/" 같은 입력을 login 하나로 줄인다. */
export function normalizeLogin(raw) {
  let value = String(raw ?? "").trim();
  if (!value) return "";
  value = value.replace(/^@+/, "");
  value = value.replace(/^https?:\/\/(?:www\.)?github\.com\//i, "");
  value = value.replace(/\/+$/, "");
  value = value.split(/[/?#]/)[0];
  return LOGIN_RE.test(value) ? value : "";
}

function rateReset(headers) {
  const reset = Number(headers?.get?.("x-ratelimit-reset"));
  return Number.isFinite(reset) && reset > 0 ? reset * 1000 : null;
}

/** 한 번의 GitHub 호출. 실패는 GithubError 로 정규화한다. */
export async function githubFetch(pathOrUrl, { token = "", timeoutMs = 15000, fetchImpl = globalThis.fetch } = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${API_ROOT}${pathOrUrl}`;
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "deepseek-github-viewer",
    "x-github-api-version": "2022-11-28",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, { headers, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new GithubError("GitHub 응답이 시간 안에 오지 않았습니다.", { kind: "timeout" });
    throw new GithubError(`GitHub에 연결하지 못했습니다: ${error?.message ?? error}`, { kind: "network" });
  } finally {
    clearTimeout(timer);
  }

  const remaining = Number(response.headers?.get?.("x-ratelimit-remaining"));
  const resetAt = rateReset(response.headers);
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = String(body?.message ?? "").trim();
    } catch { /* 본문이 JSON 이 아닐 수 있다 */ }
    if (response.status === 404) throw new GithubError(detail || "GitHub에서 찾지 못했습니다.", { status: 404, kind: "not-found" });
    if ((response.status === 403 || response.status === 429) && Number.isFinite(remaining) && remaining <= 0) {
      throw new GithubError("GitHub API 호출 한도를 다 썼습니다. 잠시 뒤 다시 시도하거나 설정에 토큰을 넣어 주세요.", { status: 429, kind: "rate-limit", resetAt });
    }
    if (response.status === 401) throw new GithubError("GitHub 토큰이 유효하지 않습니다.", { status: 401, kind: "auth" });
    throw new GithubError(detail || `GitHub 요청이 실패했습니다 (${response.status}).`, { status: response.status, kind: "http", resetAt });
  }

  return { data: await response.json(), remaining, resetAt };
}

export function summarizeUser(data) {
  return {
    login: data.login ?? "",
    name: data.name ?? "",
    avatarUrl: data.avatar_url ?? "",
    bio: data.bio ?? "",
    htmlUrl: data.html_url ?? "",
    publicRepos: data.public_repos ?? 0,
    followers: data.followers ?? 0,
    type: data.type ?? "User",
  };
}

export function summarizeRepo(repo) {
  return {
    id: repo.id,
    name: repo.name ?? "",
    fullName: repo.full_name ?? "",
    owner: repo.owner?.login ?? "",
    ownerAvatar: repo.owner?.avatar_url ?? "",
    description: repo.description ?? "",
    htmlUrl: repo.html_url ?? "",
    homepage: repo.homepage ?? "",
    language: repo.language ?? "",
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    watchers: repo.watchers_count ?? 0,
    pushedAt: repo.pushed_at ?? "",
    updatedAt: repo.updated_at ?? "",
    createdAt: repo.created_at ?? "",
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    license: repo.license?.spdx_id ?? "",
    archived: Boolean(repo.archived),
    fork: Boolean(repo.fork),
    visibility: repo.visibility ?? (repo.private ? "private" : "public"),
    defaultBranch: repo.default_branch ?? "main",
    sizeKb: repo.size ?? 0,
    cloneUrl: repo.clone_url ?? "",
    sshUrl: repo.ssh_url ?? "",
  };
}

export async function fetchUserProfile(login, options = {}) {
  const { data } = await githubFetch(`/users/${encodeURIComponent(login)}`, options);
  return summarizeUser(data);
}

/**
 * 공개 레포 목록. `/users/{login}/repos` 가 비어 있거나 404 면 조직으로 한 번 더 본다.
 * `max` 개까지만, 최근 푸시 순서로 가져온다.
 */
export async function fetchUserRepos(login, { max = 200, ...options } = {}) {
  const limit = Math.max(1, Math.min(300, Number(max) || 200));
  const pages = Math.ceil(limit / 100);
  const collected = [];

  for (let page = 1; page <= pages; page += 1) {
    const params = `per_page=100&page=${page}&sort=pushed&direction=desc`;
    let batch;
    try {
      batch = (await githubFetch(`/users/${encodeURIComponent(login)}/repos?${params}&type=owner`, options)).data;
    } catch (error) {
      if (page === 1 && error.kind === "not-found") {
        batch = await fetchOrgRepos(login, page, options);
      } else {
        throw error;
      }
    }
    if (!Array.isArray(batch)) throw new GithubError("GitHub 레포 응답 형식이 예상과 다릅니다.", { kind: "protocol" });
    if (page === 1 && batch.length === 0) {
      const orgBatch = await fetchOrgRepos(login, page, options).catch(() => []);
      if (Array.isArray(orgBatch) && orgBatch.length > 0) batch = orgBatch;
    }
    for (const repo of batch) {
      const summary = summarizeRepo(repo);
      if (!collected.some((existing) => existing.id === summary.id)) collected.push(summary);
    }
    if (batch.length < 100 || collected.length >= limit) break;
  }

  return collected.slice(0, limit);
}

async function fetchOrgRepos(login, page, options) {
  const params = `per_page=100&page=${page}&sort=pushed&direction=desc`;
  const { data } = await githubFetch(`/orgs/${encodeURIComponent(login)}/repos?${params}&type=public`, options);
  return Array.isArray(data) ? data : [];
}

function decodeReadme(payload) {
  if (!payload || typeof payload.content !== "string" || payload.content.trim() === "") return null;
  let text = "";
  try {
    text = Buffer.from(payload.content.replace(/\s+/g, ""), "base64").toString("utf8");
  } catch {
    return null;
  }
  const truncated = text.length > README_LIMIT;
  return {
    name: payload.name ?? "README",
    path: payload.path ?? "",
    htmlUrl: payload.html_url ?? "",
    text: truncated ? text.slice(0, README_LIMIT) : text,
    truncated,
  };
}

function summarizeCommit(commit) {
  const message = String(commit?.commit?.message ?? "").split("\n")[0].trim();
  return {
    sha: String(commit?.sha ?? "").slice(0, 7),
    fullSha: commit?.sha ?? "",
    message,
    author: commit?.author?.login ?? commit?.commit?.author?.name ?? "",
    avatarUrl: commit?.author?.avatar_url ?? "",
    date: commit?.commit?.author?.date ?? commit?.commit?.committer?.date ?? "",
    htmlUrl: commit?.html_url ?? "",
  };
}

/** 레포 하나의 정보 + README + 최근 커밋 + 언어. 개별 실패는 빈 값으로 낮춘다. */
export async function fetchRepoDetail(owner, name, options = {}) {
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const [repoResult, readmeResult, commitsResult, languagesResult] = await Promise.all([
    githubFetch(base, options),
    githubFetch(`${base}/readme`, options).catch(() => null),
    githubFetch(`${base}/commits?per_page=6`, options).catch(() => null),
    githubFetch(`${base}/languages`, options).catch(() => null),
  ]);

  const commits = Array.isArray(commitsResult?.data) ? commitsResult.data.map(summarizeCommit) : [];
  const languages = languagesResult?.data && typeof languagesResult.data === "object" ? languagesResult.data : {};
  return {
    repo: summarizeRepo(repoResult.data),
    readme: decodeReadme(readmeResult?.data),
    commits,
    languages,
  };
}
