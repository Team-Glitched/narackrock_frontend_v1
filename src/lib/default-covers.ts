import defaultCoverBass from "@/assets/default-covers/default-cover-bass.png";
import defaultCoverDrummer from "@/assets/default-covers/default-cover-drummer.png";
import defaultCoverGuitar from "@/assets/default-covers/default-cover-guitar.png";
import defaultCoverKeyboard from "@/assets/default-covers/default-cover-keyboard.png";
import defaultCoverVocal from "@/assets/default-covers/default-cover-vocal.png";
import { defaultCoverIndex } from "./default-cover-index.ts";

export const DEFAULT_COVERS = [
  defaultCoverDrummer,
  defaultCoverBass,
  defaultCoverGuitar,
  defaultCoverKeyboard,
  defaultCoverVocal,
] as const;

/** Picks one of the 5 Figma stage artworks deterministically from a content seed. */
export function pickDefaultCover(seed?: string | number | null): string {
  return DEFAULT_COVERS[defaultCoverIndex(seed)];
}
