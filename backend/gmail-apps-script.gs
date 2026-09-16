/**
 * Sends the app's emails (password reset codes) from your own Gmail account.
 *
 * Render's free plan blocks SMTP, so the server cannot log in to Gmail directly. Instead it
 * calls this small Google Apps Script over HTTPS, and the script sends the mail as you.
 * Consumer Gmail allows about 100 emails a day this way.
 *
 * Setup:
 *   1. Open https://script.google.com while signed in to the Gmail you want to send from.
 *      New project -> replace everything with this file.
 *   2. Replace SECRET below with a long random string (30+ characters).
 *   3. Deploy -> New deployment -> type "Web app".
 *        Execute as: Me
 *        Who has access: Anyone
 *      Deploy, then allow the permission prompt (Advanced -> Go to project -> Allow).
 *   4. Copy the Web app URL (ends in /exec).
 *   5. On Render set GMAIL_SCRIPT_URL to that URL and GMAIL_SCRIPT_SECRET to the same SECRET.
 *
 * After editing this script later, use Deploy -> Manage deployments -> Edit -> New version,
 * so the same URL keeps working.
 */
const SECRET = 'REPLACE_WITH_A_LONG_RANDOM_SECRET';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (SECRET === 'REPLACE_WITH_A_LONG_RANDOM_SECRET' || body.secret !== SECRET) {
      return reply({ ok: false, error: 'forbidden' });
    }
    MailApp.sendEmail({
      to: body.to,
      subject: body.subject,
      body: body.text,
      htmlBody: body.html,
      name: body.fromName || 'Expense Manager',
    });
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
