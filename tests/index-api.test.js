const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const INDEX_PATH = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(INDEX_PATH, "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (!scriptMatch) {
  throw new Error("index.htmlのAPI連携スクリプトが見つかりません");
}

test("既存デザインとAIアプリ研究所へのリンクを維持する", () => {
  assert.match(html, /href="\.\/assets\/style\.css"/);
  assert.match(html, /href="\.\/ai-app-lab\.html"/);
  assert.match(html, />\s*AIアプリ研究所\s*</);
  assert.doesNotMatch(html, /400字小説作成アプリ/);
});

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.className = "";
    this.href = "";
    this.textContent = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

async function runPage(fetchImplementation) {
  const storiesContainer = new FakeElement("section");
  const document = {
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => id === "stories" ? storiesContainer : null,
  };
  const context = {
    console: { error() {} },
    document,
    encodeURIComponent,
    fetch: fetchImplementation,
  };

  vm.runInNewContext(scriptMatch[1], context);
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  return storiesContainer;
}

test("APIの作品だけをカード全体のリンクとして表示する", async () => {
  let requestedUrl;
  let requestedOptions;
  const container = await runPage(async (url, options) => {
    requestedUrl = url;
    requestedOptions = options;
    return {
      ok: true,
      json: async () => [
        { id: 8, title: "公開作品", excerpt: "本文冒頭" },
        { id: 2, title: "別の公開作品", excerpt: "別の本文" },
      ],
    };
  });

  assert.equal(requestedUrl, "https://www.ichimoto-yoshio.com/api/stories");
  assert.equal(requestedOptions.cache, "no-store");
  assert.equal(container.children.length, 2);
  assert.equal(container.children[0].tagName, "a");
  assert.equal(container.children[0].className, "card-link");
  assert.equal(container.children[0].href, "https://www.ichimoto-yoshio.com/stories/8");
  assert.equal(container.children[0].children[0].className, "card");
  assert.equal(container.children[0].children[0].children[0].textContent, "《公開作品》");
});

test("公開作品が0件なら案内を表示する", async () => {
  const container = await runPage(async () => ({
    ok: true,
    json: async () => [],
  }));

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].textContent, "現在、公開中の作品はありません。");
});

test("APIエラーなら利用者向けエラーを表示する", async () => {
  const container = await runPage(async () => ({ ok: false }));

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].attributes.role, "alert");
  assert.equal(container.children[0].className, "load-error");
  assert.match(container.children[0].textContent, /作品を読み込めませんでした/);
});

test("不正なAPI応答をカード化しない", async () => {
  const container = await runPage(async () => ({
    ok: true,
    json: async () => [{ id: "8", title: "不正", excerpt: "本文" }],
  }));

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].attributes.role, "alert");
});
