const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Declares the one SMS permission the app actually uses, and strips the
 * autolinked permissions it does not.
 *
 * Deliberately does NOT add RECEIVE_SMS. That permission grants live
 * interception of incoming messages; TiXPay only ever reads the existing
 * inbox, so asking for it would widen the blast radius for nothing. The
 * narrower the manifest, the more defensible the privacy claim.
 */

// Autolinked by dependencies but never exercised by our code.
const BLOCKED = [
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.RECEIVE_SMS',
];

module.exports = function withSmsPermission(config) {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.addPermission(cfg.modResults, 'android.permission.READ_SMS');

    const manifest = cfg.modResults.manifest;
    const declared = manifest['uses-permission'] || [];

    // Drop blocked entries, and de-duplicate whatever survives — app.json and
    // this plugin can otherwise both declare READ_SMS.
    const seen = new Set();
    manifest['uses-permission'] = declared.filter((entry) => {
      const name = entry.$ && entry.$['android:name'];
      if (!name || BLOCKED.includes(name) || seen.has(name)) return false;
      seen.add(name);
      return true;
    });

    return cfg;
  });
};
