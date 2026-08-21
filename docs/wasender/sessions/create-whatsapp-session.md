# Create WhatsApp Session

> Source: https://www.wasenderapi.com/api-docs/sessions/create-whatsapp-session
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/create-whatsapp-session
Endpoint: POST /api/whatsapp-sessions
Description: Creates a new WhatsApp session with the provided details. Requires an active subscription and is subject to session limits.

Details:
Create WhatsApp Session

 Creates a new WhatsApp session with the provided details. Requires an active subscription and is subject to session limits.

 This endpoint requires an access token to be included in the Authorization header.
 You can get the token from here.

Parameters:
- name (string, required): Name of the WhatsApp session.
- phone_number (string, required): Phone number in international format.
- account_protection (boolean, required): Enable account protection features.
- log_messages (boolean, required): Enable message logging.
- webhook_url (string, optional): URL for receiving webhook notifications.
- webhook_enabled (boolean, optional): Enable webhook notifications.
- webhook_events (array, optional): Array of events to receive webhook notifications for.
- read_incoming_messages (boolean, optional): Enable the option to automatically mark messages as read when they are received.
- auto_reject_calls (boolean, optional): Enable automatic rejection of incoming calls.
- ignore_groups (boolean, optional): ignore all webhook events from groups.
- ignore_channels (boolean, optional): ignore all webhook events from channels (newsletters).
- ignore_broadcasts (boolean, optional): ignore all webhook events from broadcast lists.
- proxy_url (string, optional): Allowed protocols: http, https, socks5. Use a public domain only (IP addresses and local/private networks are blocked).
- always_online (boolean, optional): When enabled, your session will always appear online to your contacts, even when you're not actively using WhatsApp.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/whatsapp-sessions"
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN"
  -H "Content-Type: application/json"
  -d '{
    "name": "Sample Name",
    "phone_number": "Sample Phone_number",
    "account_protection": true,
    "log_messages": true,
    "read_incoming_messages": false,
    "webhook_url": "Sample Webhook_url",
    "webhook_enabled": true,
    "webhook_events": [
        "messages.received",
        "session.status",
        "messages.update"
    ]
  }'
```
```python
import requests

url = "https://www.wasenderapi.com/api/whatsapp-sessions"
headers = {
    "Authorization": "Bearer YOUR_PERSONAL_ACCESS_TOKEN",
    "Content-Type": "application/json"
}

data = {
    "name": "Sample Name",
    "phone_number": "Sample Phone_number",
    "account_protection": True,
    "log_messages": True,
    "read_incoming_messages": False,
    "webhook_url": "Sample Webhook_url",
    "webhook_enabled": True,
    "webhook_events": [
        "messages.received",
        "session.status",
        "messages.update"
    ]
}

response = requests.post(url, json=data, headers=headers)
print(response.status_code)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/whatsapp-sessions", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_PERSONAL_ACCESS_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: "Sample Name",
      phone_number: "Sample Phone_number",
      account_protection: true,
      log_messages: true,
      read_incoming_messages: false,
      webhook_url: "Sample Webhook_url",
      webhook_enabled: true,
      webhook_events: [
        "messages.received",
        "session.status",
        "messages.update"
      ]
    })
  });

  const result = await response.json();
  console.log(result);
}

callApi();
```
```php
<?php
require 'vendor/autoload.php'; // Assuming Guzzle is installed

use GuzzleHttp\Client;

$client = new Client();
$apiKey = 'YOUR_PERSONAL_ACCESS_TOKEN';
$url = 'https://www.wasenderapi.com/api/whatsapp-sessions';

try {
    $response = $client->post($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' => [
            'name' => 'Sample Name',
            'phone_number' => 'Sample Phone_number',
            'account_protection' => true,
            'log_messages' => true,
            'read_incoming_messages' => false,
            'webhook_url' => 'Sample Webhook_url',
            'webhook_enabled' => true,
            'webhook_events' => [
                'messages.received',
                'session.status',
                'messages.update'
            ],
        ]
    ]);

    echo $response->getBody();
} catch (\GuzzleHttp\Exception\RequestException $e) {
    echo "Request failed: " . $e->getMessage();
    if ($e->hasResponse()) {
        echo "\nResponse: " . $e->getResponse()->getBody();
    }
}
```
```ruby
require 'net/http'
require 'uri'
require 'json'

uri = URI.parse('https://www.wasenderapi.com/api/whatsapp-sessions')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_PERSONAL_ACCESS_TOKEN'
request['Content-Type'] = 'application/json'

payload = {
  name: 'Sample Name',
  phone_number: 'Sample Phone_number',
  account_protection: true,
  log_messages: true,
  read_incoming_messages: false,
  webhook_url: 'Sample Webhook_url',
  webhook_enabled: true,
  webhook_events: [
    'messages.received',
    'session.status',
    'messages.update'
  ]
}

request.body = payload.to_json

response = http.request(request)
puts JSON.parse(response.body)
```
```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {
    url := "https://www.wasenderapi.com/api/whatsapp-sessions"
    apiKey := "YOUR_PERSONAL_ACCESS_TOKEN"

    // Define payload using a struct or a map (using map for quick editing)
    payload := map[string]interface{}{
        "name":                   "Sample Name",
        "phone_number":           "Sample Phone_number",
        "account_protection":     true,
        "log_messages":           true,
        "read_incoming_messages": false,
        "webhook_url":            "Sample Webhook_url",
        "webhook_enabled":        true,
        "webhook_events": []string{
            "messages.received",
            "session.status",
            "messages.update",
        },
    }

    jsonData, err := json.Marshal(payload)
    if err != nil {
        panic(err)
    }

    req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
    if err != nil {
        panic(err)
    }

    req.Header.Add("Authorization", "Bearer "+apiKey)
    req.Header.Add("Content-Type", "application/json")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println(string(body))
}
```
```csharp
using RestSharp;
using System;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        var client = new RestClient("https://www.wasenderapi.com/api/whatsapp-sessions");
        var request = new RestRequest(Method.POST);
        request.AddHeader("Authorization", "Bearer YOUR_PERSONAL_ACCESS_TOKEN");
        request.AddHeader("Content-Type", "application/json");

        var body = @"{
            ""name"": ""Sample Name"",
            ""phone_number"": ""Sample Phone_number"",
            ""account_protection"": true,
            ""log_messages"": true,
            ""read_incoming_messages"": true,
            ""webhook_url"": ""Sample Webhook_url"",
            ""webhook_enabled"": true,
            ""webhook_events"": [
                ""messages.received"",
                ""session.status"",
                ""messages.update""
            ]
        }";

        request.AddParameter("application/json", body, ParameterType.RequestBody);

        var response = await client.ExecuteAsync(request);
        Console.WriteLine(response.Content);
    }
}
```
```java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ApiClient {
    public static void main(String[] args) throws IOException, InterruptedException {
        HttpClient client = HttpClient.newHttpClient();

        String json = "{"
            + "\"name\":\"Sample Name\","
            + "\"phone_number\":\"Sample Phone_number\","
            + "\"account_protection\":true,"
            + "\"log_messages\":true,"
            + "\"read_incoming_messages\":true,"
            + "\"webhook_url\":\"Sample Webhook_url\","
            + "\"webhook_enabled\":true,"
            + "\"webhook_events\":["
            +     "\"messages.received\","
            +     "\"session.status\","
            +     "\"messages.update\""
            + "]"
            + "}";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/whatsapp-sessions"))
            .header("Authorization", "Bearer YOUR_PERSONAL_ACCESS_TOKEN")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/whatsapp-sessions")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer YOUR_PERSONAL_ACCESS_TOKEN", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = [
    "name": "Sample Name",
    "phone_number": "Sample Phone_number",
    "account_protection": true,
    "log_messages": true,
    "read_incoming_messages": false,
    "webhook_url": "Sample Webhook_url",
    "webhook_enabled": true,
    "webhook_events": [
        "messages.received",
        "session.status",
        "messages.update"
    ]
]

let bodyData = try? JSONSerialization.data(withJSONObject: body, options: [])
request.httpBody = bodyData

let task = URLSession.shared.dataTask(with: request) { data, response, error in
    if let error = error {
        print("Error: \(error)")
        return
    }

    guard let data = data else {
        print("No data received")
        return
    }

    if let jsonString = String(data: data, encoding: .utf8) {
        print(jsonString)
    }
}

task.resume()
```
```powershell
$uri = "https://www.wasenderapi.com/api/whatsapp-sessions"
$headers = @{
    "Authorization" = "Bearer YOUR_PERSONAL_ACCESS_TOKEN"
    "Content-Type" = "application/json"
}
$body = @'
{
    "name": "Sample Name",
    "phone_number": "Sample Phone_number",
    "account_protection": true,
    "log_messages": true,
    "read_incoming_messages": false,
    "webhook_url": "Sample Webhook_url",
    "webhook_enabled": true,
    "webhook_events": [
        "messages.received",
        "session.status",
        "messages.update"
    ]
}
'@

$response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body -ContentType "application/json"
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'POST',
      url: 'https://www.wasenderapi.com/api/whatsapp-sessions',
      headers: {
        'Authorization': 'Bearer YOUR_PERSONAL_ACCESS_TOKEN',
        'Content-Type': 'application/json'
      },
      data: {
        name: "Sample Name",
        phone_number: "Sample Phone_number",
        account_protection: true,
        log_messages: true,
        read_incoming_messages: false,
        webhook_url: "Sample Webhook_url",
        webhook_enabled: true,
        webhook_events: [
          "messages.received",
          "session.status",
          "messages.update"
        ]
      }
    };

    const response = await axios(config);
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

callApi();
```
```rust
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "https://www.wasenderapi.com/api/whatsapp-sessions";
    let api_key = "YOUR_PERSONAL_ACCESS_TOKEN";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let client = reqwest::Client::new();
    let response = client.post(url)
        .headers(headers)
        .json(&json!({
            "name": "Sample Name",
            "phone_number": "Sample Phone_number",
            "account_protection": true,
            "log_messages": true,
            "read_incoming_messages": false,
            "webhook_url": "Sample Webhook_url",
            "webhook_enabled": true,
            "webhook_events": [
                "messages.received",
                "session.status",
                "messages.update"
            ]
        }))
        .send()
        .await?;

    let json_response = response.json::<serde_json::Value>().await?;
    println!("{:#?}", json_response);

    Ok(())
}
```

Response examples:
Success Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Business WhatsApp",
    "phone_number": "+1234567890",
    "status": "connected",
    "account_protection": true,
    "log_messages": true,
    "read_incoming_messages": false,
    "webhook_url": "https://example.com/webhook",
    "webhook_enabled": true,
    "webhook_events": [
      "messages.received",
      "session.status",
      "messages.update"
    ],
    "api_key": "75075a7bf6417bff59e76fb7205382c2dc74cf1769e76f382c2dc74cf176c0bf",
    "webhook_secret": "fb61be92ddb7935e0cedcec58e470f6c",
    "created_at": "2025-04-01T12:00:00Z",
    "updated_at": "2025-05-08T15:30:00Z"
  }
}
```
Error Response - Session Limit:
```json
{
    "success": false,
    "error": "You have reached your WhatsApp session limit. Please upgrade your plan to add more sessions."
}
```

