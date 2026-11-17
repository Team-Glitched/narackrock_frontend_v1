// Metro transformer: .svg imports become react-native-svg components (via SVGR); everything else
// goes to Expo's Babel transformer. npm nests that transformer under expo/node_modules, so it is
// resolved from the expo package (react-native-svg-transformer cannot find it there).
const path = require("node:path");
const { transform: svgr } = require("@svgr/core");

const upstream = require(
  require.resolve("@expo/metro-config/babel-transformer", {
    paths: [path.dirname(require.resolve("expo/package.json"))],
  }),
);

module.exports.transform = async ({ src, filename, ...rest }) =>
  upstream.transform({
    src: filename.endsWith(".svg")
      ? await svgr(src, { native: true, plugins: ["@svgr/plugin-jsx"] }, { filePath: filename })
      : src,
    filename,
    ...rest,
  });
