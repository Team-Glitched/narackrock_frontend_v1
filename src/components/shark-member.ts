/** Minimum loading duration (ms) before showing the full-screen loading overlay. */
export const DEFAULT_LOADING_DELAY_MS = 1000;

export const SHARK_MEMBERS = ["drummer", "keyboard", "vocal", "bass", "guitar"] as const;
export type SharkMember = (typeof SHARK_MEMBERS)[number];

export type SharkMemberSpec = {
  id: SharkMember;
  /** Left edge of the inked illustration inside the member's local coordinate box (px). */
  inkLeft: number;
  /** Top edge of the inked illustration inside the member's local coordinate box (px). */
  inkTop: number;
  /** Inked illustration width in Figma px. */
  inkWidth: number;
  /** Inked illustration height in Figma px. */
  inkHeight: number;
  /** Uniform CSS scale factor matching character body proportions across all 5 members. */
  scale: number;
};

/**
 * Pixel-measured local ink bounding boxes and equalized display scales so each
 * shark renders at matching body proportion when displayed individually.
 */
export const SHARK_MEMBER_SPECS: Record<SharkMember, SharkMemberSpec> = {
  drummer: {
    id: "drummer",
    inkLeft: 3.6,
    inkTop: 108.5,
    inkWidth: 1161.7,
    inkHeight: 946.5,
    scale: 0.1404,
  },
  keyboard: {
    id: "keyboard",
    inkLeft: 129.1,
    inkTop: 209.4,
    inkWidth: 533.1,
    inkHeight: 333.0,
    scale: 0.258,
  },
  vocal: {
    id: "vocal",
    inkLeft: 323.0,
    inkTop: 383.8,
    inkWidth: 424.6,
    inkHeight: 297.4,
    scale: 0.2709,
  },
  bass: {
    id: "bass",
    inkLeft: 134.9,
    inkTop: 171.2,
    inkWidth: 486.4,
    inkHeight: 480.8,
    scale: 0.2541,
  },
  guitar: {
    id: "guitar",
    inkLeft: 50.6,
    inkTop: 100.7,
    inkWidth: 557.4,
    inkHeight: 467.7,
    scale: 0.2541,
  },
};

let lastPickedMember: SharkMember | null = null;

/** Picks a random shark band member, avoiding immediate repeats when `previous` is provided. */
export function pickRandomSharkMember(
  previous?: SharkMember | null,
  random: () => number = Math.random,
): SharkMember {
  const pool = previous ? SHARK_MEMBERS.filter((member) => member !== previous) : SHARK_MEMBERS;
  const clamped = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[clamped];
}

export function pickNextSharkMember(): SharkMember {
  const next = pickRandomSharkMember(lastPickedMember);
  lastPickedMember = next;
  return next;
}
