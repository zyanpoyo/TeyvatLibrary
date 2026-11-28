import { describe, expect, it } from "vitest";
import {
  ENTITY_KIND_LABELS,
  ENTITY_KIND_ORDER,
  groupByEntityKind,
  isValidEntityKind,
} from "../src/domain/entity-kinds";
import type { EntityKind } from "../src/types/story";

describe("entity-kinds domain helper", () => {
  it("defines all 5 entity kinds in canonical order with labels", () => {
    expect(ENTITY_KIND_ORDER).toEqual([
      "character",
      "god",
      "organization",
      "concept",
      "place",
    ]);

    for (const kind of ENTITY_KIND_ORDER) {
      expect(ENTITY_KIND_LABELS[kind].label.length).toBeGreaterThan(0);
      expect(ENTITY_KIND_LABELS[kind].heading.length).toBeGreaterThan(0);
    }
  });

  it("validates EntityKind values strictly with isValidEntityKind", () => {
    for (const kind of ENTITY_KIND_ORDER) {
      expect(isValidEntityKind(kind)).toBe(true);
    }
    expect(isValidEntityKind("unknown")).toBe(false);
    expect(isValidEntityKind("")).toBe(false);
    expect(isValidEntityKind(null)).toBe(false);
    expect(isValidEntityKind(123)).toBe(false);
  });

  it("groups items strictly in ENTITY_KIND_ORDER, omits empty kinds, and preserves inner order", () => {
    const items: Array<{ id: string; kind: EntityKind }> = [
      { id: "p1", kind: "place" },
      { id: "c1", kind: "character" },
      { id: "o1", kind: "organization" },
      { id: "p2", kind: "place" },
      { id: "c2", kind: "character" },
      { id: "k1", kind: "concept" },
    ];

    const groups = groupByEntityKind(items);

    expect(groups.map((g) => g.kind)).toEqual([
      "character",
      "organization",
      "concept",
      "place",
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "人物",
      "組織",
      "歴史・重要用語",
      "地域・地名",
    ]);
    expect(groups[0].items.map((item) => item.id)).toEqual(["c1", "c2"]);
    expect(groups[3].items.map((item) => item.id)).toEqual(["p1", "p2"]);
  });
});
