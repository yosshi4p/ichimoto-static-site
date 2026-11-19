const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const LAB_PATH = path.join(__dirname, "..", "ai-app-lab.html");
const html = fs.readFileSync(LAB_PATH, "utf8");

test("歴史の深層（試作版）を指定の紹介文とリンクで表示する", () => {
  assert.match(html, /<h3>歴史の深層（試作版）<\/h3>/);
  assert.match(
    html,
    /幕末日本・第一次世界大戦・ローマ共和政を舞台に、\s*史料を読み、因果関係をつなぎ、歴史の別の可能性を考える\s*知的シミュレーションゲーム。/,
  );
  assert.match(html, /href="https:\/\/history-depth\.onrender\.com\/"/);
});

test("歴史ifシミュレーターを指定の紹介文とリンクで表示する", () => {
  assert.match(html, /<h3>歴史ifシミュレーター<\/h3>/);
  assert.match(
    html,
    /もし歴史の分岐点が変わっていたら？ AIがもう一つの世界を描く。/,
  );
  assert.match(html, /href="https:\/\/history-if-simulator\.onrender\.com"/);
});

test("400字小説集、既存デザイン、他のアプリへのリンクを維持する", () => {
  assert.match(html, /href="\.\/assets\/style\.css"/);
  assert.match(html, /href="\.\/index\.html"/);
  assert.match(html, /<h3>400字小説作成アプリ<\/h3>/);

  const existingLinks = [
    "https://history-depth.onrender.com/",
    "https://www.ichimoto-yoshio.com/",
    "./shogi-advisor/index.html",
    "https://ai-lab-life-advice-agent-flask.onrender.com",
    "https://aikyo-training-ai.onrender.com",
    "https://ebisu-sapporo-finder.onrender.com",
    "https://party-game-agent.onrender.com",
    "https://banquet-planner-ai.onrender.com",
    "https://aisai-plan-agent.onrender.com",
    "https://travel-plan-agent-e3n3.onrender.com",
  ];

  for (const link of existingLinks) {
    assert.ok(html.includes(`href="${link}"`), `${link} が維持されていません`);
  }
});
