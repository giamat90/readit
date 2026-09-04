const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Bundle the extraction engine HTML (assets/extraction/engine.html) as an
// asset so the hidden WebView can load it offline.
config.resolver.assetExts.push("html");

module.exports = withNativeWind(config, { input: "./global.css" });
