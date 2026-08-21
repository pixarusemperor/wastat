# Webhook: Message Received

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-received
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-received
Description: Event is triggered for incoming messages, to listen for both incoming and outgoing, please refer to messages.upsert.

Details:
Webhook Event: messages.received
 This event is triggered when a new message is received in your session. The payload includes the message content, sender information, and message key.
 See the code example below for a typical payload structure.
 To learn more about handling media in this event, please refer to the help center article on handling media messages.

Code examples:
```json
{
  "event": "messages.received",
  "timestamp": 1633456789,
  "data": {
    "messages": 
      {
        "key": {
          "id": "3EB0X123456789",
          "fromMe": false,
          "remoteJid": "1234567890@s.whatsapp.net", // could also be 555555555@lid based on the addressingMode
          "addressingMode": "pn", 
          "senderPn": "1234567890@s.whatsapp.net",
          "cleanedSenderPn": "1234567890",
          "senderLid": "555555555@lid"
        },
        "messageBody": "Hello, I have a question",
        "message": {
          "conversation": "Hello, I have a question"
        }
      }
  }
}
```

