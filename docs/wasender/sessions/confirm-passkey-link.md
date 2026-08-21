# Confirm Passkey Link

> Source: https://www.wasenderapi.com/api-docs/sessions/confirm-passkey-link
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/confirm-passkey-link
Endpoint: POST /api/passkey/confirm
Description: Advanced helper endpoint used to confirm a Passkey linking request. Most API integrations should use the Device Link Helper manual token flow instead.

Details:
Confirm Passkey Link

 This endpoint is part of the advanced Passkey helper flow.

 Recommended API flow: Most API integrations should not call this endpoint directly. Use Device Link Helper instead: show the temporary Passkey token to the user, and the extension will handle confirmation automatically after the user approves the Passkey prompt.

 Install Device Link Helper

 If you are building your own helper, call this endpoint after submitting the Passkey response and after the pending request reports that confirmation is available.

Parameters:
- token (string, required): Temporary Passkey token.
- requestId (string, required): Pending Passkey request ID.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/passkey/confirm" 
  -H "Content-Type: application/json" 
  -d '{
    "token": "TEMPORARY_PASSKEY_TOKEN",
    "requestId": "passkey-request-id"
  }'
```
```javascript
const response = await fetch("https://www.wasenderapi.com/api/passkey/confirm", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    token: "TEMPORARY_PASSKEY_TOKEN",
    requestId: "passkey-request-id"
  })
});

const result = await response.json();
console.log(result);
```

Response examples:
Success Response:
```json
{
  "success": true,
  "status": "confirmed"
}
```

