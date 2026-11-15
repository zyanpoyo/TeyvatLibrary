<#
.SYNOPSIS
  星拾いの書架 — 公式コーパス自動照合＋類似語サジェスト付きガードレール検証スクリプト。

.DESCRIPTION
  index.html 内の STORIES データを検査し、以下の4項目を検証する：
  1. [意味的NG表記ブロック] official-entities.json の ngVariants（エイカンデル、ツァーリツァ等の誤記・俗称）を検出
  2. [公式コーパス照合＆類似語サジェスト]
     official-corpus.json（genshin-data 最新版＋収録済み原文から自動生成）と照合し、
     公式テキストに1度も登場しない未知のカタカナ語を検出する。
     検出時は「表記ゆれ正規化（長音・促音・ヴァ行/バ行）」および「レーベンシュタイン編集距離」で
     公式コーパスから最も近い表記候補を自動サジェストする。
  3. [出典根拠 (evidence) ＆ 確度区分チェック]
     すべての glossary 項目に evidence が設定され、identity に確度区分（正体：/真名：/鳴神名：/解説：/有力説：）があること
  4. [注釈タグ＆双方向リンク整合性チェック]
     本文中の {{term_id|...}} と glossary キーの完全一致、および connected リンク先の存在確認

.EXAMPLE
  pwsh -File .agents/skills/genshin-story-curator/scripts/validate-stories.ps1
#>

param(
  [string]$TargetHtml = "index.html",
  [string]$DictPath = ".agents/skills/genshin-story-curator/resources/official-entities.json",
  [string]$CorpusPath = ".agents/skills/genshin-story-curator/resources/official-corpus.json"
)

$ErrorActionPreference = "Stop"

# コーパスが未生成の場合は自動で sync-official-corpus.ps1 を実行して構築
if (-not (Test-Path $CorpusPath)) {
  Write-Host "official-corpus.json not found. Syncing from latest genshin-data..."
  $syncScript = Join-Path $PSScriptRoot "sync-official-corpus.ps1"
  & pwsh -File $syncScript -HtmlPath $TargetHtml -CorpusPath $CorpusPath
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

$validatorJs = @'
const fs = require("fs");

const htmlPath = process.argv[2];
const dictPath = process.argv[3];
const corpusPath = process.argv[4];

const html = fs.readFileSync(htmlPath, "utf8");
const dict = JSON.parse(fs.readFileSync(dictPath, "utf8"));
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));

const startMarker = "const STORIES = [";
const startIdx = html.indexOf(startMarker);
if (startIdx === -1) {
  console.error("ERROR: Could not find 'const STORIES = [' in " + htmlPath);
  process.exit(1);
}

let depth = 0, endIdx = -1, inStr = false, strCh = "", esc = false;
for (let i = startIdx + "const STORIES = ".length; i < html.length; i++) {
  const ch = html[i];
  if (esc) { esc = false; continue; }
  if (ch === "\\") { esc = true; continue; }
  if (inStr) { if (ch === strCh) inStr = false; continue; }
  if (ch === '"' || ch === "'" || ch === "`") { inStr = true; strCh = ch; continue; }
  if (ch === "[") depth++;
  else if (ch === "]") { depth--; if (depth === 0) { endIdx = i + 1; break; } }
}

const STORIES = Function('"use strict"; return (' + html.slice(startIdx + "const STORIES = ".length, endIdx) + ');')();

const corpusTermsMap = corpus.terms || {};
const corpusTermList = Object.keys(corpusTermsMap);

const approvedSet = new Set([
  ...corpusTermList,
  ...(dict.officialMediaTerms || []),
  ...(dict.allowedCommonKatakana || [])
]);

const ngMap = dict.ngVariants || {};
const validPrefixes = ["正体：", "真名：", "鳴神名：", "解説：", "有力説："];
const storyIds = new Set(STORIES.map(s => s.id));

// カタカナゆらぎ正規化（長音・促音・小書き文字・ヴァ行/バ行を吸収して候補を拾う）
function normalizeKatakana(str) {
  return str
    .replace(/ー/g, "")
    .replace(/ッ/g, "")
    .replace(/ヴァ/g, "バ").replace(/ヴィ/g, "ビ").replace(/ヴ/g, "ブ").replace(/ヴェ/g, "ベ").replace(/ヴォ/g, "ボ")
    .replace(/ファ/g, "ハ").replace(/フィ/g, "ヒ").replace(/フェ/g, "ヘ").replace(/フォ/g, "ホ")
    .replace(/ティ/g, "テ").replace(/ディ/g, "デ").replace(/ドゥ/g, "ド").replace(/トゥ/g, "ト")
    .replace(/ァ/g, "ア").replace(/ィ/g, "イ").replace(/ゥ/g, "ウ").replace(/ェ/g, "エ").replace(/ォ/g, "オ")
    .replace(/ャ/g, "ヤ").replace(/ュ/g, "ユ").replace(/ョ/g, "ヨ");
}

function normalizeLabial(str) {
  return normalizeKatakana(str)
    .replace(/[パバ]/g, "ハ").replace(/[ピビ]/g, "ヒ").replace(/[プブ]/g, "フ").replace(/[ペベ]/g, "ヘ").replace(/[ポボ]/g, "ホ");
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// コーパスの正規化インデックスを事前構築
const normalizedIndex = new Map();
const labialIndex = new Map();
for (const term of corpusTermList) {
  const norm = normalizeKatakana(term);
  if (!normalizedIndex.has(norm)) normalizedIndex.set(norm, []);
  normalizedIndex.get(norm).push(term);

  const lab = normalizeLabial(term);
  if (!labialIndex.has(lab)) labialIndex.set(lab, []);
  labialIndex.get(lab).push(term);
}

function suggestOfficialTerms(unknownWord) {
  const candidates = new Map();
  const normTarget = normalizeKatakana(unknownWord);
  const labTarget = normalizeLabial(unknownWord);

  // 1. 正規化キーが完全一致する公式表記を最優先
  for (const match of (normalizedIndex.get(normTarget) || [])) {
    candidates.set(match, 0);
  }
  for (const match of (labialIndex.get(labTarget) || [])) {
    if (!candidates.has(match)) candidates.set(match, 0.2);
  }

  // 2. 編集距離2以内の公式表記を探索（出現頻度も考慮）
  for (const term of corpusTermList) {
    if (candidates.has(term)) continue;
    if (Math.abs(term.length - unknownWord.length) > 2) continue;
    const dist = levenshtein(unknownWord, term);
    const normDist = levenshtein(normTarget, normalizeKatakana(term));
    const score = Math.min(dist, normDist + 0.5);
    if (score <= 2) {
      candidates.set(term, score);
    }
  }

  return [...candidates.entries()]
    .sort((a, b) => a[1] - b[1] || (corpusTermsMap[b[0]] || 0) - (corpusTermsMap[a[0]] || 0))
    .slice(0, 4)
    .map(([term]) => `「${term}」`);
}

const errors = [];

function checkText(text, contextLabel) {
  if (!text) return;
  for (const [ng, right] of Object.entries(ngMap)) {
    if (text.includes(ng)) {
      errors.push(`[NG固有名詞検出] ${contextLabel}: 「${ng}」が含まれています -> 公式表記「${right}」に修正してください。`);
    }
  }

  const stripped = text.replace(/\{\{[a-z0-9_]+\|([^}]+)\}\}/g, "$1");
  const katakanaMatches = stripped.match(/[ァ-ヴー]{2,}/g) || [];
  for (const word of katakanaMatches) {
    if (!approvedSet.has(word)) {
      const suggestions = suggestOfficialTerms(word);
      const hint = suggestions.length > 0
        ? ` もしかして公式表記: ${suggestions.join(", ")}`
        : " 公式テキスト（genshin-data / genshin-db）に見当たらない表記です。一般語なら allowedCommonKatakana を確認してください。";
      errors.push(`[公式コーパス未登録カタカナ] ${contextLabel}: 「${word}」は公式データ内に存在しません。${hint}`);
    }
  }
}

for (const story of STORIES) {
  const sid = story.id;
  checkText(story.title, `${sid}.title`);
  checkText(story.hook, `${sid}.hook`);
  checkText(story.overallTruth, `${sid}.overallTruth`);
  checkText(story.gameEffect, `${sid}.gameEffect`);
  (story.tags || []).forEach((t, i) => checkText(t, `${sid}.tags[${i}]`));
  (story.preGuide || []).forEach((g, i) => checkText(g, `${sid}.preGuide[${i}]`));

  for (const conn of story.connected || []) {
    if (!storyIds.has(conn.id)) {
      errors.push(`[リンク切れ] ${sid}.connected: 対象ID '${conn.id}' が STORIES 内に存在しません。`);
    }
    checkText(conn.relation, `${sid}.connected(${conn.id}).relation`);
    checkText(conn.desc, `${sid}.connected(${conn.id}).desc`);
  }

  const glossaryKeys = new Set(Object.keys(story.glossary || {}));
  const usedTerms = new Set();

  for (const [termId, info] of Object.entries(story.glossary || {})) {
    const gLabel = `${sid}.glossary.${termId}`;
    if (!info.evidence || info.evidence.trim().length === 0) {
      errors.push(`[出典根拠欠落] ${gLabel}: 'evidence'（根拠となる公式テキスト・アイテム名）が未設定です。`);
    }
    const hasValidPrefix = validPrefixes.some(p => (info.identity || "").startsWith(p));
    if (!hasValidPrefix) {
      errors.push(`[確度区分欠落] ${gLabel}: 'identity'（「${info.identity}」）は ${validPrefixes.join(" / ")} のいずれかで始めてください（未確定の考察は「有力説：」を使用）。`);
    }
    checkText(info.term, `${gLabel}.term`);
    checkText(info.identity, `${gLabel}.identity`);
    checkText(info.desc, `${gLabel}.desc`);
    checkText(info.evidence, `${gLabel}.evidence`);
  }

  (story.chapters || []).forEach((ch, cIdx) => {
    const cLabel = `${sid}.chapters[${cIdx}]`;
    checkText(ch.partLabel, `${cLabel}.partLabel`);
    checkText(ch.heading, `${cLabel}.heading`);
    checkText(ch.epigraph, `${cLabel}.epigraph`);
    checkText(ch.chapterNote, `${cLabel}.chapterNote`);

    (ch.paragraphs || []).forEach((p, pIdx) => {
      checkText(p, `${cLabel}.paragraphs[${pIdx}]`);
      const tagRegex = /\{\{([a-z0-9_]+)\|([^}]+)\}\}/g;
      let m;
      while ((m = tagRegex.exec(p)) !== null) {
        const tId = m[1];
        const surface = m[2];
        usedTerms.add(tId);
        if (!glossaryKeys.has(tId)) {
          errors.push(`[未定義用語タグ] ${cLabel}.paragraphs[${pIdx}]: {{${tId}|${surface}}} に対応する glossary.${tId} が存在しません。`);
        }
      }
    });
  });

  for (const gKey of glossaryKeys) {
    if (!usedTerms.has(gKey)) {
      errors.push(`[未使用glossary] ${sid}.glossary.${gKey}: 本文中のどこからも参照されていません。`);
    }
  }
}

if (errors.length > 0) {
  console.error(`\n❌ 検証失敗: ${errors.length} 件のガードレール違反が見つかりました:\n`);
  errors.forEach(e => console.error("  - " + e));
  process.exit(1);
} else {
  console.log(`✅ 検証成功: 全 ${STORIES.length} 作品（公式コーパス ${corpusTermList.length} 語照合・NG表記・出典evidence・確度ラベル・注釈タグ整合性）すべて問題ありません。`);
}
'@

$tempJs = Join-Path ([System.IO.Path]::GetTempPath()) ("validate_genshin_stories_" + [Guid]::NewGuid().ToString("N") + ".cjs")
$validatorJs | Out-File -FilePath $tempJs -Encoding utf8
try {
  node $tempJs $TargetHtml $DictPath $CorpusPath
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Remove-Item -Path $tempJs -ErrorAction SilentlyContinue
}
