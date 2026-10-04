module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    // Release bundles only: strip console.log/info/debug/warn (the calls and
    // their arguments), so players' phones never format or ship debug output.
    // console.error stays for real failures. Development keeps every log.
    production: {
      plugins: [['transform-remove-console', { exclude: ['error'] }]],
    },
  },
};
