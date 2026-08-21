# Get Pending Passkey Request

> Source: https://www.wasenderapi.com/api-docs/sessions/get-pending-passkey-request
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/get-pending-passkey-request
Endpoint: GET /api/passkey/pending
Description: Advanced helper endpoint used to fetch WhatsApp WebAuthn publicKey options and inspect the current Passkey request status.

Details:
Get Pending Passkey Request

 This endpoint is part of the advanced Passkey helper flow.

 Recommended API flow: Most API integrations should not call this endpoint directly. Start Passkey linking through the session connect endpoint, show the returned temporary token to the user, and ask the user to paste it into the Device Link Helper Chrome extension.

 Install Device Link Helper

 If you are building your own helper, call this endpoint with the temporary Passkey token. It returns the WebAuthn publicKey options that must be passed to navigator.credentials.get().

 Status values

 The status field tells your helper what stage the Passkey linking request is in.

 Status
 Meaning
 What your helper should do

 pending
 The Passkey request was created and is waiting for a WebAuthn credential.
 Call navigator.credentials.get() with the returned publicKey, then submit the credential to /api/passkey/response.

 prologue_sent
 The credential was accepted by the API service and the Passkey prologue was sent to WhatsApp.
 Keep polling this endpoint until the request becomes ready for confirmation, succeeds, fails, or times out.

 confirmation
 WhatsApp returned the continuation data and the request is ready to be confirmed.
 Call /api/passkey/confirm with the same token and requestId.

 confirmed
 The Passkey linking request was confirmed successfully.
 Stop polling and check the session status. It should move toward CONNECTED.

 fallback_qr
 The proactive Passkey flow did not complete and the session returned to QR linking.
 Stop the Passkey helper flow and show the QR linking UI instead.

 no_continuation
 WhatsApp accepted the Passkey prologue but did not send the continuation needed to finish linking.
 Stop polling. Ask the user to retry Passkey linking or use QR linking.

 expired
 The temporary Passkey token expired before linking completed.
 Request a fresh Passkey token or restart the Passkey linking flow.

 error
 The request failed.
 Show the returned error message and allow the user to retry or use QR linking.

 Your custom helper must run the WebAuthn request from the correct WhatsApp Web origin, https://web.whatsapp.com. Calling WebAuthn from your own application origin or a normal extension origin will produce a credential WhatsApp rejects.

Parameters:
- token (string, required): Temporary Passkey token generated for the session.

Code examples:
```bash
curl -X GET "https://www.wasenderapi.com/api/passkey/pending?token=TEMPORARY_PASSKEY_TOKEN"
```
```javascript
const response = await fetch("https://www.wasenderapi.com/api/passkey/pending?token=TEMPORARY_PASSKEY_TOKEN");
const result = await response.json();
console.log(result);
```

Response examples:
Success Response:
```json
{
  "success": true,
  "requestId": "passkey-request-id",
  "publicKey": {
    "challenge": "base64url-challenge",
    "rpId": "whatsapp.com",
    "userVerification": "preferred"
  },
  "status": "pending"
}
```

