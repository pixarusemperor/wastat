# Webhook: QR Code Updated

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-qrcode-updated
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-qrcode-updated
Description: Event triggered when a new QR code is generated for linking your session.

Details:
Webhook Event: qrcode.updated

 Triggered when a new QR code is generated for linking your session. The payload contains the QR code data.

 See the code example below for the typical payload structure.

Code examples:
```json
{
  "event": "qrcode.updated",
  "sessionId": "YOUR_SESSION_API_KEY",
  "data": {
    "qr": "2@67576ghf/RMXr8A2IP3/...", // This is the QR string. Use a QR code library to generate an image.
  }
}
```

