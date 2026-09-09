package expo.modules.smsreader

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Hands raw bank messages to JavaScript, which does the parsing.
 *
 * Nothing is interpreted, filtered or stored here. Keeping the native side this thin is
 * what lets the bank patterns be changed without a new build, and it keeps the message
 * text on the device: the app uploads structured transactions, never an inbox.
 */
class SmsReaderModule : Module() {

    private var receiver: BroadcastReceiver? = null

    private val context: Context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

    override fun definition() = ModuleDefinition {
        Name("ExpoSmsReader")

        Events("onSmsReceived")

        /** Whether READ_SMS has been granted. The permission request itself is JS-side. */
        Function("hasPermission") {
            ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_SMS) ==
                PackageManager.PERMISSION_GRANTED
        }

        /**
         * Messages received since a timestamp, oldest first, capped at `limit`. Oldest
         * first lets the caller drain a backlog by page, moving its watermark to the last
         * message it handled; newest first would leave it no way to reach what came before.
         */
        AsyncFunction("readMessages") { sinceMillis: Double, limit: Int ->
            requirePermission()
            readInbox(sinceMillis.toLong(), limit)
        }

        /** Starts emitting onSmsReceived so new messages are noticed without a reopen. */
        Function("startListening") {
            requirePermission()
            if (receiver == null) {
                registerReceiver()
            }
        }

        Function("stopListening") {
            unregisterReceiver()
        }

        OnDestroy {
            unregisterReceiver()
        }
    }

    private fun requirePermission() {
        val granted = ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            throw SmsPermissionException()
        }
    }

    private fun readInbox(sinceMillis: Long, limit: Int): List<Map<String, Any?>> {
        val projection = arrayOf(
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms._ID
        )
        val messages = mutableListOf<Map<String, Any?>>()

        context.contentResolver.query(
            Telephony.Sms.Inbox.CONTENT_URI,
            projection,
            "${Telephony.Sms.DATE} >= ?",
            arrayOf(sinceMillis.toString()),
            "${Telephony.Sms.DATE} ASC LIMIT $limit"
        )?.use { cursor ->
            val address = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
            val body = cursor.getColumnIndex(Telephony.Sms.BODY)
            val date = cursor.getColumnIndex(Telephony.Sms.DATE)
            val id = cursor.getColumnIndex(Telephony.Sms._ID)

            while (cursor.moveToNext()) {
                messages.add(
                    mapOf(
                        "id" to cursor.getString(id),
                        "sender" to cursor.getString(address),
                        "body" to cursor.getString(body),
                        "timestamp" to cursor.getLong(date).toDouble()
                    )
                )
            }
        }
        return messages
    }

    private fun registerReceiver() {
        val smsReceiver = object : BroadcastReceiver() {
            override fun onReceive(receiverContext: Context?, intent: Intent?) {
                if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

                // A long message arrives as several parts; joining them keeps a truncated
                // transaction from looking like an unparseable one.
                val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
                if (parts.isEmpty()) return

                val body = parts.joinToString("") { it.messageBody ?: "" }
                sendEvent(
                    "onSmsReceived",
                    mapOf(
                        "id" to null,
                        "sender" to parts[0].originatingAddress,
                        "body" to body,
                        "timestamp" to parts[0].timestampMillis.toDouble()
                    )
                )
            }
        }

        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13 onwards requires the export intent to be stated explicitly.
            context.registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            context.registerReceiver(smsReceiver, filter)
        }
        receiver = smsReceiver
    }

    private fun unregisterReceiver() {
        receiver?.let {
            runCatching { context.unregisterReceiver(it) }
        }
        receiver = null
    }
}
