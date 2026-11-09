import type { TrackDto } from "../../lib/api/composition.ts";

/** null = the original full mix, empty = silent, non-empty = only these owners' approved tracks. */
export type OwnerSelection = ReadonlySet<number> | null;

export type ParticipantOwner = {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  roles: string[];
  trackNames: string[];
};

type Composer = { userId: number; nickname: string; profileImageUrl: string | null; role: string };
type KnownPerson = { userId: number; nickname: string };

/**
 * Composers deduplicated by userId with merged roles, followed by owners that only appear in the approved stems so
 * every playable track has a selectable owner.
 */
export function participantOwners(
  composers: readonly Composer[],
  tracks: readonly TrackDto[],
  known: readonly KnownPerson[],
): ParticipantOwner[] {
  const owners = new Map<number, ParticipantOwner>();
  for (const composer of composers) {
    const owner = owners.get(composer.userId);
    const role = composer.role?.trim();
    if (owner) {
      if (role && !owner.roles.includes(role)) owner.roles.push(role);
      continue;
    }
    owners.set(composer.userId, {
      userId: composer.userId,
      nickname: composer.nickname,
      profileImageUrl: composer.profileImageUrl,
      roles: role ? [role] : [],
      trackNames: [],
    });
  }
  for (const track of tracks) {
    let owner = owners.get(track.ownerId);
    if (!owner) {
      const person = known.find((candidate) => candidate.userId === track.ownerId);
      owner = {
        userId: track.ownerId,
        nickname: person?.nickname ?? `참여자 ${track.ownerId}`,
        profileImageUrl: null,
        roles: [],
        trackNames: [],
      };
      owners.set(track.ownerId, owner);
    }
    if (!owner.trackNames.includes(track.name)) owner.trackNames.push(track.name);
  }
  return [...owners.values()];
}

/** Toggling from "all" starts from every owner checked. */
export function toggleOwner(selection: OwnerSelection, ownerId: number, owners: readonly number[]): Set<number> {
  const next = new Set(selection ?? owners);
  if (next.has(ownerId)) next.delete(ownerId);
  else next.add(ownerId);
  return next;
}

/** Selecting every owner that has approved stems is the original full mix. */
export function normalizeOwnerSelection(selection: OwnerSelection, stemOwners: readonly number[]): OwnerSelection {
  if (selection === null) return null;
  return stemOwners.length > 0 && stemOwners.every((ownerId) => selection.has(ownerId)) ? null : new Set(selection);
}

export function sameOwnerSelection(left: OwnerSelection, right: OwnerSelection): boolean {
  if (left === null || right === null) return left === right;
  return left.size === right.size && [...left].every((ownerId) => right.has(ownerId));
}

export function ownerTracks(tracks: readonly TrackDto[], selection: ReadonlySet<number>): TrackDto[] {
  return tracks.filter((track) => selection.has(track.ownerId));
}

/** The listener plays the original song length, never the last selected note, within the project limit. */
export function listenerDurationMs(metadataMs: number | null, maxDurationMs: number): number {
  return metadataMs !== null && Number.isFinite(metadataMs) && metadataMs > 0
    ? Math.min(metadataMs, maxDurationMs)
    : maxDurationMs;
}
