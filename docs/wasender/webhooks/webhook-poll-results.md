# Webhook: Poll Results

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-poll-results
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-poll-results
Description: This webhook is triggered when there is an update to a poll, such as when a user casts a vote.

Details:
Webhook: Poll Results

 Triggered when a user votes in a poll that was created using the Send Poll Message API endpoint. This webhook provides updates on the poll's results as votes are cast.

Code examples:
```json
{
  "event": "poll.results",
  "sessionId": "YOUR_SESSION_API_KEY",
  "data": {
    "key": {
      "remoteJid": "123456789@s.whatsapp.net",
      "fromMe": true,
      "id": "FZNABLUGNI0F3QIJSWPW7H"
    },
    "pollResult": [
      {
        "name": "Pizza",
        "voters": [
          "123456789@s.whatsapp.net"
    ]
      },
      {
        "name": "Humberger",
        "voters": []
      }
    ]
  },
  "timestamp": 1753278982097
}
```

