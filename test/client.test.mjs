import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function fakeReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useSyncExternalStore: (_sub, get) => get(),
  };
}

function loadClient() {
  let exported = null;
  const window = {
    __ModuleLoader__: {
      load({ factory }) {
        exported = factory((name) => {
          if (name === "react") return fakeReact();
          throw new Error(`unexpected require: ${name}`);
        });
      },
    },
  };
  const document = { documentElement: { lang: "ko" } };
  const source = fs.readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  const run = new Function("window", "document", "navigator", source);
  run(window, document, { language: "ko-KR" });
  return exported;
}

const flatten = (node) => {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  const props = node.props ?? {};
  return flatten(node.children);
};

test("popup panel is opaque while the area outside it stays transparent", () => {
  const source = fs.readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  const backdrop = /\.dsgh-detailBackdrop\{([^}]*)\}/.exec(source)?.[1] ?? "";
  const panel = /\.dsgh-detailPanel\{([^}]*)\}/.exec(source)?.[1] ?? "";
  assert.match(backdrop, /background:transparent/, "the area outside the popup must stay transparent");
  assert.ok(!backdrop.includes("linear-gradient"), "the backdrop must not paint an opaque layer over the page");
  assert.ok(!backdrop.includes("backdrop-filter"), "the backdrop must not blur the page");
  const layers = panel.match(/linear-gradient\(var\(--dsw-alias-bg-layer-2\)/g)?.length ?? 0;
  assert.ok(layers >= 3, "the popup panel itself must stack enough layers to be opaque");
  assert.ok(!panel.includes("backdrop-filter:blur"), "the popup must not rely on backdrop blur");
});

test("inline markdown terminates with nested emphasis and links", () => {
  const { inlineNodes } = loadClient().__test;
  const resolve = (href) => href;
  const nodes = inlineNodes("**bold with [a link](https://example.com)** and `code`", "k", resolve);
  const text = flatten(nodes);
  assert.match(text, /bold with a link/);
  assert.match(text, /code/);
});

test("block markdown renders headings, lists, fences, and tables", () => {
  const { markdownBlocks } = loadClient().__test;
  const source = [
    "# Title",
    "",
    "A paragraph with **bold** text.",
    "",
    "- one",
    "- two",
    "",
    "```js",
    "const x = 1;",
    "```",
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
  ].join("\n");
  const nodes = markdownBlocks(source, (href) => href);
  const types = nodes.map((node) => node.type);
  assert.ok(types.includes("h1"));
  assert.ok(types.includes("ul"));
  assert.ok(types.includes("pre"));
  assert.ok(types.includes("table"));
  assert.match(flatten(nodes), /A paragraph with bold text\./);
});

test("HTML images and links in a README become markdown nodes", () => {
  const { markdownBlocks } = loadClient().__test;
  const source = '<p align="center"><img src="./docs/screen.png" alt="screen"></p>\n\n<a href="https://github.com/o/r">repo</a>';
  const nodes = markdownBlocks(source, (href) => `resolved:${href}`);
  const text = flatten(nodes);
  assert.match(text, /repo/);
  const image = JSON.stringify(nodes);
  assert.match(image, /resolved:\.\/docs\/screen\.png/);
});
