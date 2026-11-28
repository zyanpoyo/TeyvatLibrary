import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { resolveSitemapOrigin } from "./post-build-seo.mjs";

const require = createRequire(import.meta.url);

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_TEMPLATE_VERSION = "v4";
const OUTER_PADDING = 28;
const INNER_WIDTH = OG_IMAGE_WIDTH - OUTER_PADDING * 2;
const INNER_HEIGHT = OG_IMAGE_HEIGHT - OUTER_PADDING * 2;

const SITE_BRAND_TITLE = "テイワット文庫";

function el(type, props, ...children) {
  const flatChildren = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  return {
    type,
    props: {
      ...props,
      ...(flatChildren.length === 1
        ? { children: flatChildren[0] }
        : flatChildren.length > 1
          ? { children: flatChildren }
          : {}),
    },
  };
}

function truncateText(text, maxChars) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) return normalized;
  return `${chars.slice(0, Math.max(1, maxChars - 1)).join("")}…`;
}

function resolveDisplayHost(siteUrl) {
  const origin = resolveSitemapOrigin(siteUrl);
  try {
    return new URL(origin).host;
  } catch {
    return "teyvat-bunko.com";
  }
}

function parseUnicodeRangeSpec(spec) {
  const ranges = [];
  for (const part of String(spec || "").split(",")) {
    const match = /^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i.exec(part.trim());
    if (!match) continue;
    const start = Number.parseInt(match[1], 16);
    const end = match[2] ? Number.parseInt(match[2], 16) : start;
    ranges.push([start, end]);
  }
  return ranges;
}

function loadFontSubsetIndex(fontPkgDir) {
  const unicodeJson = JSON.parse(
    fs.readFileSync(path.join(fontPkgDir, "unicode.json"), "utf8")
  );
  return Object.entries(unicodeJson).map(([rawKey, spec]) => ({
    subset: rawKey.replace(/^\[|\]$/g, ""),
    ranges: parseUnicodeRangeSpec(spec),
  }));
}

function collectFontResources(texts, fontPkgDir) {
  const subsetIndex = loadFontSubsetIndex(fontPkgDir);
  const codePoints = new Set();
  for (const text of texts) {
    for (const ch of String(text || "")) {
      const cp = ch.codePointAt(0);
      if (cp === undefined || cp <= 0x1f || cp === 0x7f) continue;
      codePoints.add(cp);
    }
  }

  const neededSubsets = new Set(["latin"]);
  const missingChars = [];

  for (const cp of codePoints) {
    let matchedSubset = null;
    for (const entry of subsetIndex) {
      if (entry.ranges.some(([start, end]) => cp >= start && cp <= end)) {
        matchedSubset = entry.subset;
        break;
      }
    }
    if (matchedSubset) {
      neededSubsets.add(matchedSubset);
    } else if (!/\s/.test(String.fromCodePoint(cp))) {
      missingChars.push(`${String.fromCodePoint(cp)} (U+${cp.toString(16).toUpperCase()})`);
    }
  }

  const orderedSubsets = [...neededSubsets].sort((a, b) => {
    if (a === "latin") return -1;
    if (b === "latin") return 1;
    return a.localeCompare(b, "en", { numeric: true });
  });

  const fonts = [];
  const names500 = [];
  const names700 = [];

  for (const subset of orderedSubsets) {
    const file500 = path.join(fontPkgDir, "files", `shippori-mincho-${subset}-500-normal.woff`);
    const file700 = path.join(fontPkgDir, "files", `shippori-mincho-${subset}-700-normal.woff`);
    if (fs.existsSync(file500)) {
      const name = `ShipporiMincho500_${subset}`;
      fonts.push({
        name,
        data: fs.readFileSync(file500),
        weight: 500,
        style: "normal",
      });
      names500.push(name);
    }
    if (fs.existsSync(file700)) {
      const name = `ShipporiMincho700_${subset}`;
      fonts.push({
        name,
        data: fs.readFileSync(file700),
        weight: 700,
        style: "normal",
      });
      names700.push(name);
    }
  }

  return {
    fonts,
    fontFamily500: names500.join(", "),
    fontFamily700: names700.join(", "),
    missingChars,
  };
}

function renderStarEmblem(size = 24) {
  return el(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
    },
    el("path", {
      d: "M12 2L14.3 9.7L22 12L14.3 14.3L12 22L9.7 14.3L2 12L9.7 9.7L12 2Z",
      fill: "#d8b878",
    })
  );
}

function renderConstellationOverlay() {
  return el(
    "svg",
    {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      viewBox: `0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}`,
      style: {
        position: "absolute",
        top: 0,
        left: 0,
      },
    },
    el("circle", {
      cx: 1020,
      cy: 120,
      r: 230,
      stroke: "rgba(216, 184, 120, 0.14)",
      strokeWidth: 1.5,
      fill: "none",
    }),
    el("circle", {
      cx: 1020,
      cy: 120,
      r: 150,
      stroke: "rgba(142, 166, 200, 0.14)",
      strokeWidth: 1,
      strokeDasharray: "6 8",
      fill: "none",
    }),
    el("circle", {
      cx: 160,
      cy: 540,
      r: 180,
      stroke: "rgba(216, 184, 120, 0.08)",
      strokeWidth: 1,
      fill: "none",
    }),
    el("circle", { cx: 1090, cy: 96, r: 3.5, fill: "rgba(244, 228, 191, 0.55)" }),
    el("circle", { cx: 935, cy: 195, r: 2.5, fill: "rgba(216, 184, 120, 0.45)" }),
    el("circle", { cx: 1135, cy: 235, r: 2, fill: "rgba(142, 166, 200, 0.45)" })
  );
}

function wrapOgCardShell({ topLeft, topRight, body, footerLeft, displayHost, fontFamily500, fontFamily700 }) {
  return el(
    "div",
    {
      style: {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        display: "flex",
        position: "relative",
        boxSizing: "border-box",
        backgroundColor: "#0b101c",
        backgroundImage: "linear-gradient(145deg, #162342 0%, #0d1426 52%, #070b14 100%)",
        color: "#ece7dc",
        fontFamily: fontFamily500,
      },
    },
    renderConstellationOverlay(),
    el(
      "div",
      {
        style: {
          position: "absolute",
          top: OUTER_PADDING,
          left: OUTER_PADDING,
          width: INNER_WIDTH,
          height: INNER_HEIGHT,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          border: "1.5px solid rgba(216, 184, 120, 0.44)",
          borderRadius: "18px",
          padding: "34px 48px 28px 48px",
          backgroundColor: "rgba(11, 16, 28, 0.56)",
        },
      },
      el(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          },
        },
        topLeft,
        topRight ||
          el(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#d8b878",
                fontSize: "23px",
                fontWeight: 700,
                fontFamily: fontFamily700,
              },
            },
            renderStarEmblem(22),
            el("span", {}, SITE_BRAND_TITLE)
          )
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flexGrow: 1,
            paddingTop: "16px",
            paddingBottom: "16px",
          },
        },
        body
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(216, 184, 120, 0.28)",
            paddingTop: "18px",
            width: "100%",
          },
        },
        footerLeft,
        el(
          "span",
          {
            style: {
              fontSize: "21px",
              color: "#d8b878",
              fontWeight: 500,
              fontFamily: fontFamily500,
              letterSpacing: "0.02em",
              flexShrink: 0,
            },
          },
          displayHost
        )
      )
    )
  );
}

function selectStoryOgPills(tags, maxPills = 3, maxTotalChars = 30) {
  const result = [];
  let total = 0;
  for (const raw of tags || []) {
    if (result.length >= maxPills) break;
    const label = truncateText(raw, 18);
    if (!label) continue;
    const len = Array.from(label).length;
    if (result.length > 0 && total + len > maxTotalChars) break;
    result.push(label);
    total += len;
  }
  return result;
}

function buildStoryOgNode(story, { displayHost, fontFamily500, fontFamily700 }) {
  const titleText = truncateText(story.title, 44);
  const titleLen = Array.from(titleText).length;
  const titleSize = titleLen <= 14 ? 54 : titleLen <= 24 ? 46 : 38;
  const hookText = truncateText(story.hook, 92);
  const pills = selectStoryOgPills(story.tags);
  const regionLabel = Array.isArray(story.region) ? story.region.slice(0, 2).join(" / ") : "";

  return wrapOgCardShell({
    displayHost,
    fontFamily500,
    fontFamily700,
    topLeft: el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "12px",
        },
      },
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            padding: "8px 18px",
            borderRadius: "999px",
            border: "1px solid rgba(216, 184, 120, 0.55)",
            backgroundColor: "rgba(216, 184, 120, 0.14)",
            color: "#f4e4bf",
            fontSize: "21px",
            fontWeight: 700,
            fontFamily: fontFamily700,
          },
        },
        story.categoryLabel
      ),
      regionLabel
        ? el(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                padding: "8px 16px",
                borderRadius: "999px",
                border: "1px solid rgba(142, 166, 200, 0.34)",
                backgroundColor: "rgba(142, 166, 200, 0.1)",
                color: "#c6d2e8",
                fontSize: "19px",
                fontWeight: 500,
                fontFamily: fontFamily500,
              },
            },
            regionLabel
          )
        : null
    ),
    body: el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          marginTop: "8px",
          marginBottom: "8px",
        },
      },
      el(
        "div",
        {
          style: {
            fontSize: `${titleSize}px`,
            lineHeight: 1.3,
            fontWeight: 700,
            fontFamily: fontFamily700,
            color: "#f4e4bf",
          },
        },
        titleText
      ),
      el(
        "div",
        {
          style: {
            fontSize: "25px",
            lineHeight: 1.6,
            fontWeight: 500,
            fontFamily: fontFamily500,
            color: "#e6e2d8",
          },
        },
        hookText
      )
    ),
    footerLeft: el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "nowrap",
          maxWidth: "780px",
          overflow: "hidden",
        },
      },
      ...pills.map((pill) =>
        el(
          "div",
          {
            style: {
              display: "flex",
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(167, 177, 199, 0.26)",
              backgroundColor: "rgba(18, 25, 44, 0.85)",
              color: "#a7b1c7",
              fontSize: "18px",
              fontWeight: 500,
              fontFamily: fontFamily500,
            },
          },
          pill
        )
      )
    ),
  });
}

function buildSiteOgNode({ totalCount, displayHost, fontFamily500, fontFamily700 }) {
  const subtitle =
    typeof totalCount === "number" && totalCount > 0
      ? `原神 聖遺物・武器・書籍・風の翼・育成素材 ストーリー全${totalCount}篇`
      : "原神 聖遺物・武器・書籍・風の翼・育成素材 ストーリーリーダー";

  return wrapOgCardShell({
    displayHost,
    fontFamily500,
    fontFamily700,
    topLeft: el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          padding: "8px 18px",
          borderRadius: "999px",
          border: "1px solid rgba(216, 184, 120, 0.55)",
          backgroundColor: "rgba(216, 184, 120, 0.14)",
          color: "#f4e4bf",
          fontSize: "20px",
          fontWeight: 700,
          fontFamily: fontFamily700,
        },
      },
      "非公式 原神物語アーカイブ"
    ),
    topRight: el("div", { style: { display: "flex" } }, renderStarEmblem(32)),
    body: el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        },
      },
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "18px",
            fontSize: "64px",
            fontWeight: 700,
            fontFamily: fontFamily700,
            color: "#f4e4bf",
            lineHeight: 1.2,
          },
        },
        SITE_BRAND_TITLE
      ),
      el(
        "div",
        {
          style: {
            fontSize: "27px",
            fontWeight: 500,
            fontFamily: fontFamily500,
            color: "#e6e2d8",
            lineHeight: 1.55,
          },
        },
        subtitle
      ),
      el(
        "div",
        {
          style: {
            fontSize: "22px",
            fontWeight: 500,
            fontFamily: fontFamily500,
            color: "#a7b1c7",
            lineHeight: 1.5,
          },
        },
        "原文改変なし・時系列再構成・インライン用語ガイド・作品間リンクで小説感覚に通読"
      )
    ),
    footerLeft: el(
      "div",
      {
        style: {
          display: "flex",
          gap: "10px",
        },
      },
      ...["書籍", "聖遺物", "武器", "風の翼", "突破・育成素材"].map((cat) =>
        el(
          "div",
          {
            style: {
              display: "flex",
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(216, 184, 120, 0.3)",
              backgroundColor: "rgba(216, 184, 120, 0.08)",
              color: "#f4e4bf",
              fontSize: "18px",
              fontFamily: fontFamily500,
            },
          },
          cat
        )
      )
    ),
  });
}

function buildAboutOgNode({ displayHost, fontFamily500, fontFamily700 }) {
  return wrapOgCardShell({
    displayHost,
    fontFamily500,
    fontFamily700,
    topLeft: el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          padding: "8px 18px",
          borderRadius: "999px",
          border: "1px solid rgba(216, 184, 120, 0.55)",
          backgroundColor: "rgba(216, 184, 120, 0.14)",
          color: "#f4e4bf",
          fontSize: "20px",
          fontWeight: 700,
          fontFamily: fontFamily700,
        },
      },
      "About / サイト案内"
    ),
    body: el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        },
      },
      el(
        "div",
        {
          style: {
            fontSize: "54px",
            fontWeight: 700,
            fontFamily: fontFamily700,
            color: "#f4e4bf",
            lineHeight: 1.3,
          },
        },
        "このサイトについて"
      ),
      el(
        "div",
        {
          style: {
            fontSize: "25px",
            fontWeight: 500,
            fontFamily: fontFamily500,
            color: "#e6e2d8",
            lineHeight: 1.6,
          },
        },
        "運営方針・著作権と引用の取り扱い・GA4 アクセス解析オプトアウト・ブラウザ保存データ・免責事項・お問い合わせ窓口のご案内"
      )
    ),
    footerLeft: el(
      "div",
      {
        style: {
          fontSize: "19px",
          color: "#a7b1c7",
          fontFamily: fontFamily500,
        },
      },
      "非公式ファンアーカイブ・完全静的配信"
    ),
  });
}

const COURSE_KIND_OG_LABELS = {
  beginner: "入門・必読",
  character: "キャラクター別",
  arc: "地域・歴史別",
};

const ENTITY_KIND_OG_LABELS = {
  character: "人物",
  god: "魔神・執政",
  organization: "組織",
  concept: "歴史・重要用語",
  place: "地域・地名",
};

function buildCollectionIndexOgNode({
  badgeLabel,
  headline,
  summaryLine,
  leadText,
  footerChips,
  displayHost,
  fontFamily500,
  fontFamily700,
}) {
  return wrapOgCardShell({
    displayHost,
    fontFamily500,
    fontFamily700,
    topLeft: el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          padding: "8px 18px",
          borderRadius: "999px",
          border: "1px solid rgba(216, 184, 120, 0.55)",
          backgroundColor: "rgba(216, 184, 120, 0.14)",
          color: "#f4e4bf",
          fontSize: "20px",
          fontWeight: 700,
          fontFamily: fontFamily700,
        },
      },
      badgeLabel
    ),
    body: el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        },
      },
      el(
        "div",
        {
          style: {
            fontSize: "54px",
            fontWeight: 700,
            fontFamily: fontFamily700,
            color: "#f4e4bf",
            lineHeight: 1.3,
          },
        },
        headline
      ),
      el(
        "div",
        {
          style: {
            fontSize: "26px",
            fontWeight: 500,
            fontFamily: fontFamily500,
            color: "#e6e2d8",
            lineHeight: 1.55,
          },
        },
        summaryLine
      ),
      el(
        "div",
        {
          style: {
            fontSize: "21px",
            fontWeight: 500,
            fontFamily: fontFamily500,
            color: "#a7b1c7",
            lineHeight: 1.5,
          },
        },
        leadText
      )
    ),
    footerLeft: el(
      "div",
      {
        style: {
          display: "flex",
          gap: "10px",
        },
      },
      ...footerChips.map((label) =>
        el(
          "div",
          {
            style: {
              display: "flex",
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(216, 184, 120, 0.3)",
              backgroundColor: "rgba(216, 184, 120, 0.08)",
              color: "#f4e4bf",
              fontSize: "18px",
              fontFamily: fontFamily500,
            },
          },
          label
        )
      )
    ),
  });
}

function getCoursesIndexOgContent({ courseCount, totalStoryCount }) {
  return {
    badgeLabel: "読書コース・フェア棚一覧",
    headline: "何から読むか迷う旅人のための読書コース",
    summaryLine:
      typeof courseCount === "number" && courseCount > 0
        ? `全${courseCount}コース ・ 収録${totalStoryCount || 0}篇を推奨順で連続通読`
        : "入門・キャラクター別・地域・歴史別の切り口で推奨順に通読",
    leadText: "ネタバレなしの1行順路ガイドと読了進捗つきで物語の背景を体系的に辿る",
    footerChips: ["入門・必読", "キャラクター別", "地域・歴史別"],
  };
}

function buildCourseOgNode(course, { displayHost, fontFamily500, fontFamily700 }) {
  const titleText = truncateText(course.title, 44);
  const titleLen = Array.from(titleText).length;
  const titleSize = titleLen <= 16 ? 50 : titleLen <= 26 ? 43 : 36;
  const subtitleText = truncateText(course.subtitle, 54);
  const hookText = truncateText(course.hook, 84);
  const kindLabel = COURSE_KIND_OG_LABELS[course.kind] || "読書コース";
  const countMeta = `全${course.storyCount ?? course.storyIds?.length ?? 0}篇 ・ ${course.totalReadingTime || ""}`;

  return wrapOgCardShell({
    displayHost,
    fontFamily500,
    fontFamily700,
    topLeft: el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "12px",
        },
      },
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            padding: "8px 18px",
            borderRadius: "999px",
            border: "1px solid rgba(216, 184, 120, 0.55)",
            backgroundColor: "rgba(216, 184, 120, 0.14)",
            color: "#f4e4bf",
            fontSize: "20px",
            fontWeight: 700,
            fontFamily: fontFamily700,
          },
        },
        course.badge
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            borderRadius: "999px",
            border: "1px solid rgba(142, 166, 200, 0.34)",
            backgroundColor: "rgba(142, 166, 200, 0.1)",
            color: "#c6d2e8",
            fontSize: "19px",
            fontWeight: 500,
            fontFamily: fontFamily500,
          },
        },
        countMeta
      )
    ),
    body: el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          marginTop: "6px",
          marginBottom: "6px",
        },
      },
      el(
        "div",
        {
          style: {
            fontSize: `${titleSize}px`,
            lineHeight: 1.3,
            fontWeight: 700,
            fontFamily: fontFamily700,
            color: "#f4e4bf",
          },
        },
        titleText
      ),
      subtitleText
        ? el(
            "div",
            {
              style: {
                fontSize: "22px",
                lineHeight: 1.45,
                fontWeight: 700,
                fontFamily: fontFamily700,
                color: "#d8b878",
              },
            },
            subtitleText
          )
        : null,
      el(
        "div",
        {
          style: {
            fontSize: "23px",
            lineHeight: 1.55,
            fontWeight: 500,
            fontFamily: fontFamily500,
            color: "#e6e2d8",
          },
        },
        hookText
      )
    ),
    footerLeft: el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "10px",
        },
      },
      el(
        "div",
        {
          style: {
            display: "flex",
            padding: "6px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(216, 184, 120, 0.3)",
            backgroundColor: "rgba(216, 184, 120, 0.08)",
            color: "#f4e4bf",
            fontSize: "18px",
            fontFamily: fontFamily500,
          },
        },
        kindLabel
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            padding: "6px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(167, 177, 199, 0.26)",
            backgroundColor: "rgba(18, 25, 44, 0.85)",
            color: "#a7b1c7",
            fontSize: "18px",
            fontFamily: fontFamily500,
          },
        },
        "ネタバレなし順路ガイド付き"
      )
    ),
  });
}

function getEntitiesIndexOgContent({ entityCount, totalStoryCount }) {
  return {
    badgeLabel: "人物・用語名鑑",
    headline: "人物・用語名鑑",
    summaryLine:
      typeof entityCount === "number" && entityCount > 0
        ? `全${entityCount}項目の正体・背景解説・公式出典を収録${totalStoryCount || 0}篇から逆引き`
        : "登場人物・魔神・組織・重要用語の正体・背景解説・出典を横断検索",
    leadText: "聖遺物・武器・書籍に散らばる登場人物や用語の背景をひとつの辞書から辿る",
    footerChips: ["人物", "魔神・執政", "組織・用語"],
  };
}

function buildEntityOgNode(entity, { displayHost, fontFamily500, fontFamily700 }) {
  const titleText = truncateText(entity.name, 40);
  const titleLen = Array.from(titleText).length;
  const titleSize = titleLen <= 14 ? 50 : titleLen <= 22 ? 43 : 36;
  const identityText = truncateText(entity.defaultIdentity || "", 54);
  const descText = truncateText(entity.defaultDesc || "", 90);
  const kindLabel = ENTITY_KIND_OG_LABELS[entity.kind] || "人物・用語";
  const countMeta = `登場物語 全${entity.storyIds?.length ?? 0}篇`;

  return wrapOgCardShell({
    displayHost,
    fontFamily500,
    fontFamily700,
    topLeft: el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "12px",
        },
      },
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            padding: "8px 18px",
            borderRadius: "999px",
            border: "1px solid rgba(216, 184, 120, 0.55)",
            backgroundColor: "rgba(216, 184, 120, 0.14)",
            color: "#f4e4bf",
            fontSize: "20px",
            fontWeight: 700,
            fontFamily: fontFamily700,
          },
        },
        kindLabel
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            borderRadius: "999px",
            border: "1px solid rgba(142, 166, 200, 0.34)",
            backgroundColor: "rgba(142, 166, 200, 0.1)",
            color: "#c6d2e8",
            fontSize: "19px",
            fontWeight: 500,
            fontFamily: fontFamily500,
          },
        },
        countMeta
      )
    ),
    body: el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          marginTop: "6px",
          marginBottom: "6px",
        },
      },
      el(
        "div",
        {
          style: {
            fontSize: `${titleSize}px`,
            lineHeight: 1.3,
            fontWeight: 700,
            fontFamily: fontFamily700,
            color: "#f4e4bf",
          },
        },
        titleText
      ),
      identityText
        ? el(
            "div",
            {
              style: {
                fontSize: "22px",
                lineHeight: 1.45,
                fontWeight: 700,
                fontFamily: fontFamily700,
                color: "#d8b878",
              },
            },
            identityText
          )
        : null,
      descText
        ? el(
            "div",
            {
              style: {
                fontSize: "22px",
                lineHeight: 1.55,
                fontWeight: 500,
                fontFamily: fontFamily500,
                color: "#e6e2d8",
              },
            },
            descText
          )
        : null
    ),
    footerLeft: el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "10px",
        },
      },
      el(
        "div",
        {
          style: {
            display: "flex",
            padding: "6px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(216, 184, 120, 0.3)",
            backgroundColor: "rgba(216, 184, 120, 0.08)",
            color: "#f4e4bf",
            fontSize: "18px",
            fontFamily: fontFamily500,
          },
        },
        "人物・用語名鑑"
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            padding: "6px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(167, 177, 199, 0.26)",
            backgroundColor: "rgba(18, 25, 44, 0.85)",
            color: "#a7b1c7",
            fontSize: "18px",
            fontFamily: fontFamily500,
          },
        },
        "背景解説・公式出典付き"
      )
    ),
  });
}

const OG_SPEC_HANDLERS = {
  site: {
    collectTexts(spec, displayHost) {
      return [
        SITE_BRAND_TITLE,
        "非公式 原神物語アーカイブ",
        `原神 聖遺物・武器・書籍・風の翼・育成素材 ストーリー全${spec.totalCount || ""}篇`,
        "原神 聖遺物・武器・書籍・風の翼・育成素材 ストーリーリーダー",
        "原文改変なし・時系列再構成・インライン用語ガイド・作品間リンクで小説感覚に通読",
        "書籍聖遺物武器風の翼突破・育成素材",
        displayHost,
      ];
    },
    buildNode(spec, { displayHost, fontFamily500, fontFamily700 }) {
      return buildSiteOgNode({
        totalCount: spec.totalCount,
        displayHost,
        fontFamily500,
        fontFamily700,
      });
    },
  },
  about: {
    collectTexts(_spec, displayHost) {
      return [
        SITE_BRAND_TITLE,
        "About / サイト案内",
        "このサイトについて",
        "運営方針・著作権と引用の取り扱い・GA4 アクセス解析オプトアウト・ブラウザ保存データ・免責事項・お問い合わせ窓口のご案内",
        "非公式ファンアーカイブ・完全静的配信",
        displayHost,
      ];
    },
    buildNode(_spec, ctx) {
      return buildAboutOgNode(ctx);
    },
  },
  courses: {
    collectTexts(spec, displayHost) {
      const content = getCoursesIndexOgContent(spec);
      return [
        SITE_BRAND_TITLE,
        content.badgeLabel,
        content.headline,
        content.summaryLine,
        content.leadText,
        ...content.footerChips,
        displayHost,
      ];
    },
    buildNode(spec, ctx) {
      return buildCollectionIndexOgNode({ ...getCoursesIndexOgContent(spec), ...ctx });
    },
  },
  course: {
    collectTexts(spec, displayHost) {
      const c = spec.course;
      return [
        SITE_BRAND_TITLE,
        c.badge,
        `全${c.storyCount ?? c.storyIds?.length ?? 0}篇 ・ ${c.totalReadingTime || ""}`,
        truncateText(c.title, 44),
        truncateText(c.subtitle, 54),
        truncateText(c.hook, 84),
        COURSE_KIND_OG_LABELS[c.kind] || "読書コース",
        "ネタバレなし順路ガイド付き",
        "…",
        displayHost,
      ];
    },
    buildNode(spec, ctx) {
      return buildCourseOgNode(spec.course, ctx);
    },
  },
  entities: {
    collectTexts(spec, displayHost) {
      const content = getEntitiesIndexOgContent(spec);
      return [
        SITE_BRAND_TITLE,
        content.badgeLabel,
        content.headline,
        content.summaryLine,
        content.leadText,
        ...content.footerChips,
        displayHost,
      ];
    },
    buildNode(spec, ctx) {
      return buildCollectionIndexOgNode({ ...getEntitiesIndexOgContent(spec), ...ctx });
    },
  },
  entity: {
    collectTexts(spec, displayHost) {
      const e = spec.entity;
      return [
        SITE_BRAND_TITLE,
        ENTITY_KIND_OG_LABELS[e.kind] || "人物・用語",
        `登場物語 全${e.storyIds?.length ?? 0}篇`,
        truncateText(e.name, 40),
        truncateText(e.defaultIdentity || "", 54),
        truncateText(e.defaultDesc || "", 90),
        "人物・用語名鑑",
        "背景解説・公式出典付き",
        "…",
        displayHost,
      ];
    },
    buildNode(spec, ctx) {
      return buildEntityOgNode(spec.entity, ctx);
    },
  },
  story: {
    collectTexts(spec, displayHost) {
      const s = spec.story;
      return [
        SITE_BRAND_TITLE,
        truncateText(s.title, 44),
        truncateText(s.hook, 92),
        s.categoryLabel,
        Array.isArray(s.region) ? s.region.slice(0, 2).join(" / ") : "",
        ...(s.tags || []).slice(0, 3).map((t) => truncateText(t, 20)),
        "…",
        displayHost,
      ];
    },
    buildNode(spec, ctx) {
      return buildStoryOgNode(spec.story, ctx);
    },
  },
};

function collectTextsForSpec(spec, displayHost) {
  const handler = OG_SPEC_HANDLERS[spec.kind];
  if (!handler) {
    throw new Error(`未知の OGP spec.kind です: ${spec.kind}`);
  }
  return handler.collectTexts(spec, displayHost);
}

function computeCacheHash(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ version: OG_TEMPLATE_VERSION, ...payload }))
    .digest("hex")
    .slice(0, 16);
}

function normalizeOnlyTargets(only) {
  if (only === undefined || only === null) {
    return null;
  }
  const rawList = Array.isArray(only) ? only : [only];
  const normalized = rawList
    .flatMap((item) => String(item).split(","))
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const stripped = token.replace(/^\/?og\//, "").replace(/\.png$/i, "");
      if (
        stripped === "site" ||
        stripped === "about" ||
        stripped === "courses" ||
        stripped === "entities"
      ) {
        return stripped;
      }
      if (stripped.startsWith("story/")) return stripped.slice("story/".length);
      if (stripped.startsWith("story-")) return stripped.slice("story-".length);
      if (stripped.startsWith("course/")) return stripped;
      if (stripped.startsWith("course-")) return `course/${stripped.slice("course-".length)}`;
      if (stripped.startsWith("entity/")) return stripped;
      if (stripped.startsWith("entity-")) return `entity/${stripped.slice("entity-".length)}`;
      return stripped;
    });

  if (normalized.length === 0) {
    throw new Error(
      "OGP 生成対象 (--only) が空です。site, about, courses, course/<id>, entities, entity/<id>, または物語IDを指定してください。"
    );
  }
  return Array.from(new Set(normalized));
}

/**
 * 書架・About・読書コース・人物用語名鑑・全物語の静的 OGP 画像（1200x630 PNG）をビルド出力先へ生成する。
 */
export async function generateAllOgImages({
  clientDir,
  indexData,
  siteUrl,
  cacheDir = path.join(process.cwd(), ".cache", "og"),
  fontPkgDir = path.dirname(require.resolve("@fontsource/shippori-mincho/package.json")),
  force = false,
  only = null,
} = {}) {
  const ogRootDir = path.join(clientDir, "og");
  const ogStoryDir = path.join(ogRootDir, "story");
  const ogCourseDir = path.join(ogRootDir, "course");
  const ogEntityDir = path.join(ogRootDir, "entity");
  fs.mkdirSync(ogStoryDir, { recursive: true });
  fs.mkdirSync(ogCourseDir, { recursive: true });
  fs.mkdirSync(ogEntityDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  const displayHost = resolveDisplayHost(siteUrl);
  const stories = indexData?.stories ?? [];
  const courses = indexData?.courses ?? [];
  const entitiesEntries = Object.entries(indexData?.entitiesIndex ?? {});
  const totalCount = indexData?.totalCount ?? stories.length;

  const specs = [
    {
      targetKey: "site",
      cacheId: "site",
      outPath: path.join(ogRootDir, "site.png"),
      kind: "site",
      totalCount,
      hashPayload: { kind: "site", totalCount, displayHost },
    },
    {
      targetKey: "about",
      cacheId: "about",
      outPath: path.join(ogRootDir, "about.png"),
      kind: "about",
      hashPayload: { kind: "about", displayHost },
    },
    {
      targetKey: "courses",
      cacheId: "courses",
      outPath: path.join(ogRootDir, "courses.png"),
      kind: "courses",
      courseCount: courses.length,
      totalStoryCount: totalCount,
      hashPayload: { kind: "courses", courseCount: courses.length, totalStoryCount: totalCount, displayHost },
    },
    {
      targetKey: "entities",
      cacheId: "entities",
      outPath: path.join(ogRootDir, "entities.png"),
      kind: "entities",
      entityCount: entitiesEntries.length,
      totalStoryCount: totalCount,
      hashPayload: {
        kind: "entities",
        entityCount: entitiesEntries.length,
        totalStoryCount: totalCount,
        displayHost,
      },
    },
    ...courses
      .filter((course) => course?.id)
      .map((course) => ({
        targetKey: `course/${course.id}`,
        cacheId: `course-${course.id}`,
        outPath: path.join(ogCourseDir, `${course.id}.png`),
        kind: "course",
        course,
        hashPayload: {
          kind: "course",
          id: course.id,
          courseKind: course.kind,
          badge: course.badge,
          title: course.title,
          subtitle: course.subtitle,
          hook: course.hook,
          storyCount: course.storyCount,
          totalReadingTime: course.totalReadingTime,
          displayHost,
        },
      })),
    ...entitiesEntries
      .filter(([entityId, entity]) => Boolean(entityId && entity))
      .map(([entityId, entity]) => ({
        targetKey: `entity/${entityId}`,
        cacheId: `entity-${entityId}`,
        outPath: path.join(ogEntityDir, `${entityId}.png`),
        kind: "entity",
        entity: { id: entityId, ...entity },
        hashPayload: {
          kind: "entity",
          id: entityId,
          name: entity.name,
          entityKind: entity.kind,
          defaultIdentity: entity.defaultIdentity || "",
          defaultDesc: entity.defaultDesc || "",
          storyCount: entity.storyIds?.length ?? 0,
          displayHost,
        },
      })),
    ...stories
      .filter((story) => story?.id)
      .map((story) => ({
        targetKey: story.id,
        cacheId: `story-${story.id}`,
        outPath: path.join(ogStoryDir, `${story.id}.png`),
        kind: "story",
        story,
        hashPayload: {
          kind: "story",
          id: story.id,
          title: story.title,
          categoryLabel: story.categoryLabel,
          region: story.region,
          hook: story.hook,
          tags: (story.tags || []).slice(0, 3),
          displayHost,
        },
      })),
  ];

  let targetSpecs = specs;
  const onlyTargets = normalizeOnlyTargets(only);
  if (onlyTargets) {
    const specByTarget = new Map(specs.map((spec) => [spec.targetKey, spec]));
    const resolvedKeys = new Set();
    const unknownTargets = [];
    for (const target of onlyTargets) {
      if (specByTarget.has(target)) {
        resolvedKeys.add(target);
      } else if (specByTarget.has(`course/${target}`)) {
        resolvedKeys.add(`course/${target}`);
      } else if (specByTarget.has(`entity/${target}`)) {
        resolvedKeys.add(`entity/${target}`);
      } else {
        unknownTargets.push(target);
      }
    }
    if (unknownTargets.length > 0) {
      throw new Error(`指定された OGP 生成対象が見つかりません: ${unknownTargets.join(", ")}`);
    }
    targetSpecs = specs.filter((spec) => resolvedKeys.has(spec.targetKey));
  }

  const pendingSpecs = [];
  let cacheHits = 0;

  for (const spec of targetSpecs) {
    const renderedTexts = collectTextsForSpec(spec, displayHost);
    const hash = computeCacheHash({ ...spec.hashPayload, renderedTexts });
    const cacheFile = path.join(cacheDir, `${spec.cacheId}.${hash}.png`);
    if (!force && fs.existsSync(cacheFile)) {
      fs.copyFileSync(cacheFile, spec.outPath);
      cacheHits += 1;
    } else {
      pendingSpecs.push({ ...spec, cacheFile });
    }
  }

  let missingChars = [];
  if (pendingSpecs.length > 0) {
    const allTexts = pendingSpecs.flatMap((spec) => collectTextsForSpec(spec, displayHost));
    const fontRes = collectFontResources(allTexts, fontPkgDir);
    missingChars = fontRes.missingChars;

    if (missingChars.length > 0) {
      console.warn(
        `[OGP] フォント範囲外の文字を検出しました (${missingChars.length}件): ${missingChars.join(", ")}`
      );
    }

    for (const spec of pendingSpecs) {
      const handler = OG_SPEC_HANDLERS[spec.kind];
      if (!handler) {
        throw new Error(`未知の OGP spec.kind です: ${spec.kind}`);
      }
      const node = handler.buildNode(spec, {
        displayHost,
        fontFamily500: fontRes.fontFamily500,
        fontFamily700: fontRes.fontFamily700,
      });

      const svg = await satori(node, {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        fonts: fontRes.fonts,
      });
      const pngBuffer = new Resvg(svg).render().asPng();
      fs.writeFileSync(spec.outPath, pngBuffer);
      fs.writeFileSync(spec.cacheFile, pngBuffer);
    }
  }

  return {
    totalGenerated: targetSpecs.length,
    cacheHits,
    renderedCount: pendingSpecs.length,
    missingChars,
  };
}

function readPngSignatureAndSize(filePath) {
  const buf = fs.readFileSync(filePath);
  const validSignature = buf
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return {
    exists: true,
    byteLength: buf.length,
    validSignature,
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

/**
 * 一時ディレクトリ上で OGP 画像生成・PNG 署名/寸法・キャッシュ再利用をスモーク検証する。
 */
export async function runOgImageGeneratorSmokeCheck({ indexData, siteUrl } = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "teyvat-og-smoke-"));
  const clientDir = path.join(tempRoot, "client");
  const cacheDir = path.join(tempRoot, "cache");

  try {
    const firstRun = await generateAllOgImages({
      clientDir,
      indexData,
      siteUrl,
      cacheDir,
    });

    const samplePaths = [
      "og/site.png",
      "og/about.png",
      "og/courses.png",
      "og/entities.png",
      ...(indexData?.courses ?? []).slice(0, 2).map((c) => `og/course/${c.id}.png`),
      ...Object.keys(indexData?.entitiesIndex ?? {})
        .slice(0, 2)
        .map((id) => `og/entity/${id}.png`),
      ...(indexData?.stories ?? []).slice(0, 3).map((s) => `og/story/${s.id}.png`),
      ...((indexData?.stories ?? []).some((s) => s.id === "moonlit_bamboo_forest")
        ? ["og/story/moonlit_bamboo_forest.png"]
        : []),
    ];

    const sampleChecks = Array.from(new Set(samplePaths)).map((relPath) => ({
      relPath,
      ...readPngSignatureAndSize(path.join(clientDir, relPath)),
    }));

    const secondRun = await generateAllOgImages({
      clientDir,
      indexData,
      siteUrl,
      cacheDir,
    });

    return {
      firstRun,
      secondRun,
      sampleChecks,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
