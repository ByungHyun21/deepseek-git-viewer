/**
 * deepseek-github-viewer — 호스트 반쪽.
 *
 * 관심 GitHub 사용자의 공개 레포를 읽어 `/github/api/*` 로 내어준다.
 * 화면(lib/client.js)은 카드 갤러리와 README 뷰어이고, 이 파일은 GitHub 만 안다.
 * 쓰기 동작은 없다 — 레포 생성·PR·이슈는 GitHub 링크로 넘긴다.
 */

import z from "@deepseek-ai/schemastery";
import {
  GithubError,
  fetchRepoDetail,
  fetchUserProfile,
  fetchUserRepos,
  normalizeLogin,
} from "../lib/github.js";

export const name = "deepseek-github-viewer";
export const inject = ["webServer"];

export const Config = z.object({
  /** 카드로 훑을 GitHub 사용자(개인 또는 조직) 로그인 목록. */
  users: z.array(z.string()).default(["ByungHyun21"]).volatile(),
  /** 선택 사항. 있으면 비공개 레포와 시간당 5,000회 한도를 쓴다. */
  token: z.string().default("").volatile(),
  /** GitHub 왕복 상한 (ms). */
  timeoutMs: z.natural().min(1000).max(60000).default(15000).volatile(),
  /** 같은 응답을 다시 쓸 시간 (분). 0 이면 매번 새로 읽는다. */
  cacheMinutes: z.natural().min(0).max(120).default(10).volatile(),
});

const ROUTE = "/github";
const MAX_BODY = 64 * 1024;
const PROFILE_TTL_MS = 30 * 60_000;

class ValidationError extends Error {}

function readField(field, fallback) {
  const raw = field && typeof field.get === "function" ? field.get() : field;
  return raw === undefined || raw === null || raw === "" ? fallback : raw;
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    "cache-control": "no-store",
  });
  res.end(text);
}

function readJson(req, limitBytes = MAX_BODY) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function statusFor(error) {
  if (error instanceof ValidationError) return 400;
  if (error instanceof GithubError) {
    if (error.kind === "not-found") return 404;
    if (error.kind === "rate-limit") return 429;
    if (error.kind === "auth") return 401;
    if (error.kind === "timeout") return 504;
    return 502;
  }
  return 502;
}

function errorBody(error) {
  const body = { error: error?.message ?? String(error) };
  if (error instanceof GithubError) {
    body.kind = error.kind;
    if (error.resetAt) body.resetAt = error.resetAt;
  }
  return body;
}

export function apply(ctx, config) {
  const readConfig = () => {
    const usersField = config.users;
    const rawUsers = usersField && typeof usersField.get === "function" ? usersField.get() : usersField;
    const list = Array.isArray(rawUsers) ? rawUsers : [];
    const users = [];
    for (const entry of list) {
      const login = normalizeLogin(entry);
      if (login && !users.includes(login)) users.push(login);
    }
    return { users, token: String(readField(config.token, "")), timeoutMs: Number(readField(config.timeoutMs, 15000)) || 15000, cacheMinutes: Number(readField(config.cacheMinutes, 10)) || 0 };
  };

  const cache = new Map();
  const cacheKey = (kind, key, auth) => `${kind}:${key}:${auth}`;
  const readCache = (key, ttlMs) => {
    const hit = cache.get(key);
    if (!hit) return null;
    if (ttlMs <= 0 || Date.now() - hit.at > ttlMs) {
      cache.delete(key);
      return null;
    }
    return hit;
  };
  const writeCache = (key, value) => {
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 200) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    return value;
  };
  const clearCache = (prefix) => {
    for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
  };

  const options = () => {
    const { token, timeoutMs } = readConfig();
    return { token, timeoutMs };
  };

  const profileFor = async (login) => {
    const { token } = readConfig();
    const key = cacheKey("profile", login, token ? "auth" : "anon");
    const hit = readCache(key, PROFILE_TTL_MS);
    if (hit) return { profile: hit.value, cachedAt: hit.at };
    const profile = await fetchUserProfile(login, options());
    writeCache(key, profile);
    return { profile, cachedAt: Date.now() };
  };

  const reposFor = async (login) => {
    const { token, cacheMinutes } = readConfig();
    const key = cacheKey("repos", login, token ? "auth" : "anon");
    const hit = readCache(key, cacheMinutes * 60_000);
    if (hit) return { repos: hit.value, cachedAt: hit.at };
    const repos = await fetchUserRepos(login, { ...options(), max: 200 });
    writeCache(key, repos);
    return { repos, cachedAt: Date.now() };
  };

  const detailFor = async (owner, name) => {
    const { token, cacheMinutes } = readConfig();
    const key = cacheKey("repo", `${owner}/${name}`, token ? "auth" : "anon");
    const hit = readCache(key, Math.max(cacheMinutes, 5) * 60_000);
    if (hit) return { ...hit.value, cachedAt: hit.at };
    const detail = await fetchRepoDetail(owner, name, options());
    writeCache(key, detail);
    return { ...detail, cachedAt: Date.now() };
  };

  const handler = async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const suffix = url.pathname.slice(ROUTE.length) || "/";
    const { users, token, cacheMinutes } = readConfig();

    if (req.method === "GET" && suffix === "/api/config") {
      return sendJson(res, 200, { users, tokenSet: Boolean(token), cacheMinutes });
    }

    if (req.method === "GET" && suffix === "/api/users") {
      const results = [];
      for (const login of users) {
        try {
          const { profile, cachedAt } = await profileFor(login);
          results.push({ login, profile, cachedAt, error: null });
        } catch (error) {
          results.push({ login, profile: null, cachedAt: null, error: errorBody(error) });
        }
      }
      return sendJson(res, 200, { users: results });
    }

    if (req.method === "GET" && suffix === "/api/repos") {
      const login = normalizeLogin(url.searchParams.get("user") ?? "");
      if (!login) throw new ValidationError("GitHub 사용자 로그인이 필요합니다.");
      const { repos, cachedAt } = await reposFor(login);
      return sendJson(res, 200, { user: login, total: repos.length, repos, cachedAt });
    }

    if (req.method === "GET" && suffix === "/api/repo") {
      const owner = normalizeLogin(url.searchParams.get("owner") ?? "");
      const name = String(url.searchParams.get("name") ?? "").trim();
      if (!owner || !name) throw new ValidationError("레포 owner 와 name 이 필요합니다.");
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(name)) throw new ValidationError("레포 이름 형식이 올바르지 않습니다.");
      const detail = await detailFor(owner, name);
      return sendJson(res, 200, detail);
    }

    if (req.method === "POST" && suffix === "/api/refresh") {
      const body = await readJson(req);
      if (!body) throw new ValidationError("요청 본문을 읽지 못했습니다.");
      const login = normalizeLogin(body.user ?? "");
      const owner = normalizeLogin(body.owner ?? "");
      const repo = String(body.name ?? "").trim();
      if (login) clearCache(`repos:${login}:`);
      if (owner && repo) clearCache(`repo:${owner}/${repo}:`);
      return sendJson(res, 200, { cleared: true });
    }

    return sendJson(res, 404, { error: "not-found" });
  };

  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: ROUTE,
    handler: async (req, res) => {
      try {
        await handler(req, res);
      } catch (error) {
        sendJson(res, statusFor(error), errorBody(error));
      }
    },
  }), `${name}: api`);

  /** 에이전트 도구: 화면과 같은 함수를 공유한다. */
  const tools = ctx.get("tools");
  if (tools) {
    const renderText = (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }];
    const register = (definition) => ctx.effect(() => tools.register(definition), `${name}: tool ${definition.name}`);

    register({
      name: "github_repos",
      description: "List public GitHub repositories for the users this plugin watches, or for one GitHub login. Read-only: it never writes to GitHub. Returns name, description, language, stars, forks, topics, pushed time, and the repository URL.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          user: { type: "string", description: "GitHub login (user or organization). Omit to list every watched user." },
          query: { type: "string", description: "Case-insensitive text matched against repository name, description, language, and topics." },
          sort: { type: "string", enum: ["pushed", "stars", "name"], description: "Ordering. Default: pushed (most recently pushed first)." },
          limit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum repositories to return. Default 30." },
        },
      },
      output: { schema: { type: "object" }, render: renderText },
      async execute(args) {
        const { users } = readConfig();
        const logins = args.user ? [normalizeLogin(args.user)] : users;
        if (logins.length === 0) throw new ValidationError("감시 중인 GitHub 사용자가 없습니다. 설정에서 사용자를 추가하세요.");
        if (logins.some((login) => !login)) throw new ValidationError("GitHub 로그인 형식이 올바르지 않습니다.");
        const collected = [];
        for (const login of logins) {
          const { repos } = await reposFor(login);
          collected.push(...repos.map((repo) => ({ ...repo, watchedUser: login })));
        }
        const query = String(args.query ?? "").trim().toLowerCase();
        let repos = query
          ? collected.filter((repo) => [repo.name, repo.description, repo.language, ...repo.topics].join(" ").toLowerCase().includes(query))
          : collected;
        const sort = args.sort ?? "pushed";
        repos = [...repos].sort((a, b) => {
          if (sort === "stars") return b.stars - a.stars || a.name.localeCompare(b.name);
          if (sort === "name") return a.name.localeCompare(b.name);
          return String(b.pushedAt).localeCompare(String(a.pushedAt));
        });
        const limit = Math.max(1, Math.min(100, Number(args.limit) || 30));
        return { users: logins, total: repos.length, repos: repos.slice(0, limit) };
      },
    });

    register({
      name: "github_repo",
      description: "Read one public GitHub repository: metadata, README text, the six most recent commits, and language bytes. Accepts owner/name or separate owner and name. Read-only.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repository as owner/name, e.g. ByungHyun21/deepseek-comfy-library." },
          owner: { type: "string", description: "Repository owner login; use together with name instead of repo." },
          name: { type: "string", description: "Repository name; use together with owner instead of repo." },
        },
      },
      output: { schema: { type: "object" }, render: renderText },
      async execute(args) {
        let owner = normalizeLogin(args.owner ?? "");
        let repoName = String(args.name ?? "").trim();
        if (typeof args.repo === "string" && args.repo.trim()) {
          const parts = args.repo.trim().split("/");
          owner = normalizeLogin(parts[0] ?? "");
          repoName = (parts[1] ?? "").trim();
        }
        if (!owner || !repoName) throw new ValidationError("repo 를 owner/name 형식으로 주세요.");
        const detail = await detailFor(owner, repoName);
        return {
          ...detail,
          readme: detail.readme ? { ...detail.readme, text: detail.readme.text.slice(0, 12000), truncated: detail.readme.truncated || detail.readme.text.length > 12000 } : null,
        };
      },
    });
  }
}
