# expo-sms-reader

Reads bank transaction SMS on Android.

Android only. iOS gives apps no way to read the inbox at all, so there is nothing to
implement there - the platform list above is deliberate, not an oversight.

Two capabilities, both requiring `READ_SMS`:

- `readMessages(sinceMillis, limit)` - a one-off pass over the inbox for older messages.
- A broadcast receiver on `SMS_RECEIVED` that emits `onSmsReceived` for new ones, so the
  app does not have to be reopened for a transaction to be noticed.

Only the sender and body are handed to JavaScript, and parsing happens there. Nothing is
stored natively and nothing is uploaded: the app sends structured transactions to its
backend, never message text.

## Play Store

`READ_SMS` is a restricted permission. An expense tracker does not qualify for an
exception, so a build including this module cannot be published on Google Play. It is
fine for a sideloaded APK, which is how this app is distributed.
