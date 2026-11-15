<#
.SYNOPSIS
  原神の最新公式日本語データ（genshin-data + genshin-db npmパッケージ）および収録済み原文から
  検証済みカタカナ固有名詞コーパス（official-corpus.json）を自動生成・更新する。

.DESCRIPTION
  1. npmレジストリから最新の genshin-data パッケージ（tarball）を取得し、
     全日本語データ（キャラ、ボイス、アチーブメント、任務、地誌など）からカタカナ語を抽出する。
  2. npmレジストリから最新の genshin-db パッケージ（tarball）を取得し、
     data.min.json 内の Japanese セクション全体（全武器・全聖遺物・全ボス素材の story 本文を含む）から
     カタカナ語を抽出する。
  3. index.html に既に収録されている原典テキスト（epigraph, paragraphs ※解説部は除外）の
     カタカナ語も統合し、自己汚染を防ぎつつ書籍Readable等にのみ存在する語彙を網羅する。
  4. 結果は .agents/skills/genshin-story-curator/resources/official-corpus.json に保存される。

.EXAMPLE
  pwsh -File .agents/skills/genshin-story-curator/scripts/sync-official-corpus.ps1
#>

param(
  [string]$HtmlPath = "index.html",
  [string]$CorpusPath = ".agents/skills/genshin-story-curator/resources/official-corpus.json"
)

$ErrorActionPreference = "Stop"

Write-Host "Checking latest genshin-data and genshin-db packages on npm registry..."
$pkgData = Invoke-RestMethod -Uri "https://registry.npmjs.org/genshin-data/latest"
$pkgDb = Invoke-RestMethod -Uri "https://registry.npmjs.org/genshin-db/latest"
Write-Host "Found genshin-data v$($pkgData.version), genshin-db v$($pkgDb.version)"

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("genshin-corpus-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

try {
  $tgzData = Join-Path $tmpDir "genshin-data.tgz"
  $tgzDb = Join-Path $tmpDir "genshin-db.tgz"

  Write-Host "Downloading npm tarballs..."
  Invoke-WebRequest -Uri $pkgData.dist.tarball -OutFile $tgzData
  Invoke-WebRequest -Uri $pkgDb.dist.tarball -OutFile $tgzDb

  Write-Host "Extracting Japanese datasets..."
  $dataDir = Join-Path $tmpDir "gdata"
  $dbDir = Join-Path $tmpDir "gdb"
  New-Item -ItemType Directory -Force -Path $dataDir, $dbDir | Out-Null

  tar -zxf $tgzData -C $dataDir "package/dist/data_japanese_*.cjs"
  tar -zxf $tgzDb -C $dbDir "package/src/min/data.min.json"

  $extractJs = @'
const fs = require("fs");
const path = require("path");

const dataDistDir = process.argv[2];
const dbJsonPath = process.argv[3];
const htmlPath = process.argv[4];
const corpusPath = process.argv[5];
const dataVersion = process.argv[6];
const dbVersion = process.argv[7];

const termCounts = new Map();

function addTermsFromText(text, weight = 1) {
  if (typeof text !== "string" || !text) return;
  const matches = text.match(/[ァ-ヴー]{2,}/g);
  if (!matches) return;
  for (const m of matches) {
    termCounts.set(m, (termCounts.get(m) || 0) + weight);
  }
}

function walkValue(val, keyName = "") {
  if (typeof val === "string") {
    const weight = (keyName === "name" || keyName === "title") ? 5 : 1;
    addTermsFromText(val, weight);
  } else if (Array.isArray(val)) {
    for (const item of val) walkValue(item, keyName);
  } else if (val && typeof val === "object") {
    for (const [k, v] of Object.entries(val)) {
      if (k === "id" || k === "icon" || k === "route" || k === "relicType" || k === "weaponType" || k === "mainStatType" || k === "category" || k === "images" || k === "url") continue;
      walkValue(v, k);
    }
  }
}

// 1. 過去に fetch-genshin-lore.ps1 等で取り込んだ長文原文分を維持
const customLoreCounts = new Map();
if (fs.existsSync(corpusPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
    if (existing.customLoreTerms) {
      for (const [t, c] of Object.entries(existing.customLoreTerms)) {
        const num = Number(c || 1);
        termCounts.set(t, (termCounts.get(t) || 0) + num);
        customLoreCounts.set(t, num);
      }
    }
  } catch {}
}

// 2. genshin-data の全日本語モジュールを走査
const dataFiles = fs.readdirSync(dataDistDir).filter(f => f.startsWith("data_japanese_") && f.endsWith(".cjs"));
for (const file of dataFiles) {
  const mod = require(path.join(dataDistDir, file));
  walkValue(mod.default || mod);
}

// 3. genshin-db の data.Japanese 全体（武器・聖遺物・ボス素材の story 全文を含む）を走査
let dbFolderCount = 0;
if (fs.existsSync(dbJsonPath)) {
  const dbRoot = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
  const jpDb = dbRoot?.data?.Japanese;
  if (jpDb) {
    dbFolderCount = Object.keys(jpDb).length;
    walkValue(jpDb);
  }
}

// 4. index.html 内の「原典テキスト（epigraph / paragraphs）」のみを走査（※解説部による自己汚染は防止）
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const startMarker = "const STORIES = [";
  const startIdx = html.indexOf(startMarker);
  if (startIdx !== -1) {
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
    if (endIdx !== -1) {
      const STORIES = Function('"use strict"; return (' + html.slice(startIdx + "const STORIES = ".length, endIdx) + ');')();
      for (const story of STORIES) {
        addTermsFromText(story.title, 3);
        for (const ch of (story.chapters || [])) {
          const ep = ch.epigraph || "";
          addTermsFromText(ep, 2);
          for (const m of (ep.match(/[ァ-ヴー]{2,}/g) || [])) {
            customLoreCounts.set(m, (customLoreCounts.get(m) || 0) + 1);
          }
          for (const p of (ch.paragraphs || [])) {
            const plain = p.replace(/\{\{[a-z0-9_]+\|([^}]+)\}\}/g, "$1");
            addTermsFromText(plain, 2);
            for (const m of (plain.match(/[ァ-ヴー]{2,}/g) || [])) {
              customLoreCounts.set(m, (customLoreCounts.get(m) || 0) + 1);
            }
          }
        }
      }
    }
  }
}

const sortedTerms = Object.fromEntries([...termCounts.entries()].sort((a, b) => b[1] - a[1]));
const sortedCustom = Object.fromEntries([...customLoreCounts.entries()].sort((a, b) => b[1] - a[1]));

const output = {
  meta: {
    source: "genshin-data (npm) + genshin-db (npm) + verified raw lore texts",
    genshinDataVersion: dataVersion,
    genshinDbVersion: dbVersion,
    updatedAt: new Date().toISOString(),
    dataModuleCount: dataFiles.length,
    dbFolderCount: dbFolderCount,
    termCount: termCounts.size
  },
  terms: sortedTerms,
  customLoreTerms: sortedCustom
};

fs.mkdirSync(path.dirname(corpusPath), { recursive: true });
fs.writeFileSync(corpusPath, JSON.stringify(output, null, 2), "utf8");
console.log(`Synced official corpus: ${termCounts.size} unique katakana terms (genshin-data v${dataVersion} [${dataFiles.length} modules] + genshin-db v${dbVersion} [${dbFolderCount} folders]).`);
'@

  $extractJsPath = Join-Path $tmpDir "extract_corpus.cjs"
  $extractJs | Out-File -FilePath $extractJsPath -Encoding utf8
  $dataDistDir = Join-Path $dataDir "package\dist"
  $dbJsonPath = Join-Path $dbDir "package\src\min\data.min.json"

  node $extractJsPath $dataDistDir $dbJsonPath $HtmlPath $CorpusPath $pkgData.version $pkgDb.version
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
