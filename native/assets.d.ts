// SVG files import as react-native-svg components through svg-transformer.js (metro.config.js).
declare module "*.svg" {
  import type { FC } from "react";
  import type { SvgProps } from "react-native-svg";

  const Svg: FC<SvgProps>;
  export default Svg;
}

// Bitmaps import as Metro asset ids, usable as an Image source.
declare module "*.png" {
  const asset: number;
  export default asset;
}
