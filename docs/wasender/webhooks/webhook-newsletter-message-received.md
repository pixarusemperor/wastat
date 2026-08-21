# Webhook: Newsletter Message Received

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-newsletter-message-received
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-newsletter-message-received
Description: Event is triggered when a message is received in a newsletter (channel) the session is subscribed to.

Details:
Webhook Event: messages-newsletter.received

 This event is triggered when a new message is published in a newsletter (also known as a Channel) that your session is subscribed to.

 The payload includes the message content and the unique JID of the newsletter, which typically ends in @newsletter. Unlike group messages, a participant field is not needed as the sender is the newsletter itself.

 See the code example below for a typical payload structure.

Code examples:
```json
{
  "event": "messages-newsletter.received",
  "timestamp": 1633456799,
  "data": {
    "messages": 
      {
        "key": {
          "id": "message-id-newsletter-456",
          "fromMe": false,
          "remoteJid": "123456789-987654321@newsletter",
        },
        "messageBody": "Hey Good News!",
        "message": {
          "conversation": "Hey Good News!"
        }
      }
  }
}
```

