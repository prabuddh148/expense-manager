package expo.modules.smsreader

import expo.modules.kotlin.exception.CodedException

/**
 * Thrown instead of returning an empty list, so the app can tell "you have not been
 * given access" apart from "there are no messages" and prompt accordingly.
 */
class SmsPermissionException :
  CodedException("READ_SMS permission has not been granted")
