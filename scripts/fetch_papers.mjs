#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PUBMED_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_FETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const USER_AGENT = "GamingDisorderBot/1.0 (research aggregator)";

const SUMMARIZED_PATH = resolve(ROOT, "docs", ".summarized_cache.json");

const SEARCH_QUERY = [
  '"Gaming Disorder"[tiab]',
  '"Internet Gaming Disorder"[tiab]',
  "IGD[tiab]",
  '"problematic gaming"[tiab]',
  '"problematic online gaming"[tiab]',
  '"video game addiction"[tiab]',
  '"gaming addiction"[tiab]',
  '"online gaming addiction"[tiab]',
  '"pathological gaming"[tiab]',
  '"compulsive gaming"[tiab]',
  "excessive gaming[tiab]",
  "digital gaming[tiab]",
  "video-gaming[tiab]",
].join(" OR ");

function getTaipeiDate() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" })
  );
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadSummarizedPmids() {
  if (!existsSync(SUMMARIZED_PATH)) return new Set();
  try {
    const data = JSON.parse(readFileSync(SUMMARIZED_PATH, "utf-8"));
    return new Set(data.pmids || []);
  } catch {
    return new Set();
  }
}

async function searchPubmed(query, retmax = 80) {
  const url = new URL(PUBMED_SEARCH);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("term", query);
  url.searchParams.set("retmax", String(retmax));
  url.searchParams.set("sort", "date");
  url.searchParams.set("retmode", "json");

  const resp = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`PubMed search HTTP ${resp.status}`);
  const data = await resp.json();
  return data?.esearchresult?.idlist || [];
}

async function fetchDetails(pmids) {
  if (!pmids.length) return [];
  const url = new URL(PUBMED_FETCH);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", pmids.join(","));
  url.searchParams.set("retmode", "xml");

  const resp = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(60000),
  });
  if (!resp.ok) throw new Error(`PubMed fetch HTTP ${resp.status}`);
  const xml = await resp.text();
  return parseXmlPapers(xml);
}

function parseXmlPapers(xml) {
  const papers = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) =>
      ["PubmedArticle", "AbstractText", "Keyword"].includes(name),
  });
  const root = parser.parse(xml);
  const articles = root?.PubmedArticleSet?.PubmedArticle || [];

  for (const article of articles) {
    try {
      const med = article.MedlineCitation;
      const art = med?.Article;
      if (!art) continue;

      const title = art.ArticleTitle || "";
      const abstractParts = [];
      const absTexts = art.Abstract?.AbstractText;
      if (absTexts) {
        for (const part of Array.isArray(absTexts) ? absTexts : [absTexts]) {
          const label = part["@_Label"] || "";
          const text = typeof part === "string" ? part : part["#text"] || "";
          if (label && text) abstractParts.push(`${label}: ${text}`);
          else if (text) abstractParts.push(text);
        }
      }
      const abstract = abstractParts.join(" ").slice(0, 2000);

      const journal = art.Journal?.Title || "";
      const pubDate = art.Journal?.JournalIssue?.PubDate;
      const dateParts = [
        pubDate?.Year,
        pubDate?.Month,
        pubDate?.Day,
      ].filter(Boolean);
      const dateStr = dateParts.join(" ");

      const pmid = String(med?.PMID || "");
      const url = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "";

      const kwList = med?.KeywordList?.Keyword || [];
      const keywords = (Array.isArray(kwList) ? kwList : [kwList])
        .map((k) => (typeof k === "string" ? k : k["#text"] || ""))
        .filter(Boolean);

      papers.push({
        pmid,
        title,
        journal,
        date: dateStr,
        abstract,
        url,
        keywords,
      });
    } catch {
      continue;
    }
  }
  return papers;
}

async function main() {
  const days = parseInt(process.env.FETCH_DAYS || "7", 10);
  const maxPapers = parseInt(process.env.MAX_PAPERS || "60", 10);
  const outputPath = process.env.OUTPUT_PATH || resolve(ROOT, "papers.json");

  const now = getTaipeiDate();
  const lookback = new Date(now);
  lookback.setDate(lookback.getDate() - days);
  const lookbackStr = `${lookback.getFullYear()}/${String(lookback.getMonth() + 1).padStart(2, "0")}/${String(lookback.getDate()).padStart(2, "0")}`;

  const dateFilter = `"${lookbackStr}"[Date - Publication] : "3000"[Date - Publication]`;
  const fullQuery = `(${SEARCH_QUERY}) AND ${dateFilter}`;

  console.error(`[INFO] Searching PubMed for gaming disorder papers (last ${days} days)...`);
  console.error(`[INFO] Query: ${fullQuery.slice(0, 200)}...`);

  let pmids;
  try {
    pmids = await searchPubmed(fullQuery, maxPapers);
  } catch (e) {
    console.error(`[ERROR] PubMed search failed: ${e.message}`);
    pmids = [];
  }
  console.error(`[INFO] Found ${pmids.length} papers`);

  if (!pmids.length) {
    const empty = { date: formatDate(now), count: 0, papers: [], new_count: 0 };
    writeFileSync(outputPath, JSON.stringify(empty, null, 2), "utf-8");
    console.error("[INFO] No papers found, saved empty result");
    return;
  }

  let papers;
  try {
    papers = await fetchDetails(pmids);
  } catch (e) {
    console.error(`[ERROR] PubMed fetch failed: ${e.message}`);
    papers = [];
  }
  console.error(`[INFO] Fetched details for ${papers.length} papers`);

  const summarized = loadSummarizedPmids();
  const newPapers = papers.filter((p) => !summarized.has(p.pmid));
  console.error(
    `[INFO] After dedup: ${newPapers.length} new papers (excluded ${papers.length - newPapers.length} already summarized)`
  );

  const output = {
    date: formatDate(now),
    count: papers.length,
    new_count: newPapers.length,
    papers: newPapers,
    all_pmids: papers.map((p) => p.pmid),
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
  console.error(`[INFO] Saved ${newPapers.length} new papers to ${outputPath}`);
}

main().catch((e) => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
