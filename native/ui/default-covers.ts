import type { ImageSourcePropType } from "react-native";

import defaultCoverBass from "../../src/assets/default-covers/default-cover-bass.png";
import defaultCoverDrummer from "../../src/assets/default-covers/default-cover-drummer.png";
import defaultCoverGuitar from "../../src/assets/default-covers/default-cover-guitar.png";
import defaultCoverKeyboard from "../../src/assets/default-covers/default-cover-keyboard.png";
import defaultCoverVocal from "../../src/assets/default-covers/default-cover-vocal.png";
import { defaultCoverIndex } from "../../src/lib/default-cover-index";

const DEFAULT_NATIVE_COVERS = [
  defaultCoverDrummer,
  defaultCoverBass,
  defaultCoverGuitar,
  defaultCoverKeyboard,
  defaultCoverVocal,
] as const;

/** Picks one of the 5 Figma stage artworks deterministically for Native `Image`. */
export function pickNativeDefaultCover(seed?: string | number | null): ImageSourcePropType {
  return DEFAULT_NATIVE_COVERS[defaultCoverIndex(seed)];
}
