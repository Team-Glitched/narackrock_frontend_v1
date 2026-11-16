import type { ScreenRegistry } from "../types";
import { CreationChooseScreen } from "./choose";
import { CreationPianoScreen } from "./piano";
import { CreationRecordScreen } from "./record";
import { CreationUploadScreen } from "./upload";

/** Native screens of the layer creation feature; spread into ../index.tsx. */
export const creationScreens: ScreenRegistry<"creation"> = {
  "creation-choose": CreationChooseScreen,
  "creation-upload": CreationUploadScreen,
  "creation-record": CreationRecordScreen,
  "creation-piano": CreationPianoScreen,
};
