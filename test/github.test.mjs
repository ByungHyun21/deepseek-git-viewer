import test from "node:test";
import assert from "node:assert/strict";
import {
  GithubError,
  fetchRepoDetail,
  fetchUserProfile,
  fetchUserRepos,
  githubFetch,
  normalizeLogin,
  summarizeRepo,
  summarizeUser,
} from "../lib/github.js";

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function sampleRepo(overrides = {}) {
  return {
    id: 1,
    name: "deepseek-comfy-library",
    full_name: "ByungHyun21/deepseek-comfy-library",
    owner: { login: "ByungHyun21", avatar_url: "https://avatars.example/u/1" },
    description: "ComfyUI gallery for DSH",
    html_url: "https://github.com/ByungHyun21/deepseek-comfy-library",
    homepage: "",
    language: "JavaScript",
    stargazers_count: 12,
    forks_count: 3,
    open_issues_count: 1,
    watchers_count: 12,
    pushed_at: "2026-11-06T12:00:00Z",
    updated_at: "2026-11-06T12:00:00Z",
    created_at: "2026-10-01T12:00:00Z",
    topics: ["dsh-plugin", "comfyui"],
    license: { spdx_id: "MIT" },
    archived: false,
    fork: false,
    visibility: "public",
    default_branch: "main",
    size: 120,
    clone_url: "https://github.com/ByungHyun21/deepseek-comfy-library.git",
    ssh_url: "git@github.com:ByungHyun21/deepseek-comfy-library.git",
    ...overrides,
  };
}

test("normalizeLogin accepts @, URLs, and plain logins", () => {
  assert.equal(normalizeLogin("@ByungHyun21"), "ByungHyun21");
  assert.equal(normalizeLogin("https://github.com/ByungHyun21/"), "ByungHyun21");
  assert.equal(normalizeLogin("https://github.com/ByungHyun21/deepseek-comfy-library"), "ByungHyun21");
  assert.equal(normalizeLogin("  octo-org  "), "octo-org");
  assert.equal(normalizeLogin(""), "");
  assert.equal(normalizeLogin("bad login"), "");
  assert.equal(normalizeLogin("under_score"), "");
  assert.equal(normalizeLogin("a".repeat(40)), "");
});

test("summarizeRepo keeps card fields", () => {
  const repo = summarizeRepo(sampleRepo());
  assert.equal(repo.fullName, "ByungHyun21/deepseek-comfy-library");
  assert.equal(repo.owner, "ByungHyun21");
  assert.deepEqual(repo.topics, ["dsh-plugin", "comfyui"]);
  assert.equal(repo.license, "MIT");
  assert.equal(repo.stars, 12);
  assert.equal(repo.fork, false);
  assert.equal(repo.defaultBranch, "main");
});

test("summarizeUser keeps profile fields", () => {
  const user = summarizeUser({ login: "ByungHyun21", name: "ByungHyun", avatar_url: "a", html_url: "h", public_repos: 5, followers: 2 });
  assert.equal(user.login, "ByungHyun21");
  assert.equal(user.name, "ByungHyun");
  assert.equal(user.publicRepos, 5);
});

test("githubFetch adds token and maps 404", async () => {
  let seen;
  const fetchImpl = async (url, options) => {
    seen = { url, options };
    return jsonResponse({ message: "Not Found" }, { status: 404 });
  };
  await assert.rejects(
    githubFetch("/users/nobody", { token: "t0ken", fetchImpl }),
    (error) => error instanceof GithubError && error.kind === "not-found" && error.status === 404,
  );
  assert.equal(seen.options.headers.authorization, "Bearer t0ken");
  assert.equal(seen.url, "https://api.github.com/users/nobody");
});

test("githubFetch reports exhausted rate limit with reset time", async () => {
  const fetchImpl = async () => jsonResponse({ message: "API rate limit exceeded" }, {
    status: 403,
    headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" },
  });
  await assert.rejects(
    githubFetch("/users/x", { fetchImpl }),
    (error) => error.kind === "rate-limit" && error.status === 429 && error.resetAt === 1800000000000,
  );
});

test("fetchUserRepos paginates and dedupes", async () => {
  const first = Array.from({ length: 100 }, (_, i) => sampleRepo({ id: i + 1, name: `repo-${i + 1}`, full_name: `o/repo-${i + 1}` }));
  const second = [sampleRepo({ id: 101, name: "repo-101", full_name: "o/repo-101" }), sampleRepo({ id: 1, name: "repo-1", full_name: "o/repo-1" })];
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("&page=1&")) return jsonResponse(first);
    if (url.includes("&page=2&")) return jsonResponse(second);
    return jsonResponse([]);
  };
  const repos = await fetchUserRepos("octo", { fetchImpl, max: 200 });
  assert.equal(repos.length, 101);
  assert.ok(calls.every((url) => url.includes("/users/octo/repos")));
  assert.ok(calls.some((url) => url.includes("sort=pushed")));
});

test("fetchUserRepos falls back to organizations", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/users/octo-org/repos")) return jsonResponse({ message: "Not Found" }, { status: 404 });
    if (url.includes("/orgs/octo-org/repos")) return jsonResponse([sampleRepo({ owner: { login: "octo-org" }, full_name: "octo-org/kit" })]);
    return jsonResponse([]);
  };
  const repos = await fetchUserRepos("octo-org", { fetchImpl, max: 100 });
  assert.equal(repos.length, 1);
  assert.equal(repos[0].owner, "octo-org");
});

test("fetchUserRepos returns empty when neither user nor org exists", async () => {
  const fetchImpl = async () => jsonResponse({ message: "Not Found" }, { status: 404 });
  await assert.rejects(fetchUserRepos("ghost", { fetchImpl }), (error) => error.kind === "not-found");
});

test("fetchRepoDetail decodes README and maps commits and languages", async () => {
  const readme = "# Hello\n\nA test repository.";
  const fetchImpl = async (url) => {
    if (url.endsWith("/readme")) {
      return jsonResponse({ name: "README.md", path: "README.md", content: Buffer.from(readme).toString("base64"), html_url: "https://github.com/o/r/blob/main/README.md" });
    }
    if (url.includes("/commits")) {
      return jsonResponse([{ sha: "abcdef1234567", commit: { message: "feat: init\n\nbody", author: { name: "ByungHyun", date: "2026-11-01T00:00:00Z" } }, author: { login: "ByungHyun21", avatar_url: "a" }, html_url: "https://github.com/o/r/commit/abcdef1" }]);
    }
    if (url.endsWith("/languages")) return jsonResponse({ JavaScript: 1200, CSS: 300 });
    return jsonResponse(sampleRepo());
  };
  const detail = await fetchRepoDetail("ByungHyun21", "deepseek-comfy-library", { fetchImpl });
  assert.equal(detail.repo.fullName, "ByungHyun21/deepseek-comfy-library");
  assert.equal(detail.readme.text, readme);
  assert.equal(detail.readme.truncated, false);
  assert.equal(detail.commits[0].sha, "abcdef1");
  assert.equal(detail.commits[0].message, "feat: init");
  assert.equal(detail.commits[0].author, "ByungHyun21");
  assert.deepEqual(detail.languages, { JavaScript: 1200, CSS: 300 });
});

test("fetchRepoDetail tolerates a missing README", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/readme") || url.includes("/commits") || url.endsWith("/languages")) {
      return jsonResponse({ message: "Not Found" }, { status: 404 });
    }
    return jsonResponse(sampleRepo());
  };
  const detail = await fetchRepoDetail("o", "r", { fetchImpl });
  assert.equal(detail.readme, null);
  assert.deepEqual(detail.commits, []);
  assert.deepEqual(detail.languages, {});
});

test("README content is truncated for the panel", async () => {
  const huge = "x".repeat(60 * 1024);
  const fetchImpl = async (url) => {
    if (url.endsWith("/readme")) return jsonResponse({ content: Buffer.from(huge).toString("base64") });
    if (url.includes("/commits") || url.endsWith("/languages")) return jsonResponse([]);
    return jsonResponse(sampleRepo());
  };
  const detail = await fetchRepoDetail("o", "r", { fetchImpl });
  assert.equal(detail.readme.truncated, true);
  assert.ok(detail.readme.text.length <= 48 * 1024);
});
