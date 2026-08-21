# Connect WhatsApp Session

> Source: https://www.wasenderapi.com/api-docs/sessions/connect-whatsapp-session
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/connect-whatsapp-session
Endpoint: POST /api/whatsapp-sessions/{whatsappSession}/connect
Description: Initiates the connection process for a WhatsApp session using QR code or Passkey. QR is the default method.

Details:
Connect WhatsApp Session

 Initiates the connection process for a WhatsApp session. Requires an active subscription.

 This endpoint requires an access token in the Authorization header. You can create one from API tokens.

 Linking Methods

 By default, this endpoint starts the normal WhatsApp QR linking flow.

 You can request Passkey linking by sending linkMethod: "passkey". Passkey linking uses the browser extension or desktop helper to approve a WhatsApp passkey prompt.

 Default: If linkMethod is omitted, the API uses qr.

 Fallback: If WhatsApp does not complete the Passkey continuation, the session may return to NEED_SCAN so the user can continue with QR linking.

Parameters:
- whatsappSession (integer, required): ID of the WhatsApp session.
- linkMethod (string, optional): Optional linking method. Use qr or passkey. Defaults to qr.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/connect" 
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN" 
  -H "Content-Type: application/json" 
  -d '{
    "linkMethod": "passkey"
  }'
```
```python
import requests

url = "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/connect"
headers = {
    "Authorization": "Bearer YOUR_PERSONAL_ACCESS_TOKEN",
    "Content-Type": "application/json"
}
payload = {
    "linkMethod": "passkey"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```
```javascript
async function connectSession() {
  const response = await fetch("https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/connect", {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_PERSONAL_ACCESS_TOKEN",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      linkMethod: "passkey"
    })
  });

  const result = await response.json();
  console.log(result);
}

connectSession();
```
```php
<?php
require "vendor/autoload.php";

use GuzzleHttpClient;

$client = new Client();

$response = $client->post("https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/connect", [
    "headers" => [
        "Authorization" => "Bearer YOUR_PERSONAL_ACCESS_TOKEN",
        "Content-Type" => "application/json",
        "Accept" => "application/json",
    ],
    "json" => [
        "linkMethod" => "passkey",
    ],
]);

echo $response->getBody();
```
```typescript
import axios from "axios";

async function connectSession() {
  const response = await axios.post(
    "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/connect",
    { linkMethod: "passkey" },
    {
      headers: {
        Authorization: "Bearer YOUR_PERSONAL_ACCESS_TOKEN",
        "Content-Type": "application/json"
      }
    }
  );

  console.log(response.data);
}

connectSession();
```

Response examples:
Success Response - QR Code Needed:
```json
{
  "success": true,
  "data": {
    "status": "NEED_SCAN",
    "qrCode": "2@DTMUHeYfa9/RMXr8A2IP3/..."
  }
}
```
Success Response - Passkey Needed:
```json
{
  "success": true,
  "data": {
    "status": "NEED_PASSKEY",
    "passkey": {
      "token": "temporary-passkey-token",
      "expires_at": "2026-07-09T12:30:00Z"
    }
  }
}
```
Success Response - Already Connected:
```json
{
  "success": true,
  "data": {
    "status": "CONNECTED",
    "message": "Session already initialized or connecting. No QR code needed."
  }
}
```
Error Response - No Subscription:
```json
{
  "success": false,
  "error": "You need to have an active subscription to connect a WhatsApp session."
}
```

