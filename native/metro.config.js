// The app imports shared code (design tokens, bridge protocol) from the web app's src/ and the web's
// Figma icons from public/figma, which load as components through svg-transformer.js. Packages those
// files import (react, react-native-svg) resolve from native/node_modules, never the web's copies.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, "../src"),
  path.resolve(__dirname, "../public/figma"),
];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.transformer.babelTransformerPath = require.resolve("./svg-transformer");
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

module.exports = config;
