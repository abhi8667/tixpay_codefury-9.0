const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withSmsPermission(config) {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.addPermission(cfg.modResults, 'android.permission.READ_SMS');
    AndroidConfig.Permissions.addPermission(cfg.modResults, 'android.permission.RECEIVE_SMS');
    return cfg;
  });
};
