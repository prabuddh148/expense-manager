const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/**
 * Declares the SMS permissions the reader module needs.
 *
 * Android only, and deliberately kept here rather than in app.json's `permissions`
 * array: this puts them next to the explanation of why they exist and what they cost.
 *
 * READ_SMS and RECEIVE_SMS are restricted permissions. Google Play grants them only to
 * apps that are the device's default SMS handler or hold a specific exception, and an
 * expense tracker is neither - a build including this cannot be published there. That
 * is fine here because the app is distributed as a sideloaded APK; if it ever goes to
 * the Play Store, this plugin is what has to come out.
 */
const withSmsReader = (config) =>
  withAndroidManifest(config, (mod) => {
    AndroidConfig.Permissions.ensurePermissions(mod.modResults, [
      // Reading existing messages, for the first pass and any later rescan.
      'android.permission.READ_SMS',
      // Being told about new ones, so a transaction is noticed without reopening the app.
      'android.permission.RECEIVE_SMS',
    ]);
    return mod;
  });

module.exports = withSmsReader;
