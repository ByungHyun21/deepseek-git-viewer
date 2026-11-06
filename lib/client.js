/**
 * deepseek-github-viewer — 화면 반쪽.
 *
 * 좌석 두 개:
 *  - `sidebar.panellist` : "깃헙 레포" 아이콘 (생성 갤러리 다음).
 *  - `main` (keyed)      : 관심 사용자의 레포 카드 갤러리와 README 뷰어.
 *  - `plugins.row.config`: 감시할 GitHub 사용자와 선택 토큰 설정.
 *
 * 데이터는 호스트의 `/github/api/*` 에서 온다. 읽기 전용이고, 쓰기 동작은
 * GitHub 링크로 넘긴다.
 */

window.__ModuleLoader__.load({ id: "deepseek-github-viewer", factory: (require) => {
const module = { exports: {} }; const exports = module.exports;

const React = require("react");
const h = React.createElement;
const { useState, useEffect, useMemo } = React;

const PLUGIN = "deepseek-github-viewer";
const ENTRY_ID = "deepseek-github-viewer";
const API = "/github/api";
const PANEL_ID = `${PLUGIN}.repos`;
const STYLE_ID = "dsgh-style";

function isKo() {
  try {
    const lang = String(document.documentElement?.lang || "").toLowerCase();
    if (lang) return lang.startsWith("ko");
    return String(navigator.language || "").toLowerCase().startsWith("ko");
  } catch {
    return true;
  }
}
const t = (ko, en) => (isKo() ? ko : en);

const CSS = [
  "body.dsgh-noscroll{overflow:hidden}",
  ".dsgh-page{width:100%;min-width:0;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6;display:flex;overflow:hidden}",
  ".dsgh-scroll{scrollbar-gutter:stable;flex:1;min-height:0;overflow:auto}",
  ".dsgh-content{max-width:1180px;margin:0 auto;padding:0 clamp(20px,3vw,40px) 56px}",
  ".dsgh-heading{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;padding-top:28px}",
  "[data-platform=darwin] .dsgh-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}",
  ".dsgh-h1{margin:0;font-size:20px;font-weight:500;line-height:28px}",
  ".dsgh-intro{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}",
  ".dsgh-headActions{display:flex;align-items:center;gap:8px;flex:none}",
  ".dsgh-chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}",
  ".dsgh-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-success-primary);flex:none}",
  ".dsgh-btn{box-sizing:border-box;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:32px;padding:0 12px;border:none;border-radius:var(--dsw-radius-md,16px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;white-space:nowrap;cursor:pointer;transition:background .15s,color .15s}",
  ".dsgh-btn:disabled{cursor:not-allowed;opacity:.4}",
  ".dsgh-btn.primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}",
  ".dsgh-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}",
  ".dsgh-btn.ghost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
  ".dsgh-iconBtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:6px;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-caption);line-height:1;cursor:pointer}",
  ".dsgh-iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
  ".dsgh-users{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}",
  ".dsgh-user{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px 0 5px;border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;transition:background .15s,color .15s,border-color .15s}",
  ".dsgh-user:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
  ".dsgh-user.active{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 46%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent);color:var(--dsw-alias-state-business-primary)}",
  ".dsgh-user img{width:22px;height:22px;border-radius:50%;object-fit:cover;background:var(--dsw-alias-bg-layer-2);flex:none}",
  ".dsgh-userFallback{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:11px;flex:none}",
  ".dsgh-userCount{color:var(--dsw-alias-label-tertiary);font-size:11px}",
  ".dsgh-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}",
  ".dsgh-toolbarRow{display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap}",
  ".dsgh-search{flex:1;min-width:160px;max-width:320px}",
  ".dsgh-filters{display:flex;gap:6px;flex-wrap:wrap}",
  ".dsgh-filter{height:28px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;transition:background .15s,color .15s,border-color .15s;white-space:nowrap}",
  ".dsgh-filter:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
  ".dsgh-filter.active{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 42%,transparent);color:var(--dsw-alias-state-business-primary)}",
  ".dsgh-count{color:var(--dsw-alias-label-tertiary);font-size:12px;margin-left:auto;white-space:nowrap}",
  ".dsgh-input{box-sizing:border-box;width:100%;border:.5px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:8px 10px;outline:none;transition:background .15s,border-color .15s}",
  ".dsgh-input:focus{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}",
  ".dsgh-select{box-sizing:border-box;height:32px;padding:0 24px 0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--dsw-alias-label-tertiary) 50%),linear-gradient(135deg,var(--dsw-alias-label-tertiary) 50%,transparent 50%);background-position:calc(100% - 13px) 13px,calc(100% - 9px) 13px;background-size:4px 4px;background-repeat:no-repeat}",
  ".dsgh-notice{display:flex;align-items:flex-start;gap:8px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);margin:0 0 16px;padding:10px 12px;font-size:12px;line-height:19px;overflow-wrap:anywhere}",
  ".dsgh-notice.bad{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,var(--dsw-specific-sidebar-fill));color:var(--dsw-alias-state-error-primary)}",
  ".dsgh-notice p{margin:0;flex:1;min-width:0}",
  ".dsgh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}",
  "@media (max-width:560px){.dsgh-grid{grid-template-columns:minmax(0,1fr);gap:10px}}",
  ".dsgh-card{position:relative;display:flex;flex-direction:column;gap:8px;min-width:0;border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:14px 14px 12px;cursor:pointer;transition:border-color .15s,background .15s}",
  ".dsgh-card:hover{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 38%,var(--dsw-alias-border-l3));background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04))}",
  ".dsgh-cardTop{display:flex;align-items:flex-start;gap:10px}",
  ".dsgh-repoGlyph{flex:none;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;font-size:12px;font-weight:600;letter-spacing:.02em;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));color:var(--dsw-alias-label-secondary)}",
  ".dsgh-cardNameWrap{flex:1;min-width:0;display:grid;gap:3px}",
  ".dsgh-cardName{margin:0;font-size:14px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}",
  ".dsgh-cardBadges{display:inline-flex;align-items:center;gap:4px;flex:none}",
  ".dsgh-badge{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:6px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06));color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:18px;white-space:nowrap}",
  ".dsgh-badge.fork{color:var(--dsw-alias-label-secondary)}",
  ".dsgh-cardDesc{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:38px}",
  ".dsgh-cardDesc.empty{color:var(--dsw-alias-label-tertiary)}",
  ".dsgh-topics{display:flex;gap:4px;flex-wrap:wrap}",
  ".dsgh-topic{padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,var(--dsw-alias-bg-base));color:var(--dsw-alias-state-business-primary);font-size:10px;line-height:16px;white-space:nowrap}",
  ".dsgh-cardMeta{display:flex;align-items:center;gap:12px;margin-top:auto;padding-top:2px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;min-width:0}",
  ".dsgh-lang{display:inline-flex;align-items:center;gap:5px;min-width:0;flex:none;max-width:46%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}",
  ".dsgh-langDot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary)}",
  ".dsgh-metric{display:inline-flex;align-items:center;gap:4px;flex:none}",
  ".dsgh-updated{margin-left:auto;white-space:nowrap}",
  ".dsgh-empty{grid-column:1/-1;text-align:center;color:var(--dsw-alias-label-tertiary);padding:44px 20px;font-size:13px}",
  ".dsgh-empty strong{display:block;color:var(--dsw-alias-label-secondary);font-weight:500;margin-bottom:6px}",
  ".dsgh-empty span{display:block;max-width:560px;margin:0 auto;line-height:20px}",
  ".dsgh-foot{color:var(--dsw-alias-label-caption);font-size:11px;line-height:18px;margin-top:16px}",
  ".dsgh-detail{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:24px}",
  ".dsgh-detailBackdrop{position:absolute;inset:0;border:0;padding:0;background:color-mix(in srgb,var(--dsw-alias-bg-base) 82%,transparent);backdrop-filter:blur(8px);cursor:zoom-out}",
  ".dsgh-detailPanel{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 320px;width:min(1120px,100%);height:calc(100vh - 48px);max-height:calc(100vh - 48px);border:.5px solid var(--dsw-alias-border-l3);border-radius:16px;overflow:hidden;background:var(--dsw-specific-sidebar-fill);box-shadow:0 18px 60px rgba(0,0,0,.35)}",
  "@media (max-width:900px){.dsgh-detail{padding:10px}.dsgh-detailPanel{grid-template-columns:minmax(0,1fr);height:calc(100vh - 20px);max-height:calc(100vh - 20px)}}",
  ".dsgh-detailMain{display:flex;flex-direction:column;min-width:0;min-height:0}",
  ".dsgh-detailHead{display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-bottom:.5px solid var(--dsw-alias-border-l3)}",
  ".dsgh-detailTitleWrap{flex:1;min-width:0}",
  ".dsgh-detailTitle{margin:0;font-size:16px;font-weight:600;line-height:24px;overflow-wrap:anywhere}",
  ".dsgh-detailOwner{color:var(--dsw-alias-label-tertiary);font-weight:400}",
  ".dsgh-detailDesc{margin:2px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere}",
  ".dsgh-detailScroll{flex:1;min-height:0;overflow:auto;padding:18px 22px 28px;scrollbar-gutter:stable}",
  ".dsgh-detailSide{min-width:0;min-height:0;overflow:auto;padding:18px;border-left:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);display:grid;gap:18px;align-content:start;scrollbar-gutter:stable}",
  "@media (max-width:900px){.dsgh-detailSide{border-left:0;border-top:.5px solid var(--dsw-alias-border-l3);max-height:42vh}}",
  ".dsgh-sideBlock{display:grid;gap:8px;min-width:0}",
  ".dsgh-sideTitle{margin:0;font-size:12px;font-weight:500;line-height:18px;color:var(--dsw-alias-label-secondary)}",
  ".dsgh-metaList{margin:0;display:grid}",
  ".dsgh-metaRow{display:grid;grid-template-columns:84px minmax(0,1fr);gap:10px;padding:6px 0;border-bottom:.5px solid var(--dsw-alias-border-l3);font-size:12px;line-height:18px}",
  ".dsgh-metaRow:last-child{border-bottom:0}",
  ".dsgh-metaRow dt{margin:0;color:var(--dsw-alias-label-tertiary)}",
  ".dsgh-metaRow dd{margin:0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;min-width:0}",
  ".dsgh-langBar{display:flex;height:7px;border-radius:999px;overflow:hidden;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06))}",
  ".dsgh-langBar span{display:block;height:100%}",
  ".dsgh-langLegend{display:flex;flex-wrap:wrap;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
  ".dsgh-langLegend span{display:inline-flex;align-items:center;gap:5px}",
  ".dsgh-commits{display:grid;gap:0}",
  ".dsgh-commit{display:grid;gap:2px;padding:8px 0;border-bottom:.5px solid var(--dsw-alias-border-l3);min-width:0}",
  ".dsgh-commit:last-child{border-bottom:0}",
  ".dsgh-commitMsg{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
  ".dsgh-commitMeta{display:flex;gap:8px;align-items:center;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;min-width:0}",
  ".dsgh-sha{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06));padding:0 5px;border-radius:4px;flex:none}",
  ".dsgh-clone{display:grid;gap:6px}",
  ".dsgh-cloneRow{display:flex;align-items:center;gap:6px;min-width:0}",
  ".dsgh-cloneText{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  ".dsgh-mini{flex:none;height:24px;padding:0 8px;border-radius:8px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px}",
  ".dsgh-mini:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
  ".dsgh-readme{color:var(--dsw-alias-label-primary);font-size:13px;line-height:21px;overflow-wrap:anywhere}",
  ".dsgh-readme h1,.dsgh-readme h2,.dsgh-readme h3,.dsgh-readme h4,.dsgh-readme h5,.dsgh-readme h6{margin:22px 0 10px;font-weight:600;line-height:1.35;color:var(--dsw-alias-label-primary)}",
  ".dsgh-readme h1{font-size:20px;border-bottom:.5px solid var(--dsw-alias-border-l3);padding-bottom:6px}",
  ".dsgh-readme h2{font-size:17px;border-bottom:.5px solid var(--dsw-alias-border-l3);padding-bottom:5px}",
  ".dsgh-readme h3{font-size:15px}",
  ".dsgh-readme h4,.dsgh-readme h5,.dsgh-readme h6{font-size:13px}",
  ".dsgh-readme p{margin:10px 0}",
  ".dsgh-readme a{color:var(--dsw-alias-state-business-primary);text-decoration:none}",
  ".dsgh-readme a:hover{text-decoration:underline}",
  ".dsgh-readme code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2);border-radius:5px;padding:1px 5px}",
  ".dsgh-readme pre{margin:12px 0;padding:12px 14px;border-radius:10px;background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l3);overflow:auto;max-height:420px}",
  ".dsgh-readme pre code{background:transparent;padding:0;font-size:12px;line-height:19px;white-space:pre}",
  ".dsgh-readme ul,.dsgh-readme ol{margin:8px 0;padding-left:22px}",
  ".dsgh-readme li{margin:3px 0}",
  ".dsgh-readme blockquote{margin:12px 0;padding:2px 14px;border-left:3px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}",
  ".dsgh-readme hr{border:0;border-top:.5px solid var(--dsw-alias-border-l3);margin:20px 0}",
  ".dsgh-readme img{max-width:100%;height:auto;border-radius:6px}",
  ".dsgh-readme table{border-collapse:collapse;margin:12px 0;font-size:12px;display:block;overflow:auto;max-width:100%}",
  ".dsgh-readme th,.dsgh-readme td{border:.5px solid var(--dsw-alias-border-l3);padding:5px 10px;text-align:left;vertical-align:top}",
  ".dsgh-readme th{background:var(--dsw-alias-bg-layer-2);font-weight:600}",
  ".dsgh-readme del{color:var(--dsw-alias-label-tertiary)}",
  ".dsgh-readme .dsgh-readmeNote{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-top:18px}",
  ".dsgh-readmeFail{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:19px;padding:12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2)}",
  ".dsgh-loading{color:var(--dsw-alias-label-tertiary);font-size:13px;padding:40px 20px;text-align:center}",
  ".dsgh-settings{display:grid;gap:18px;max-width:560px}",
  ".dsgh-field{display:grid;gap:7px}",
  ".dsgh-label{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;display:flex;justify-content:space-between;gap:8px;align-items:center}",
  ".dsgh-hint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px;margin:0}",
  ".dsgh-addRow{display:flex;gap:8px}",
  ".dsgh-addRow .dsgh-input{flex:1}",
  ".dsgh-userList{display:flex;flex-wrap:wrap;gap:6px;min-height:30px}",
  ".dsgh-saveChip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;border:.5px solid var(--dsw-alias-border-l3)}",
  ".dsgh-saveChip button{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;line-height:1;padding:2px;border-radius:50%}",
  ".dsgh-saveChip button:hover{color:var(--dsw-alias-state-error-primary)}",
  ".dsgh-settingsActions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
];

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Go: "#00ADD8",
  Rust: "#dea584", Java: "#b07219", "C++": "#f34b7d", C: "#555555", "C#": "#178600",
  Ruby: "#701516", PHP: "#4F5D95", Swift: "#F05138", Kotlin: "#A97BFF", Shell: "#89e051",
  HTML: "#e34c26", CSS: "#563d7c", Vue: "#41b883", Dart: "#00B4AB", Lua: "#000080",
  "Jupyter Notebook": "#DA5B0B", MDX: "#fcb32c", Dockerfile: "#384d54", Makefile: "#427819",
  Nix: "#7e7eff", Haskell: "#5e5086", Scala: "#c22d40", Elixir: "#6e4a7e", Zig: "#ec915c",
};
const FALLBACK_LANG = "var(--dsw-alias-label-tertiary)";

function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      for (const fn of subs) fn();
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

function useStore(store) {
  const [, bump] = useState(0);
  useEffect(() => store.subscribe(() => bump((n) => n + 1)), [store]);
  return store.get();
}

async function call(path, body) {
  try {
    const response = await fetch(path, body === undefined ? undefined : {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { error: data?.error || t("요청이 실패했습니다.", "The request failed."), kind: data?.kind, resetAt: data?.resetAt };
    return data ?? {};
  } catch (error) {
    return { error: error?.message || t("서버에 연결하지 못했습니다.", "Could not reach the server.") };
  }
}

const SVG = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

function IconRepo({ size = 16 }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", ...SVG },
    h("circle", { cx: 7.5, cy: 6.5, r: 2.2 }),
    h("circle", { cx: 7.5, cy: 17.5, r: 2.2 }),
    h("circle", { cx: 16.5, cy: 12, r: 2.2 }),
    h("path", { d: "M7.5 8.7v6.6" }),
    h("path", { d: "M9.7 7.4c4 0 5 3 6.8 4.4" }),
    h("path", { d: "M19.5 2.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z", fill: "currentColor", stroke: "none" }));
}

function IconRefresh({ size = 14 }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", ...SVG },
    h("path", { d: "M20 11a8 8 0 1 0-2.3 5.7" }), h("path", { d: "M20 4v7h-7" }));
}

function IconClose({ size = 14 }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", ...SVG }, h("path", { d: "M6 6l12 12M18 6L6 18" }));
}

function IconExternal({ size = 13 }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", ...SVG },
    h("path", { d: "M14 4h6v6" }), h("path", { d: "M20 4l-9 9" }),
    h("path", { d: "M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" }));
}

function IconStar({ size = 13 }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", ...SVG },
    h("path", { d: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z", strokeLinejoin: "round" }));
}

function IconFork({ size = 13 }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", ...SVG },
    h("circle", { cx: 7, cy: 6, r: 2 }),
    h("circle", { cx: 17, cy: 6, r: 2 }),
    h("circle", { cx: 12, cy: 19, r: 2 }),
    h("path", { d: "M7 8v1.5a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V8M12 13.5V17" }));
}

function IconCopy({ size = 12 }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", ...SVG },
    h("rect", { x: 8, y: 8, width: 12, height: 12, rx: 2 }), h("path", { d: "M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" }));
}

function formatCount(value) {
  try {
    return new Intl.NumberFormat(isKo() ? "ko-KR" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
  } catch {
    return String(value ?? 0);
  }
}

let relativeFormatter;
function relative(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const rtf = relativeFormatter ??= new Intl.RelativeTimeFormat(isKo() ? "ko" : "en", { numeric: "auto" });
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 7) return rtf.format(days, "day");
    const weeks = Math.round(days / 7);
    if (Math.abs(weeks) < 5) return rtf.format(weeks, "week");
    const months = Math.round(days / 30);
    if (Math.abs(months) < 12) return rtf.format(months, "month");
    return rtf.format(Math.round(days / 365), "year");
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(isKo() ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "—";
  }
}

/* ── README 마크다운 ─────────────────────────────────────────────────── */

function readmeResolver(repo) {
  const rawBase = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.defaultBranch || "main"}/`;
  const blobBase = `${repo.htmlUrl}/blob/${repo.defaultBranch || "main"}/`;
  return (href, kind = "link") => {
    const raw = String(href ?? "").trim();
    if (!raw) return "";
    if (/^(https?:|mailto:)/i.test(raw)) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    if (raw.startsWith("#")) return `${repo.htmlUrl}${raw}`;
    const path = raw.replace(/^\.\//, "").replace(/^\//, "");
    return kind === "image" ? `${rawBase}${path}` : `${blobBase}${path}`;
  };
}

/** README 에 섞인 간단한 HTML 을 마크다운으로 낮춘다(배지·로고·가운데 정렬). */
function preprocessMarkdown(text) {
  let out = String(text ?? "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /src=["']([^"']+)["']/i.exec(tag);
    const alt = /alt=["']([^"']*)["']/i.exec(tag);
    return src ? `![${alt ? alt[1] : ""}](${src[1]})` : "";
  });
  out = out.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, inner) => `${"#".repeat(Number(level))} ${inner.replace(/\n/g, " ")}`);
  out = out.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => `[${inner.replace(/<[^>]+>/g, "")}](${href})`);
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/?(p|div|details|summary|center|table|thead|tbody|tr|td|th|kbd|sub|sup)[^>]*>/gi, "\n");
  out = out.replace(/<[^>]+>/g, "");
  return out;
}

const INLINE_SOURCE = "(!\\[([^\\]]*)\\]\\(([^)\\s]+)\\)|\\[([^\\]]*)\\]\\(([^)\\s]+)\\)|`([^`]+)`|\\*\\*([^*]+)\\*\\*|~~([^~]+)~~|\\*([^*]+)\\*|(https?:\\/\\/[^\\s<)]+))";

function inlineNodes(text, key, resolve) {
  const out = [];
  let last = 0;
  let index = 0;
  const re = new RegExp(INLINE_SOURCE, "g");
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const k = `${key}.${index++}`;
    if (match[2] !== undefined) {
      out.push(h("img", {
        key: k, src: resolve(match[3], "image"), alt: match[2], loading: "lazy",
        onError: (event) => { event.currentTarget.style.display = "none"; },
      }));
    } else if (match[4] !== undefined) {
      out.push(h("a", { key: k, href: resolve(match[5], "link"), target: "_blank", rel: "noreferrer noopener" }, ...inlineNodes(match[4], `${k}t`, resolve)));
    } else if (match[6] !== undefined) {
      out.push(h("code", { key: k }, match[6]));
    } else if (match[7] !== undefined) {
      out.push(h("strong", { key: k }, ...inlineNodes(match[7], `${k}b`, resolve)));
    } else if (match[8] !== undefined) {
      out.push(h("del", { key: k }, ...inlineNodes(match[8], `${k}s`, resolve)));
    } else if (match[9] !== undefined) {
      out.push(h("em", { key: k }, ...inlineNodes(match[9], `${k}i`, resolve)));
    } else if (match[10] !== undefined) {
      out.push(h("a", { key: k, href: match[10], target: "_blank", rel: "noreferrer noopener" }, match[10]));
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function markdownBlocks(text, resolve) {
  const lines = preprocessMarkdown(text).replace(/\r\n?/g, "\n").split("\n");
  const nodes = [];
  let i = 0;
  let key = 0;

  const tableCells = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i += 1; continue; }

    const fence = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/.exec(line);
    if (fence) {
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*(```|~~~)\s*$/.test(lines[i])) { code.push(lines[i]); i += 1; }
      i += 1;
      nodes.push(h("pre", { key: key++ }, h("code", { className: fence[2] ? `language-${fence[2]}` : undefined }, code.join("\n"))));
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      nodes.push(h(`h${level}`, { key: key++ }, ...inlineNodes(heading[2], `h${key}`, resolve)));
      i += 1;
      continue;
    }

    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) { nodes.push(h("hr", { key: key++ })); i += 1; continue; }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, "")); i += 1; }
      nodes.push(h("blockquote", { key: key++ }, ...markdownBlocks(quote.join("\n"), resolve)));
      continue;
    }

    const next = lines[i + 1] ?? "";
    if (line.includes("|") && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(next)) {
      const head = tableCells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) { rows.push(tableCells(lines[i])); i += 1; }
      nodes.push(h("table", { key: key++ },
        h("thead", null, h("tr", null, ...head.map((cell, c) => h("th", { key: c }, ...inlineNodes(cell, `th${c}`, resolve))))),
        h("tbody", null, ...rows.map((row, r) => h("tr", { key: r }, ...row.map((cell, c) => h("td", { key: c }, ...inlineNodes(cell, `td${r}.${c}`, resolve))))))));
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      const items = [];
      let n = 0;
      while (i < lines.length) {
        const m = /^\s*[-*+]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(h("li", { key: n++ }, ...inlineNodes(m[1], `li${n}`, resolve)));
        i += 1;
      }
      nodes.push(h("ul", { key: key++ }, ...items));
      continue;
    }

    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      const items = [];
      let n = 0;
      while (i < lines.length) {
        const m = /^\s*\d+[.)]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(h("li", { key: n++ }, ...inlineNodes(m[1], `oli${n}`, resolve)));
        i += 1;
      }
      nodes.push(h("ol", { key: key++ }, ...items));
      continue;
    }

    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(#{1,6}\s|```|~~~|>|[-*+]\s|\d+[.)]\s)/.test(lines[i])) {
      para.push(lines[i].trim());
      i += 1;
    }
    nodes.push(h("p", { key: key++ }, ...inlineNodes(para.join(" "), `p${key}`, resolve)));
  }
  return nodes;
}

function ReadmeView({ detail }) {
  const nodes = useMemo(() => {
    if (!detail?.readme?.text) return null;
    return markdownBlocks(detail.readme.text, readmeResolver(detail.repo));
  }, [detail]);
  if (!detail?.readme) {
    return h("div", { className: "dsgh-readmeFail" }, t("이 레포에는 README 가 없습니다.", "This repository has no README."));
  }
  return h("div", { className: "dsgh-readme" },
    nodes,
    detail.readme.truncated ? h("p", { className: "dsgh-readmeNote" }, t("README 앞부분만 표시합니다.", "Only the beginning of the README is shown.")) : null);
}

/* ── 화면 ────────────────────────────────────────────────────────────── */

function languageDot(language) {
  return h("span", { className: "dsgh-langDot", style: { background: LANG_COLORS[language] || FALLBACK_LANG } });
}

function RepoCard({ repo, onOpen }) {
  const topics = repo.topics.slice(0, 3);
  const extra = repo.topics.length - topics.length;
  return h("article", { className: "dsgh-card", role: "button", tabIndex: 0,
    onClick: () => onOpen(repo),
    onKeyDown: (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(repo); } } },
    h("div", { className: "dsgh-cardTop" },
      h("span", { className: "dsgh-repoGlyph", style: {
        color: LANG_COLORS[repo.language] || FALLBACK_LANG,
        background: repo.language ? `color-mix(in srgb, ${LANG_COLORS[repo.language] || FALLBACK_LANG} 16%, transparent)` : undefined,
      } }, repo.name.slice(0, 2).toUpperCase()),
      h("div", { className: "dsgh-cardNameWrap" },
        h("h3", { className: "dsgh-cardName", title: repo.fullName }, repo.name),
        h("span", { className: "dsgh-cardBadges" },
          repo.fork ? h("span", { className: "dsgh-badge fork" }, t("포크", "Fork")) : null,
          repo.archived ? h("span", { className: "dsgh-badge" }, t("보관됨", "Archived")) : null))),
    h("p", { className: `dsgh-cardDesc${repo.description ? "" : " empty"}`, title: repo.description }, repo.description || t("설명이 없습니다.", "No description.")),
    topics.length > 0 ? h("div", { className: "dsgh-topics" },
      ...topics.map((topic) => h("span", { className: "dsgh-topic", key: topic }, topic)),
      extra > 0 ? h("span", { className: "dsgh-topic" }, `+${extra}`) : null) : null,
    h("div", { className: "dsgh-cardMeta" },
      repo.language ? h("span", { className: "dsgh-lang", title: repo.language }, languageDot(repo.language), repo.language) : null,
      h("span", { className: "dsgh-metric", title: t("별", "Stars") }, h(IconStar), formatCount(repo.stars)),
      h("span", { className: "dsgh-metric", title: t("포크", "Forks") }, h(IconFork), formatCount(repo.forks)),
      h("span", { className: "dsgh-updated", title: formatDate(repo.pushedAt) }, relative(repo.pushedAt))));
}

function UserPill({ item, active, onClick }) {
  const profile = item.profile;
  return h("button", { className: `dsgh-user${active ? " active" : ""}`, type: "button", onClick,
    title: profile?.bio || item.error?.error || item.login },
    profile?.avatarUrl
      ? h("img", { src: profile.avatarUrl, alt: "", loading: "lazy", onError: (event) => { event.currentTarget.style.visibility = "hidden"; } })
      : h("span", { className: "dsgh-userFallback" }, item.login.slice(0, 1).toUpperCase()),
    h("span", null, profile?.name && profile.name !== item.login ? `${profile.name}` : item.login),
    profile?.publicRepos ? h("span", { className: "dsgh-userCount" }, String(profile.publicRepos)) : null);
}

function RepoDetail({ repo, detail, loading, error, onClose, onRetry, onCopy }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    document.body.classList.add("dsgh-noscroll");
    return () => document.body.classList.remove("dsgh-noscroll");
  }, []);
  const languages = detail?.languages ?? {};
  const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const totalBytes = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  const rows = [
    [t("기본 브랜치", "Default branch"), repo.defaultBranch],
    [t("언어", "Language"), repo.language || "—"],
    [t("라이선스", "License"), repo.license || "—"],
    [t("이슈", "Open issues"), formatCount(repo.openIssues)],
    [t("크기", "Size"), `${formatCount(repo.sizeKb)} KB`],
    [t("공개", "Visibility"), repo.visibility],
    [t("만든 날", "Created"), formatDate(repo.createdAt)],
    [t("마지막 푸시", "Last push"), formatDate(repo.pushedAt)],
  ];
  if (repo.homepage) rows.push([t("홈페이지", "Homepage"), repo.homepage]);
  const aboutSection = h("section", { className: "dsgh-sideBlock" },
    h("h3", { className: "dsgh-sideTitle" }, t("정보", "About")),
    h("dl", { className: "dsgh-metaList" },
      ...rows.map(([label, value]) => h("div", { className: "dsgh-metaRow", key: label },
        h("dt", null, label),
        h("dd", null, String(value))))));

  const languageSection = entries.length > 0 ? h("section", { className: "dsgh-sideBlock" },
    h("h3", { className: "dsgh-sideTitle" }, t("언어 비율", "Languages")),
    h("div", { className: "dsgh-langBar", "aria-hidden": true },
      ...entries.map(([name, bytes]) => h("span", {
        key: name,
        style: { width: `${(bytes / totalBytes) * 100}%`, background: LANG_COLORS[name] || FALLBACK_LANG },
        title: `${name} ${Math.round((bytes / totalBytes) * 100)}%`,
      }))),
    h("div", { className: "dsgh-langLegend" },
      ...entries.slice(0, 5).map(([name, bytes]) => h("span", { key: name },
        languageDot(name),
        `${name} ${Math.round((bytes / totalBytes) * 100)}%`)))) : null;

  const commitsTitle = h("section", { className: "dsgh-sideBlock" },
    h("h3", { className: "dsgh-sideTitle" }, t("최근 커밋", "Recent commits")));

  const commitsList = detail?.commits?.length
    ? h("div", { className: "dsgh-commits" },
        ...detail.commits.map((commit) => h("div", { className: "dsgh-commit", key: commit.fullSha },
          h("a", { className: "dsgh-commitMsg", href: commit.htmlUrl, target: "_blank", rel: "noreferrer noopener", title: commit.message }, commit.message || "(no message)"),
          h("span", { className: "dsgh-commitMeta" },
            h("span", { className: "dsgh-sha" }, commit.sha),
            h("span", null, commit.author || "—"),
            h("span", null, relative(commit.date))))))
    : h("p", { className: "dsgh-hint" }, loading ? t("불러오는 중…", "Loading…") : t("커밋 정보가 없습니다.", "No commit information."));

  const cloneSection = h("section", { className: "dsgh-sideBlock" },
    h("h3", { className: "dsgh-sideTitle" }, t("복제", "Clone")),
    h("div", { className: "dsgh-clone" },
      h("div", { className: "dsgh-cloneRow" },
        h("span", { className: "dsgh-cloneText", title: repo.cloneUrl }, repo.cloneUrl || "—"),
        h("button", { className: "dsgh-mini", type: "button", onClick: () => onCopy(repo.cloneUrl) }, h(IconCopy), "HTTPS")),
      h("div", { className: "dsgh-cloneRow" },
        h("span", { className: "dsgh-cloneText", title: repo.sshUrl }, repo.sshUrl || "—"),
        h("button", { className: "dsgh-mini", type: "button", onClick: () => onCopy(repo.sshUrl) }, h(IconCopy), "SSH"))));

  const hint = h("p", { className: "dsgh-hint" }, t("이 패널은 읽기 전용입니다. 이슈·PR·설정 변경은 GitHub에서 하세요.", "This panel is read-only. Create issues, pull requests, and settings changes on GitHub."));

  const main = h("div", { className: "dsgh-detailMain" },
    h("header", { className: "dsgh-detailHead" },
      h("div", { className: "dsgh-detailTitleWrap" },
        h("h2", { className: "dsgh-detailTitle" }, h("span", { className: "dsgh-detailOwner" }, `${repo.owner} / `), repo.name),
        repo.description ? h("p", { className: "dsgh-detailDesc" }, repo.description) : null),
      h("a", { className: "dsgh-btn primary", href: repo.htmlUrl, target: "_blank", rel: "noreferrer noopener", title: t("GitHub에서 열기", "Open on GitHub") },
        h(IconExternal), t("GitHub", "GitHub")),
      h("button", { className: "dsgh-iconBtn", type: "button", "aria-label": t("닫기", "Close"), onClick: onClose }, h(IconClose))),
    h("div", { className: "dsgh-detailScroll" },
      loading ? h("div", { className: "dsgh-loading" }, t("README 와 커밋을 불러오는 중입니다…", "Loading the README and commits…"))
      : error ? h("div", { className: "dsgh-readmeFail" },
        h("p", null, error),
        h("button", { className: "dsgh-btn ghost", type: "button", onClick: onRetry }, t("다시 시도", "Retry")))
      : detail ? h(ReadmeView, { detail }) : null));

  const side = h("aside", { className: "dsgh-detailSide" },
    aboutSection,
    languageSection,
    commitsTitle,
    commitsList,
    cloneSection,
    hint);

  return h("div", { className: "dsgh-detail", role: "dialog", "aria-modal": "true", "aria-label": repo.fullName },
    h("button", { className: "dsgh-detailBackdrop", type: "button", "aria-label": t("닫기", "Close"), onClick: onClose }),
    h("div", { className: "dsgh-detailPanel" }, main, side));
}

function GalleryBody({ state: s, actions }) {
  const repos = useMemo(() => {
    const query = s.query.trim().toLowerCase();
    let list = s.repos;
    if (s.scope === "source") list = list.filter((repo) => !repo.fork);
    if (s.scope === "fork") list = list.filter((repo) => repo.fork);
    if (s.scope === "archived") list = list.filter((repo) => repo.archived);
    if (query) {
      list = list.filter((repo) => [repo.name, repo.description, repo.language, ...repo.topics].join(" ").toLowerCase().includes(query));
    }
    return [...list].sort((a, b) => {
      if (s.sort === "stars") return b.stars - a.stars || a.name.localeCompare(b.name);
      if (s.sort === "name") return a.name.localeCompare(b.name);
      return String(b.pushedAt).localeCompare(String(a.pushedAt));
    });
  }, [s.repos, s.query, s.scope, s.sort]);

  const scopes = [
    ["all", t("전체", "All")],
    ["source", t("원본", "Sources")],
    ["fork", t("포크", "Forks")],
    ["archived", t("보관됨", "Archived")],
  ];
  const empty = repos.length === 0;
  return h("div", null,
    h("div", { className: "dsgh-toolbar" },
      h("input", { className: "dsgh-input dsgh-search", type: "search", value: s.query,
        placeholder: t("레포·설명·토픽 검색", "Search repo, description, topic"),
        onChange: (event) => actions.search(event.target.value) }),
      h("select", { className: "dsgh-select", value: s.sort, onChange: (event) => actions.sort(event.target.value), "aria-label": t("정렬", "Sort") },
        h("option", { value: "pushed" }, t("최근 푸시", "Recently pushed")),
        h("option", { value: "stars" }, t("별 많은 순", "Most stars")),
        h("option", { value: "name" }, t("이름 순", "Name"))),
      h("span", { className: "dsgh-count" }, t(`${repos.length} / ${s.repos.length}개`, `${repos.length} / ${s.repos.length}`))),
    h("div", { className: "dsgh-toolbarRow" },
      h("div", { className: "dsgh-filters", role: "group", "aria-label": t("레포 종류", "Repository kind") },
        ...scopes.map(([value, label]) => h("button", {
          key: value, type: "button", className: `dsgh-filter${s.scope === value ? " active" : ""}`,
          "aria-pressed": s.scope === value, onClick: () => actions.scope(value),
        }, label)))),
    s.reposError ? h("div", { className: "dsgh-notice bad" },
      h("p", null, s.reposError),
      h("button", { className: "dsgh-btn ghost", type: "button", onClick: actions.retry }, t("다시 시도", "Retry"))) : null,
    s.reposLoading && empty ? h("div", { className: "dsgh-empty" }, t("레포를 불러오는 중입니다…", "Loading repositories…")) : null,
    empty && !s.reposLoading ? h("div", { className: "dsgh-empty" },
      h("strong", null, s.query || s.scope !== "all"
        ? t("조건에 맞는 레포가 없습니다", "No repositories match")
        : t("아직 보여 줄 레포가 없습니다", "No repositories to show")),
      h("span", null, s.query || s.scope !== "all"
        ? t("검색어를 지우거나 다른 필터를 골라 보세요.", "Clear the search or pick another filter.")
        : t("설정 → 플러그인에서 관심 GitHub 사용자를 추가하면 그 사용자의 공개 레포가 카드로 나타납니다.", "Add a GitHub user in Settings → Plugins and their public repositories appear here as cards."))) : null,
    h("div", { className: "dsgh-grid" }, ...repos.map((repo) => h(RepoCard, { key: repo.id, repo, onOpen: actions.open }))),
    h("p", { className: "dsgh-foot" }, t(
      "공개 레포만 읽습니다. 카드를 누르면 README·최근 커밋을 보고, GitHub 링크로 이슈·PR 작업을 이어가세요. 에이전트에게는 github_repos · github_repo 도구가 열려 있습니다.",
      "Only public repositories are read. Select a card to see its README and recent commits, then follow the GitHub link for issue and PR work. The agent can call github_repos and github_repo.")));
}

function GalleryPage({ store, actions }) {
  const s = useStore(store);
  return h("div", { className: "dsgh-page" },
    h("div", { className: "dsgh-scroll" },
      h("div", { className: "dsgh-content" },
        h("header", { className: "dsgh-heading" },
          h("div", null,
            h("h1", { className: "dsgh-h1" }, t("GitHub 레포", "GitHub repos")),
            h("p", { className: "dsgh-intro" }, t(
              "관심 GitHub 사용자의 공개 레포를 카드로 훑어보는 읽기 전용 뷰어입니다. README 와 최근 커밋을 읽고, 실제 작업은 GitHub 링크로 이어가세요.",
              "A read-only viewer for public repositories of the GitHub users you follow. Read READMEs and recent commits, then continue real work on GitHub."))),
          h("div", { className: "dsgh-headActions" },
            h("span", { className: "dsgh-chip", title: t("감시 중인 사용자", "Watched users") },
              h("span", { className: "dot" }),
              t(`${s.users.length}명 감시 중`, `${s.users.length} watched`)),
            h("button", { className: "dsgh-btn ghost", type: "button", onClick: actions.refresh,
              disabled: s.reposLoading || s.usersLoading, title: t("새로 고침", "Refresh") },
              h(IconRefresh), t("새로 고침", "Refresh")))),
        s.usersError ? h("div", { className: "dsgh-notice bad" }, h("p", null, s.usersError)) : null,
        s.users.length > 0 ? h("div", { className: "dsgh-users", role: "tablist", "aria-label": t("감시 사용자", "Watched users") },
          ...s.users.map((item) => h(UserPill, {
            key: item.login, item, active: item.login === s.activeUser,
            onClick: () => actions.selectUser(item.login),
          }))) : null,
        s.usersLoading ? h("div", { className: "dsgh-empty" }, t("사용자를 불러오는 중입니다…", "Loading users…"))
        : s.users.length === 0 ? h("div", { className: "dsgh-empty" },
          h("strong", null, t("감시 중인 사용자가 없습니다", "No watched users")),
          h("span", null, t("설정 → 플러그인 → GitHub 레포에서 사용자 로그인을 추가하세요. 예: ByungHyun21", "Add a GitHub login in Settings → Plugins → GitHub repos, for example ByungHyun21")))
        : h(GalleryBody, { state: s, actions })),
    ),
    s.selected ? h(RepoDetail, {
      repo: s.selected,
      detail: s.detail,
      loading: s.detailLoading,
      error: s.detailError,
      onClose: actions.close,
      onRetry: () => actions.open(s.selected),
      onCopy: actions.copyText,
    }) : null);
}

/* ── 설정 페이지 ─────────────────────────────────────────────────────── */

function settingsPage(form) {
  return function GithubSettings({ view }) {
    const state = React.useSyncExternalStore((fn) => form.subscribe(fn), () => form.getSnapshot(), () => form.getSnapshot());
    const [draft, setDraft] = useState("");
    const [token, setToken] = useState("");
    const [saved, setSaved] = useState("");
    const [saveError, setSaveError] = useState("");
    useEffect(() => {
      if (state.status === "ready") {
        setToken((current) => current === "" ? state.value?.token ?? "" : current);
      }
    }, [state.status]);
    if (view === "summary") return h("span", null, t("GitHub 레포 · 공개 레포 뷰어", "GitHub repos · public repository viewer"));
    if (state.status !== "ready") return h("p", { role: "status" }, t("설정을 불러오는 중입니다.", "Loading settings…"));

    const users = Array.isArray(state.value?.users) ? state.value.users : [];
    const persist = async (nextUsers) => {
      setSaved("");
      setSaveError("");
      try {
        if (await form.set("users", nextUsers)) setSaved(t("저장했습니다.", "Saved."));
        else setSaveError(t("저장하지 못했습니다.", "Could not save."));
      } catch {
        setSaveError(t("저장하지 못했습니다.", "Could not save."));
      }
    };
    const clean = (raw) => String(raw ?? "").trim().replace(/^@+/, "").replace(/^https?:\/\/(?:www\.)?github\.com\//i, "").replace(/\/+$/, "").split(/[/?#]/)[0];
    const add = () => {
      const login = clean(draft);
      if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(login)) {
        setSaveError(t("GitHub 로그인 형식이 아닙니다.", "That is not a GitHub login."));
        return;
      }
      if (users.some((existing) => String(existing).toLowerCase() === login.toLowerCase())) {
        setDraft("");
        return;
      }
      setDraft("");
      void persist([...users, login]);
    };
    const remove = (login) => void persist(users.filter((existing) => existing !== login));
    const off = !state.writable;
    return h("div", { className: "dsgh-settings" },
      h("div", { className: "dsgh-field" },
        h("span", { className: "dsgh-label" }, t("관심 GitHub 사용자", "Watched GitHub users")),
        h("div", { className: "dsgh-addRow" },
          h("input", { className: "dsgh-input", type: "text", value: draft, disabled: off,
            placeholder: "ByungHyun21 또는 github.com/ByungHyun21",
            onChange: (event) => setDraft(event.target.value),
            onKeyDown: (event) => { if (event.key === "Enter") { event.preventDefault(); add(); } } }),
          h("button", { className: "dsgh-btn primary", type: "button", disabled: off || draft.trim() === "", onClick: add }, t("추가", "Add"))),
        users.length > 0
          ? h("div", { className: "dsgh-userList" }, ...users.map((login) =>
            h("span", { className: "dsgh-saveChip", key: login },
              login,
              h("button", { type: "button", disabled: off, "aria-label": t(`${login} 삭제`, `Remove ${login}`), onClick: () => remove(login) }, "×"))))
          : h("p", { className: "dsgh-hint" }, t("아직 등록한 사용자가 없습니다. 최소 한 명을 추가하세요.", "No users yet. Add at least one.")),
        h("p", { className: "dsgh-hint" }, t("개인 계정과 조직 모두 넣을 수 있습니다. 공개 레포만 카드로 보입니다.", "Personal accounts and organizations both work. Only public repositories are shown as cards."))),
      h("div", { className: "dsgh-field" },
        h("span", { className: "dsgh-label" }, t("GitHub 토큰 (선택)", "GitHub token (optional)")),
        h("input", { className: "dsgh-input", type: "password", value: token, disabled: off, autoComplete: "off",
          placeholder: t("비워 두면 공개 데이터만 읽습니다", "Leave empty to read public data only"),
          onChange: (event) => setToken(event.target.value),
          onBlur: async () => {
            if (token === (state.value?.token ?? "")) return;
            try {
              if (await form.set("token", token.trim())) setSaved(t("저장했습니다.", "Saved."));
              else setSaveError(t("저장하지 못했습니다.", "Could not save."));
            } catch { setSaveError(t("저장하지 못했습니다.", "Could not save.")); }
          } }),
        h("p", { className: "dsgh-hint" }, t("선택 사항입니다. 토큰을 넣으면 비공개 레포와 시간당 5,000회 한도를 씁니다. 값은 이 프로필 설정에 저장됩니다.", "Optional. A token adds private repositories and the 5,000/hour limit; it is stored in this profile's settings."))),
      h("div", { className: "dsgh-settingsActions" },
        saved ? h("span", { className: "dsgh-hint", role: "status" }, saved) : null,
        saveError ? h("span", { className: "dsgh-hint", style: { color: "var(--dsw-alias-state-error-primary)" }, role: "alert" }, saveError) : null),
      h("p", { className: "dsgh-hint" }, t("쓰기 동작은 없습니다. 레포 생성·이슈·PR 은 GitHub 링크에서 진행합니다.", "There are no write actions. Create repositories, issues, and pull requests on GitHub.")));
  };
}

function apply(ctx) {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS.join("\n");
    document.head.append(style);
    ctx.effect(() => () => style.remove(), `${PLUGIN}: style`);
  }

  const store = createStore({
    users: [], usersLoading: true, usersError: "",
    activeUser: "",
    repos: [], reposLoading: false, reposError: "",
    query: "", sort: "pushed", scope: "all",
    selected: null, detail: null, detailLoading: false, detailError: "",
  });

  const loadUsers = async () => {
    store.set({ usersLoading: true, usersError: "" });
    const result = await call(`${API}/users`);
    if (result.error) {
      store.set({ usersLoading: false, usersError: result.error });
      return;
    }
    const users = Array.isArray(result.users) ? result.users : [];
    const active = store.get().activeUser;
    const nextActive = users.some((item) => item.login === active) ? active : users[0]?.login ?? "";
    store.set({ usersLoading: false, users, activeUser: nextActive });
    if (nextActive) void loadRepos(nextActive);
    else store.set({ repos: [] });
  };

  const loadRepos = async (login) => {
    if (!login) return;
    store.set({ reposLoading: true, reposError: "" });
    const result = await call(`${API}/repos?user=${encodeURIComponent(login)}`);
    if (login !== store.get().activeUser) return;
    if (result.error) {
      store.set({ reposLoading: false, reposError: result.error, repos: [] });
      return;
    }
    store.set({ reposLoading: false, repos: Array.isArray(result.repos) ? result.repos : [], reposError: "" });
  };

  const actions = {
    selectUser(login) {
      if (store.get().activeUser === login) return;
      store.set({ activeUser: login, repos: [], reposError: "", query: "", scope: "all" });
      void loadRepos(login);
    },
    sort(value) { store.set({ sort: value }); },
    scope(value) { store.set({ scope: value }); },
    search(value) { store.set({ query: value }); },
    retry() { void loadRepos(store.get().activeUser); },
    async refresh() {
      const login = store.get().activeUser;
      if (login) {
        await call(`${API}/refresh`, { user: login });
        void loadRepos(login);
      }
      void loadUsers();
    },
    async open(repo) {
      store.set({ selected: repo, detail: null, detailLoading: true, detailError: "" });
      const result = await call(`${API}/repo?owner=${encodeURIComponent(repo.owner)}&name=${encodeURIComponent(repo.name)}`);
      if (store.get().selected?.id !== repo.id) return;
      if (result.error) store.set({ detailLoading: false, detailError: result.error });
      else store.set({ detailLoading: false, detail: result });
    },
    close() { store.set({ selected: null, detail: null, detailError: "" }); },
    async copyText(text) {
      try { await navigator.clipboard.writeText(String(text ?? "")); } catch { /* 클립보드가 없으면 조용히 */ }
    },
  };

  void loadUsers();

  // 화면이 보일 때만, 같은 탭이 10분 넘게 켜져 있으면 조용히 다시 읽는다.
  let lastLoadAt = Date.now();
  let refreshTimer = null;
  refreshTimer = setInterval(() => {
    try {
      if (document.visibilityState === "visible" && Date.now() - lastLoadAt > 10 * 60_000) {
        lastLoadAt = Date.now();
        const login = store.get().activeUser;
        if (login) void loadRepos(login);
      }
    } catch { /* 무시 */ }
  }, 60_000);
  ctx.effect(() => () => { if (refreshTimer) clearInterval(refreshTimer); }, `${PLUGIN}: refresh timer`);

  ctx.slots.inject("main", () =>
    ctx.slots.register({ name: "main", key: PANEL_ID, inject: () => ({ store, actions }) }, GalleryPage));

  // 슬롯 라벨은 문서 언어가 바뀌면 다시 등록한다(셸의 한국어 번역이 늦게 서는 경우).
  const locale = ctx.get("locale");
  const localeActive = () => {
    try { return String(locale?.getLocale?.()?.active ?? ""); } catch { return ""; }
  };
  const shellKorean = () => {
    const docLang = (() => { try { return String(document.documentElement?.lang ?? ""); } catch { return ""; } })();
    const active = docLang || localeActive();
    if (!active) return true;
    return active.toLowerCase().startsWith("ko");
  };
  ctx.slots.inject("sidebar.panellist", () => ctx.effect(() => {
    let dispose = null;
    let current = "";
    const mount = () => {
      const label = shellKorean() ? "깃헙 레포" : "GitHub repos";
      if (label === current) return;
      current = label;
      if (dispose) dispose();
      dispose = ctx.slots.register({ name: "sidebar.panellist", id: PANEL_ID, order: 40, label }, IconRepo);
    };
    mount();
    const observer = typeof MutationObserver === "function"
      ? new MutationObserver(() => mount())
      : null;
    observer?.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    const unsubscribe = typeof locale?.subscribe === "function" ? locale.subscribe(() => mount()) : null;
    return () => { observer?.disconnect(); if (typeof unsubscribe === "function") unsubscribe(); dispose?.(); };
  }, `${PLUGIN}: sidebar label`));

  const configForms = ctx.get("configForms");
  if (configForms) {
    ctx.slots.inject("plugins.row.config", () =>
      ctx.slots.register({ name: "plugins.row.config", key: `${PLUGIN}#${ENTRY_ID}` }, settingsPage(configForms.get(ENTRY_ID))));
  }
}

exports.inject = ["slots", "configForms"];
exports.apply = apply;
// 테스트가 마크다운 렌더러의 무한 루프 회귀를 직접 확인할 수 있게 둔다.
exports.__test = { inlineNodes, markdownBlocks };

return module.exports;
} });
