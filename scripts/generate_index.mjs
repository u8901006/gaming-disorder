#!/usr/bin/env node
import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DOCS = resolve(ROOT, "docs");

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function getFiles() {
  try {
    return readdirSync(DOCS)
      .filter((f) => f.startsWith("gaming-") && f.endsWith(".html"))
      .sort()
      .reverse()
      .slice(0, 30);
  } catch {
    return [];
  }
}

function formatDate(filename) {
  const date = filename.replace("gaming-", "").replace(".html", "");
  const parts = date.split("-");
  if (parts.length !== 3) return { display: date, weekday: "" };
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const weekday = WEEKDAYS[d.getDay()] || "";
  const display = `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  return { display, weekday };
}

function main() {
  const files = getFiles();
  const total = files.length;

  const links = files
    .map((f) => {
      const { display, weekday } = formatDate(f);
      return `<li><a href="${f}">📅 ${display}（週${weekday}）</a></li>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Gaming Disorder Research · 遊戲障礙研究文獻日報</title>
<style>
  :root { --bg: #f6f1e8; --surface: #fffaf2; --line: #d8c5ab; --text: #2b2118; --muted: #766453; --accent: #8c4f2b; --accent-soft: #ead2bf; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: radial-gradient(circle at top, #fff6ea 0, var(--bg) 55%, #ead8c6 100%); color: var(--text); font-family: "Noto Sans TC", "PingFang TC", "Helvetica Neue", Arial, sans-serif; min-height: 100vh; }
  .container { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 80px 24px; }
  .logo { font-size: 48px; text-align: center; margin-bottom: 16px; }
  h1 { text-align: center; font-size: 24px; color: var(--text); margin-bottom: 8px; }
  .subtitle { text-align: center; color: var(--accent); font-size: 14px; margin-bottom: 48px; }
  .count { text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 32px; }
  ul { list-style: none; }
  li { margin-bottom: 8px; }
  a { color: var(--text); text-decoration: none; display: block; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: all 0.2s; font-size: 15px; }
  a:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  footer { margin-top: 56px; text-align: center; font-size: 12px; color: var(--muted); }
  footer a { display: inline; padding: 0; background: none; border: none; color: var(--muted); }
  footer a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <div class="logo">🎮</div>
  <h1>Gaming Disorder Research</h1>
  <p class="subtitle">遊戲障礙研究文獻日報 · 每日自動更新</p>
  <p class="count">共 ${total} 期日報</p>
  <ul>${links}</ul>
  <footer>
    <p>Powered by PubMed + Zhipu AI · <a href="https://github.com/u8901006/gaming-disorder">GitHub</a></p>
  </footer>
</div>
</body>
</html>`;

  writeFileSync(resolve(DOCS, "index.html"), html, "utf-8");
  console.error(`[INFO] Index page generated (${total} reports)`);
}

main();
