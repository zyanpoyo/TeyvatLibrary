import type { EntityKind } from "../types/story";

export const ENTITY_KIND_ORDER: ReadonlyArray<EntityKind> = [
  "character",
  "god",
  "organization",
  "concept",
  "place",
];

export const ENTITY_KIND_LABELS: Record<EntityKind, { label: string; heading: string }> = {
  character: { label: "人物", heading: "人物" },
  god: { label: "魔神・執政", heading: "魔神・執政" },
  organization: { label: "組織", heading: "組織" },
  concept: { label: "歴史・重要用語", heading: "歴史・重要用語" },
  place: { label: "地域・地名", heading: "地域・地名" },
};

export interface EntityKindGroup<T> {
  kind: EntityKind;
  label: string;
  heading: string;
  items: T[];
}

export function isValidEntityKind(kind: unknown): kind is EntityKind {
  return typeof kind === "string" && (ENTITY_KIND_ORDER as readonly string[]).includes(kind);
}

/**
 * エンティティ配列を ENTITY_KIND_ORDER 順で種別グルーピングする（0件の種別は除外）。
 */
export function groupByEntityKind<T extends { kind: EntityKind }>(
  items: ReadonlyArray<T>
): EntityKindGroup<T>[] {
  const buckets = new Map<EntityKind, T[]>();
  for (const kind of ENTITY_KIND_ORDER) {
    buckets.set(kind, []);
  }

  for (const item of items) {
    const bucket = buckets.get(item.kind) ?? buckets.get("character");
    bucket?.push(item);
  }

  const groups: EntityKindGroup<T>[] = [];
  for (const kind of ENTITY_KIND_ORDER) {
    const groupedItems = buckets.get(kind) ?? [];
    if (groupedItems.length === 0) continue;
    groups.push({
      kind,
      label: ENTITY_KIND_LABELS[kind].label,
      heading: ENTITY_KIND_LABELS[kind].heading,
      items: groupedItems,
    });
  }
  return groups;
}
