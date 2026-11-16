import type { ScreenRegistry } from "../types";
import { AbyssScreen } from "./abyss";

/** Native screens of the abyss feature; spread into ../index.tsx. */
export const abyssScreens: ScreenRegistry<"abyss"> = { abyss: AbyssScreen };
