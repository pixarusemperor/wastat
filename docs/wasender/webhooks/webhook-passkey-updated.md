# Webhook: Passkey Updated

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-passkey-updated
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-passkey-updated
Description: Event triggered when a WhatsApp Passkey linking request changes stage.

Details:
Webhook Event: passkey.updated

 Triggered when a WhatsApp Passkey linking request changes stage. This event is useful if your application wants to track Passkey linking progress in real time.

 Recommended API flow: Most API integrations should show the temporary Passkey token to the user and ask them to paste it into the Device Link Helper Chrome extension. The extension handles the WebAuthn approval and calls the advanced Passkey endpoints automatically.

 Payload format

 Webhook requests are sent as a JSON payload with the event name, session ID, data object, and timestamp.

 {
 "event": "passkey.updated",
 "sessionId": "YOUR_SESSION_API_KEY",
 "data": {
 "stage": "request",
 "requestId": "passkey-request-id",
 "token": "temporary-passkey-token",
 "expiresAt": 1783619400000
 },
 "timestamp": 1783619100000
}

 Passkey stages

 Stage
 Meaning
 Recommended action

 request
 A Passkey request was created. The payload includes the temporary token and request ID.
 Show the token to the user and ask them to paste it into Device Link Helper, or start your own helper flow.

 confirmation
 WhatsApp returned the continuation data and the request is ready to be confirmed.
 If you use Device Link Helper, no action is needed. If you built your own helper, call /api/passkey/confirm.

 fallback_qr
 The proactive Passkey flow did not finish in time and the session is switching back to QR linking.
 Stop the Passkey flow and show the QR linking UI. Watch for session.status with need_scan.

 no_continuation
 WhatsApp acknowledged the Passkey prologue but did not continue the linking flow.
 Ask the user to retry Passkey linking or use QR linking.

 Stage details

 The request stage can include:

 - requestId — ID of the Passkey request.

 - token — temporary token used by Device Link Helper or a custom helper.

 - expiresAt — expiration timestamp for the temporary token.

 The confirmation stage can include:

 - requestId — ID of the Passkey request.

 - code — internal confirmation value returned by WhatsApp. The website and helper do not show this code to the user.

 - skipHandoffUx — whether WhatsApp can skip part of the handoff UX.

 The fallback_qr and no_continuation stages can include:

 - requestId — ID of the Passkey request.

 - error — user-readable reason for the fallback or failure.

 Final connected state: This webhook tracks Passkey progress only. To know when the session is fully connected, listen for session.status with connected.

Code examples:
```json
{
  "event": "passkey.updated",
  "sessionId": "YOUR_SESSION_API_KEY",
  "data": {
    "stage": "request",
    "requestId": "passkey-request-id",
    "token": "temporary-passkey-token",
    "expiresAt": 1783619400000
  },
  "timestamp": 1783619100000
}
```

Response examples:
Request Stage:
```json
{
  "event": "passkey.updated",
  "sessionId": "YOUR_SESSION_API_KEY",
  "data": {
    "stage": "request",
    "requestId": "passkey-request-id",
    "token": "temporary-passkey-token",
    "expiresAt": 1783619400000
  },
  "timestamp": 1783619100000
}
```
Confirmation Stage:
```json
{
  "event": "passkey.updated",
  "sessionId": "YOUR_SESSION_API_KEY",
  "data": {
    "stage": "confirmation",
    "requestId": "passkey-request-id",
    "code": "123456",
    "skipHandoffUx": false
  },
  "timestamp": 1783619160000
}
```
Fallback to QR:
```json
{
  "event": "passkey.updated",
  "sessionId": "YOUR_SESSION_API_KEY",
  "data": {
    "stage": "fallback_qr",
    "requestId": "passkey-request-id",
    "error": "Passkey linking did not finish in time. Switching back to QR linking."
  },
  "timestamp": 1783619220000
}
```
No Continuation:
```json
{
  "event": "passkey.updated",
  "sessionId": "YOUR_SESSION_API_KEY",
  "data": {
    "stage": "no_continuation",
    "requestId": "passkey-request-id",
    "error": "WhatsApp acknowledged the passkey prologue but did not continue."
  },
  "timestamp": 1783619220000
}
```

