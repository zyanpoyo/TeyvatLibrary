<#
.SYNOPSIS
  原神の武器・聖遺物・突破素材・書籍の日本語ストーリー生データを取得し、
  取得した公式原文内のカタカナ固有名詞を official-corpus.json へ自動学習させるヘルパースクリプト。

.DESCRIPTION
  - Type "artifact" | "weapon" | "material" | "windglider" | "outfit" : theBowja/genshin-db から日本語JSONを取得
  - Type "book" : dvaJi/genshin-data で書籍メタデータを確認し、gi.yatta.moe Readable API から各巻の日本語本文を取得
  - 取得したすべての公式原文（name, description, story, text）内のカタカナ語を
    official-corpus.json の terms および customLoreTerms に自動マージする（自己汚染なし）。
  ※ GitHub (theBowja/genshin-db, dvaJi/genshin-data) への通信を含むため、セッション初回実行時はユーザー承認を得てから実行すること。

.EXAMPLE
  pwsh .agents/skills/genshin-story-curator/scripts/fetch-genshin-lore.ps1 -Type artifact -Id crimsonwitchofflames
  pwsh .agents/skills/genshin-story-curator/scripts/fetch-genshin-lore.ps1 -Type weapon -Id elegyfortheend
  pwsh .agents/skills/genshin-story-curator/scripts/fetch-genshin-lore.ps1 -Type book -Id the_byakuyakoku_collection
#>

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("artifact", "weapon", "material", "windglider", "outfit", "book")]
  [string]$Type,

  [Parameter(Mandatory = $true)]
  [string]$Id,

  [string]$OutFile = "",
  [string]$CorpusPath = ".agents/skills/genshin-story-curator/resources/official-corpus.json"
)

$ErrorActionPreference = "Stop"

if ($Type -eq "book") {
  $metaUrl = "https://raw.githubusercontent.com/dvaJi/genshin-data/master/src/data/japanese/books/$Id.json"
  Write-Host "Fetching book metadata from: $metaUrl"
  $meta = Invoke-RestMethod -Uri $metaUrl

  $bookId = $meta._id
  $yattaBookUrl = "https://gi.yatta.moe/api/v2/jp/book/$bookId"
  Write-Host "Fetching volume index from: $yattaBookUrl"
  $yattaBook = Invoke-RestMethod -Uri $yattaBookUrl

  $volumes = @()
  foreach ($vol in $yattaBook.data.volume) {
    $storyId = $vol.storyId
    $readableUrl = "https://gi.yatta.moe/api/v2/jp/readable/Book$storyId"
    Write-Host "  Fetching volume '$($vol.name)' (Book$storyId)..."
    $readable = Invoke-RestMethod -Uri $readableUrl
    $volumes += [PSCustomObject]@{
      id          = $vol.id
      name        = $vol.name
      description = $vol.description
      storyId     = $storyId
      text        = $readable.data
    }
  }

  $result = [PSCustomObject]@{
    _id     = $meta._id
    id      = $meta.id
    name    = $meta.name
    rarity  = $meta.rarity
    volumes = $volumes
  }
} else {
  $folderMap = @{
    artifact   = "artifacts"
    weapon     = "weapons"
    material   = "materials"
    windglider = "windgliders"
    outfit     = "outfits"
  }
  $folder = $folderMap[$Type]
  $url = "https://raw.githubusercontent.com/theBowja/genshin-db/main/src/data/Japanese/$folder/$Id.json"
  Write-Host "Fetching $Type data from: $url"
  $result = Invoke-RestMethod -Uri $url
}

$json = $result | ConvertTo-Json -Depth 8

# 取得した公式生データからカタカナ語を official-corpus.json へ自動学習
$mergeJs = @'
const fs = require("fs");
const path = require("path");

const corpusPath = process.argv[2];
const rawJson = fs.readFileSync(0, "utf8");
let data;
try {
  data = JSON.parse(rawJson);
} catch {
  process.exit(0);
}

const found = new Map();
function walk(val) {
  if (typeof val === "string") {
    const matches = val.match(/[ァ-ヴー]{2,}/g);
    if (matches) {
      for (const m of matches) found.set(m, (found.get(m) || 0) + 1);
    }
  } else if (Array.isArray(val)) {
    for (const item of val) walk(item);
  } else if (val && typeof val === "object") {
    for (const [k, v] of Object.entries(val)) {
      if (k === "id" || k === "icon" || k === "route" || k === "relicType" || k === "weaponType" || k === "mainStatType" || k === "category") continue;
      walk(v);
    }
  }
}
walk(data);

if (found.size === 0) process.exit(0);

let corpus = { meta: {}, terms: {}, customLoreTerms: {} };
if (fs.existsSync(corpusPath)) {
  try {
    corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
  } catch {}
}
corpus.terms = corpus.terms || {};
corpus.customLoreTerms = corpus.customLoreTerms || {};

let added = 0;
for (const [term, count] of found.entries()) {
  if (!corpus.terms[term]) added++;
  corpus.terms[term] = (corpus.terms[term] || 0) + count;
  corpus.customLoreTerms[term] = (corpus.customLoreTerms[term] || 0) + count;
}
corpus.meta = corpus.meta || {};
corpus.meta.termCount = Object.keys(corpus.terms).length;
corpus.meta.updatedAt = new Date().toISOString();

fs.mkdirSync(path.dirname(corpusPath), { recursive: true });
fs.writeFileSync(corpusPath, JSON.stringify(corpus, null, 2), "utf8");
console.error(`[Corpus] Merged ${found.size} katakana terms (${added} new) into ${corpusPath}`);
'@

$tempMergeJs = Join-Path ([System.IO.Path]::GetTempPath()) ("merge_corpus_" + [Guid]::NewGuid().ToString("N") + ".cjs")
$mergeJs | Out-File -FilePath $tempMergeJs -Encoding utf8
try {
  $json | node $tempMergeJs $CorpusPath
} finally {
  Remove-Item -Path $tempMergeJs -ErrorAction SilentlyContinue
}

if ($OutFile -ne "") {
  $json | Out-File -FilePath $OutFile -Encoding utf8
  Write-Host "Saved output to $OutFile"
} else {
  Write-Output $json
}
