import type { ServiceNotification } from "../../lib/api/notifications.ts";
export type NotificationGroup = { first: ServiceNotification; items: ServiceNotification[] };
/** Group only reactions on the same target and day; requests and workflow results stay independent. */
export function notificationGroups(items: ServiceNotification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [], byKey = new Map<string, NotificationGroup>();
  for (const item of items) {
    const key = item.type.endsWith("_LIKED") && item.available && item.path
      ? `${item.type}:${item.path}:${item.createdAt.slice(0, 10)}` : `single:${item.id}`;
    const group = byKey.get(key);
    if (group) group.items.push(item);
    else { const next = { first: item, items: [item] }; byKey.set(key, next); groups.push(next); }
  }
  return groups;
}
export function notificationBody(group: NotificationGroup) {
  return group.items.length > 1 ? group.first.body.replace("님이", `님 외 ${group.items.length - 1}명이`) : group.first.body;
}
