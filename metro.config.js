const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Gradle creates tens of thousands of native build directories inside
    // node_modules. They are not JS inputs and can exhaust fallback watchers.
    blockList: [
      /[/\\](?:android|ios)[/\\](?:build|\.gradle|\.cxx)[/\\].*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
