import { instruments } from "../composition/instrument-catalog.ts";

export function participantSelection(people: { userId: number }[], previous: number[] | null): number[] {
  const ids = [...new Set(people.map(person => person.userId))];
  return previous === null ? ids : ids.filter(id => previous.includes(id));
}

export function participantRole(role: string): string {
  return [...new Set(role.split(",").map(value => {
    const id = value.trim();
    if (id === "OWNER") return "원작자";
    if (id === "EDITOR" || id === "VIEWER") return "작곡 참여";
    if (id === "AUDIO") return "오디오";
    return instruments.find(instrument => instrument.id === id)?.label ?? id;
  }))].join(" · ");
}

export function selectParticipantTracks<T extends { tracks: { ownerId: number }[] }>(composition: T, ids: number[]): T {
  return { ...composition, tracks: composition.tracks.filter(track => ids.includes(track.ownerId)) };
}
