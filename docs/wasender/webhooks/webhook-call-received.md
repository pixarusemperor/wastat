# Webhook: Call Received

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-call-received
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-call-received
Description: Event is triggered for an incoming voice or video call.

Details:
Webhook Event: call

 This event is triggered whenever an incoming voice or video call is received by the session.

 The payload contains the full call object, which includes a unique call ID (required for rejecting the call), the caller's JID, and other call metadata like whether it is a video call.

 This event is particularly useful for building features like automatic call rejection or logging all incoming call attempts.

Code examples:
```json
{
  "event": "call",
  "timestamp": 1633456829,
  "data": {
    "call": {
      "id": "3EB025832E521B2F7E11",
      "from": "1234567890@s.whatsapp.net",
      "date": "2025-09-22T21:34:00.000Z",
      "isGroup": false,
      "isVideo": true,
      "status": "offer"
    }
  }
}
```

