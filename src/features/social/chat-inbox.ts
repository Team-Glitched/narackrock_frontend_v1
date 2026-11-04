import type { ChatThread, Person } from "@/lib/api/social";

export type ChatInboxRow = Person & { latest: ChatThread | null };

export function buildChatInbox(threads: ChatThread[], mutual: Person[]): ChatInboxRow[] {
  const seen = new Set<number>();
  const rows: ChatInboxRow[] = [];
  for (const thread of [...threads].sort((a, b) => b.lastMessageId - a.lastMessageId)) {
    if (seen.has(thread.userId)) continue;
    seen.add(thread.userId);
    rows.push({ ...thread, latest: thread });
  }
  for (const person of mutual) {
    if (seen.has(person.userId)) continue;
    seen.add(person.userId);
    rows.push({ ...person, latest: null });
  }
  return rows;
}
