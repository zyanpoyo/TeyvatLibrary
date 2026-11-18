import { describe, expect, it } from "vitest";
import {
  extractCitedTitles,
  extractInlineTagReferences,
  formatGenderPlaceholders,
  formatRegion,
  isValidIsoDateString,
  parseEvidenceTokens,
  parseIsoDateUtcMs,
  parseParagraphTokens,
  stripInlineTags,
} from "../src/domain/text-parser";

describe("text-parser", () => {
  it("formatRegion joins array or returns string", () => {
    expect(formatRegion(["モンド", "スメール"])).toBe("モンド / スメール");
    expect(formatRegion("稲妻")).toBe("稲妻");
    expect(formatRegion(undefined)).toBe("");
  });

  it("parseParagraphTokens parses leading subheads, inline terms, and line breaks", () => {
    const tokens = parseParagraphTokens(
      "【鳩が枝を運んだ年】\n原初の時代、{{by_snake|常世の大蛇}}は現れなかった。\n次行へ続く。"
    );

    expect(tokens).toEqual([
      { type: "subhead", label: "鳩が枝を運んだ年" },
      { type: "br" },
      { type: "text", value: "原初の時代、" },
      { type: "term", termId: "by_snake", surface: "常世の大蛇" },
      { type: "text", value: "は現れなかった。" },
      { type: "br" },
      { type: "text", value: "次行へ続く。" },
    ]);
  });

  it("parseParagraphTokens treats mid-line 【...】 as plain text while still parsing inner terms", () => {
    const tokens = parseParagraphTokens("彼は【{{term_a|謎の言葉}}】を口にした。\n【段落見出し】\n本文");

    expect(tokens).toEqual([
      { type: "text", value: "彼は【" },
      { type: "term", termId: "term_a", surface: "謎の言葉" },
      { type: "text", value: "】を口にした。" },
      { type: "br" },
      { type: "subhead", label: "段落見出し" },
      { type: "br" },
      { type: "text", value: "本文" },
    ]);
  });

  it("formatGenderPlaceholders formats {M#...}{F#...} placeholders into readable text", () => {
    expect(formatGenderPlaceholders("{M#彼女}{F#彼}は微笑んだ。")).toBe(
      "彼女／彼は微笑んだ。"
    );
    expect(formatGenderPlaceholders("{F#彼}{M#彼女}もまた旅立った。")).toBe(
      "彼女／彼もまた旅立った。"
    );
    expect(formatGenderPlaceholders("{M#旅人}{F#旅人}の記憶")).toBe(
      "旅人の記憶"
    );
  });

  it("parseParagraphTokens formats gender placeholders inside text and inline terms", () => {
    const tokens = parseParagraphTokens(
      "金髪の王は人混みを見た。{M#彼女}{F#彼}はしばらく{{fl_twin|{M#姫}{F#王子}}}として滞在した。"
    );

    expect(tokens).toEqual([
      { type: "text", value: "金髪の王は人混みを見た。彼女／彼はしばらく" },
      { type: "term", termId: "fl_twin", surface: "姫／王子" },
      { type: "text", value: "として滞在した。" },
    ]);
  });

  it("parseEvidenceTokens turns known 『タイトル』 into link tokens and keeps unknown titles as text", () => {
    const tokens = parseEvidenceTokens(
      "武器『終焉を嘆く詩』および未収録『幻の書』の記述より",
      [{ title: "終焉を嘆く詩", storyId: "elegy" }]
    );

    expect(tokens).toEqual([
      { type: "text", value: "武器" },
      { type: "link", title: "終焉を嘆く詩", storyId: "elegy" },
      { type: "text", value: "および未収録『幻の書』の記述より" },
    ]);
  });

  it("extractInlineTagReferences and stripInlineTags preserve nested gender placeholders", () => {
    const line = "{{wf_twin|{M#姫}{F#王子}}}は{{wf_knight|若い騎士}}と出会った。";
    expect(extractInlineTagReferences(line)).toEqual([
      { termId: "wf_twin", surface: "{M#姫}{F#王子}", raw: "{{wf_twin|{M#姫}{F#王子}}}" },
      { termId: "wf_knight", surface: "若い騎士", raw: "{{wf_knight|若い騎士}}" },
    ]);
    expect(stripInlineTags(line)).toBe("{M#姫}{F#王子}は若い騎士と出会った。");
  });

  it("extractCitedTitles and ISO date utilities handle cited titles and calendar validation", () => {
    expect(extractCitedTitles("『蒼白の炎』と『白夜国館蔵』（巻二）を参照。")).toEqual([
      "蒼白の炎",
      "白夜国館蔵",
    ]);
    expect(parseIsoDateUtcMs("2024-02-29")).toBe(Date.UTC(2024, 1, 29));
    expect(isValidIsoDateString("2024-02-29")).toBe(true);
    expect(isValidIsoDateString("2026-02-29")).toBe(false);
    expect(isValidIsoDateString("2026-02-30")).toBe(false);
    expect(isValidIsoDateString("2026/11/18")).toBe(false);
  });
});
