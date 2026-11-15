// SVG files import as components through react-native-svg-transformer (metro.config.js).
declare module "*.svg" {
  import type { FC } from "react";
  import type { SvgProps } from "react-native-svg";

  const Svg: FC<SvgProps>;
  export default Svg;
}
