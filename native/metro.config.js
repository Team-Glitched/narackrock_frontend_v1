// The app imports shared code (design tokens, bridge protocol) from the web app's src/.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../src")];

module.exports = config;
