# Get Passkey Token

> Source: https://www.wasenderapi.com/api-docs/sessions/get-whatsapp-session-passkey-token
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/get-whatsapp-session-passkey-token
Endpoint: GET /api/whatsapp-sessions/{whatsappSession}/passkey-token
Description: Retrieves the temporary Passkey token and explains the recommended API flow using the Device Link Helper Chrome extension.

Details:
Get Passkey Token

 Retrieves the temporary Passkey token for a session in NEED_PASSKEY status.

 Recommended API flow

 Use this flow when your application starts Passkey linking through the API and you want the user to complete the approval with the Device Link Helper Chrome extension.

 - Call POST /api/whatsapp-sessions/{whatsappSession}/connect with {"linkMethod":"passkey"}.

 - Read the temporary token from data.passkey.token. If the session is already waiting for Passkey approval, call this endpoint to fetch the latest token.

 - Show the token to the user inside your application.

 - Ask the user to open the Device Link Helper Chrome extension.

 - The user pastes the token into the extension and clicks Open WhatsApp Passkey.

 - The extension opens WhatsApp Web, asks the user to approve the Passkey prompt, and completes linking through WasenderAPI.

 Install Device Link Helper from the Chrome Web Store

 The token is temporary and expires quickly. If it expires, call this endpoint again or restart the Passkey linking flow.

 Example user instructions

 1. Install and open the Device Link Helper Chrome extension.
2. Paste this Passkey token:
 TEMPORARY_PASSKEY_TOKEN
3. Click Open WhatsApp Passkey.
4. Approve the WhatsApp Passkey prompt.
5. If WhatsApp asks on your phone, tap Continue only if you started this request.

 Custom helper flow

 If you do not want to use Device Link Helper, you can build your own helper using the advanced Passkey endpoints below. Your helper must run navigator.credentials.get() from https://web.whatsapp.com; credentials created from your own application origin or a normal extension origin will be rejected by WhatsApp.

Parameters:
- whatsappSession (integer, required): ID of the WhatsApp session.

Code examples:
```bash
curl -X GET "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/passkey-token" 
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN"
```
```javascript
const response = await fetch("https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/passkey-token", {
  headers: {
    Authorization: "Bearer YOUR_PERSONAL_ACCESS_TOKEN"
  }
});

const result = await response.json();
console.log(result);
```

Response examples:
Success Response:
```json
{
  "success": true,
  "data": {
    "token": "temporary-passkey-token",
    "expires_at": "2026-07-09T12:30:00Z"
  }
}
```

