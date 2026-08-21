# Submit Passkey Response

> Source: https://www.wasenderapi.com/api-docs/sessions/submit-passkey-response
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/submit-passkey-response
Endpoint: POST /api/passkey/response
Description: Advanced helper endpoint used to submit a WebAuthn credential response. Most API integrations should use the Device Link Helper manual token flow instead.

Details:
Submit Passkey Response

 This endpoint is part of the advanced Passkey helper flow.

 Recommended API flow: Most API integrations should not call this endpoint directly. Use Device Link Helper instead: show the temporary Passkey token to the user, and the user pastes it into the extension. The extension opens WhatsApp Web, asks for Passkey approval, serializes the credential, and submits it automatically.

 Install Device Link Helper

 If you are building your own helper, submit the serialized WebAuthn credential returned by navigator.credentials.get() to this endpoint.

 The credential must be created from https://web.whatsapp.com. If the credential origin is your application domain or a normal extension origin, WhatsApp will reject it.

Parameters:
- token (string, required): Temporary Passkey token.
- requestId (string, required): Pending Passkey request ID.
- credential (object, required): Serialized WebAuthn credential response.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/passkey/response" 
  -H "Content-Type: application/json" 
  -d '{
    "token": "TEMPORARY_PASSKEY_TOKEN",
    "requestId": "passkey-request-id",
    "credential": {
      "id": "credential-id",
      "rawId": "base64url-raw-id",
      "type": "public-key",
      "response": {
        "clientDataJSON": "base64url-client-data",
        "authenticatorData": "base64url-authenticator-data",
        "signature": "base64url-signature",
        "userHandle": null
      }
    }
  }'
```
```javascript
const response = await fetch("https://www.wasenderapi.com/api/passkey/response", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    token: "TEMPORARY_PASSKEY_TOKEN",
    requestId: "passkey-request-id",
    credential
  })
});

const result = await response.json();
console.log(result);
```

Response examples:
Accepted Response:
```json
{
  "success": true,
  "status": "prologue_sent"
}
```

