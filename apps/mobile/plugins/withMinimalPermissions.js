const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Keeps the Android manifest to the one permission this app actually uses.
 *
 * TiXPay reads a bank statement the user hands it through the system file
 * picker. A picked document needs no permission at all — the picker grants a
 * scoped, one-file URI — so the only thing declared here is CAMERA, for QR
 * scanning, and even that is requested at the moment of use.
 *
 * Notably absent, and deliberately so:
 *   READ_SMS / RECEIVE_SMS  — we do not read messages. The whole point.
 *   READ_EXTERNAL_STORAGE   — the picker hands us a URI; we never browse files.
 *   BIND_NOTIFICATION_LISTENER_SERVICE — same blast radius as SMS, same answer.
 *
 * Libraries autolink permissions they never exercise, and an over-broad
 * manifest is the first thing a reviewer looks at. Everything on this list is
 * stripped even if a transitive dependency asks for it.
 */
const BLOCKED = [
  'android.permission.READ_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.SEND_SMS',
  'android.permission.READ_CONTACTS',
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

module.exports = function withMinimalPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const declared = manifest['uses-permission'] || [];

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
