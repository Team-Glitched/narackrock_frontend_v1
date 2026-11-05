export type LegacyItem = {
  key: string;
  storageKey: string;
  kind: "post" | "song" | "source" | "audio" | "midi" | "work" | "recovery" | "draft-pointer";
  id: number | null;
  title: string;
  author: string | null;
  ownerId: number | null;
  mediaKey: string | null;
  raw: unknown;
  originalScope: string;
};
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value : null);
const id = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

/** Reads originals only. Legacy ids have no backend identity and must be checked against live metadata. */
export function collectLegacyItems(storage: Storage): LegacyItem[] {
  const items: LegacyItem[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (
      !key ||
      !/^(narackrock\.(saved\.|saved-sources\.|workspace\.live\.|creation-draft\.)|glitched-composition-draft-id$)/.test(
        key,
      )
    )
      continue;
    let value: unknown;
    try {
      value = JSON.parse(storage.getItem(key) ?? "null");
    } catch {
      value = storage.getItem(key);
    }
    const add = (raw: unknown, kind: LegacyItem["kind"], suffix: string) => {
      const pointerId = kind === "draft-pointer"
        ? id(typeof raw === "string" && /^[1-9]\d*$/.test(raw) ? Number(raw) : raw)
        : null;
      const row = object(raw) ? raw : {};
      const identity = JSON.stringify([
        pointerId ?? id(row.id) ?? suffix,
        row.title ?? null,
        row.author ?? null,
        row.userId ?? null,
        kind === "audio" ? (row.attachments ?? row.mediaKey ?? null) : null,
      ]);
      items.push({
        key: `${key}:${kind}:${encodeURIComponent(identity)}`,
        storageKey: key,
        kind,
        id: pointerId ?? id(row.id),
        title: pointerId === null ? text(row.title) ?? key : `이전 작업 프로젝트 #${pointerId}`,
        author: text(row.author),
        ownerId: id(row.userId),
        mediaKey: text(row.mediaKey),
        originalScope: key === "glitched-composition-draft-id" ? "global" : key.split(".").at(-1) ?? "global",
        raw,
      });
    };
    if (key.startsWith("narackrock.saved.")) {
      if (Array.isArray(value))
        value.forEach((row, i) => {
          if (object(row))
            add(
              row,
              row.kind === "post" ? "post" : row.kind === "song" ? "song" : "recovery",
              String(i),
            );
        });
    } else if (key.startsWith("narackrock.saved-sources.")) {
      if (Array.isArray(value))
        value.forEach((row, i) => {
          add(row, "source", String(i));
          if (object(row) && text(row.mediaKey)) add(row, "audio", String(i));
        });
    } else if (key.startsWith("narackrock.workspace.live.") && object(value)) {
      for (const field of ["works", "resources", "submissions"] as const) {
        const rows = value[field];
        if (Array.isArray(rows))
          rows.forEach((row, i) =>
            add(
              row,
              field === "works" ? "work" : field === "resources" ? "midi" : "recovery",
              `${field}:${i}`,
            ),
          );
      }
    } else if (key === "glitched-composition-draft-id") {
      const pointerId = typeof value === "string" && /^[1-9]\d*$/.test(value)
        ? id(Number(value))
        : id(value);
      add(value, pointerId === null ? "recovery" : "draft-pointer", "original");
    } else {
      add(value, "recovery", "original");
      if (key.startsWith("narackrock.creation-draft.")) add(value, "audio", "attachment");
    }
  }
  return items;
}

export function recoveryComposition(item: LegacyItem) {
  return object(item.raw) && object(item.raw.composition) ? item.raw.composition : null;
}
