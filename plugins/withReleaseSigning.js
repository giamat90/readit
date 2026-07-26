const { withAppBuildGradle } = require("expo/config-plugins");

// android/app/build.gradle is regenerated from scratch by `expo prebuild --clean`
// (it isn't tracked in git), so real release signing can't just be hand-edited in —
// it has to be re-injected on every prebuild. This plugin does that, reading the
// actual keystore/passwords from Gradle properties (~/.gradle/gradle.properties),
// never from the repo. Local dev builds without those properties set keep using
// the debug keystore unchanged.

const SIGNING_CONFIGS_ANCHOR = "signingConfigs {";
const RELEASE_SIGNING_CONFIG = `
        release {
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                storeFile file(RELEASE_STORE_FILE)
                storePassword RELEASE_STORE_PASSWORD
                keyAlias RELEASE_KEY_ALIAS
                keyPassword RELEASE_KEY_PASSWORD
            }
        }`;

const BUILD_TYPE_ANCHOR = "signingConfig signingConfigs.debug\n            def enableShrinkResources";
const BUILD_TYPE_REPLACEMENT =
  "signingConfig project.hasProperty('RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug\n            def enableShrinkResources";

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes(SIGNING_CONFIGS_ANCHOR)) {
      throw new Error(
        "withReleaseSigning: could not find 'signingConfigs {' in app/build.gradle — the Expo template may have changed, update this plugin's anchors."
      );
    }
    contents = contents.replace(SIGNING_CONFIGS_ANCHOR, SIGNING_CONFIGS_ANCHOR + RELEASE_SIGNING_CONFIG);

    if (!contents.includes(BUILD_TYPE_ANCHOR)) {
      throw new Error(
        "withReleaseSigning: could not find the release buildType's signingConfig line in app/build.gradle — the Expo template may have changed, update this plugin's anchors."
      );
    }
    contents = contents.replace(BUILD_TYPE_ANCHOR, BUILD_TYPE_REPLACEMENT);

    config.modResults.contents = contents;
    return config;
  });
};
