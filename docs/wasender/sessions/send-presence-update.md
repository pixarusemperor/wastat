# Send Presence Update

> Source: https://www.wasenderapi.com/api-docs/sessions/send-presence-update
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/send-presence-update
Endpoint: POST /api/send-presence-update
Description: Sends a presence update to a specific JID (e.g., 'typing...' or 'recording...') to indicate user activity. This requires an active session.

Details:
Send Presence Update

 Sends a presence update to a specific JID (e.g., typing... or recording...)
 to indicate user activity. This requires an active session.

 Supported Types

 - composing – Indicates the user is typing.

 - recording – Indicates the user is recording a voice message.

 - available – Marks the user as online/active.

 - unavailable – Marks the user as offline/inactive.

 Rules

 -
 When using composing or recording, the presence
 must be sent to the contact’s JID (the person you are chatting with).

 -
 When using available or unavailable, the presence
 must be sent with your own number as the JID.

Parameters:
- jid (string, required): WhatsApp JID of the recipient (e.g., `1234567890@s.whatsapp.net`).
- type (string, required): The presence state to send. Must be one of: composing, recording, available, or unavailable.
- delayMs (integer, optional): Optional duration in milliseconds to show the presence update.

Code examples:
```bash
curl -X POST \
  "https://www.wasenderapi.com/api/send-presence-update" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jid": "1234567890@s.whatsapp.net",
    "type": "composing"
  }'
```
```python
import requests

url = "https://www.wasenderapi.com/api/send-presence-update"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

data = {
    "jid": "1234567890@s.whatsapp.net",
    "type": "composing"
}

response = requests.post(url, json=data, headers=headers)
print(response.status_code)
print(response.json())
```
```javascript
async function sendPresenceUpdate() {
  const response = await fetch("https://www.wasenderapi.com/api/send-presence-update", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jid: "1234567890@s.whatsapp.net",
      type: "composing"
    })
  });

  const result = await response.json();
  console.log(result);
}

sendPresenceUpdate();
```
```php
<?php
require 'vendor/autoload.php';

use GuzzleHttp\Client;

$client = new Client();
$apiKey = 'YOUR_API_KEY';
$url = 'https://www.wasenderapi.com/api/send-presence-update';

try {
    $response = $client->post($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' => [
            'jid' => '1234567890@s.whatsapp.net',
            'type' => 'composing',
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

uri = URI.parse('https://www.wasenderapi.com/api/send-presence-update')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'

payload = {
  jid: '1234567890@s.whatsapp.net',
  type: 'composing'
}

request.body = payload.to_json
response = http.request(request)
puts JSON.parse(response.body)
```
```Go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {
    url := "https://www.wasenderapi.com/api/send-presence-update"
    apiKey := "YOUR_API_KEY"

    payload := map[string]interface{}{
        "jid":  "1234567890@s.whatsapp.net",
        "type": "composing",
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
```C#
using RestSharp;
using System;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        var client = new RestClient("https://www.wasenderapi.com/api/send-presence-update");
        var request = new RestRequest(Method.POST);
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");
        request.AddHeader("Content-Type", "application/json");

        var body = @"{
            ""jid"": ""1234567890@s.whatsapp.net"",
            ""type"": ""composing""
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
            + "\"jid\":\"1234567890@s.whatsapp.net\","
            + "\"type\":\"composing\""
            + "}";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/send-presence-update"))
            .header("Authorization", "Bearer YOUR_API_KEY")
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

let url = URL(string: "https://www.wasenderapi.com/api/send-presence-update")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = [
    "jid": "1234567890@s.whatsapp.net",
    "type": "composing"
]

let bodyData = try? JSONSerialization.data(withJSONObject: body, options: [])
request.httpBody = bodyData

let task = URLSession.shared.dataTask(with: request) { data, response, error in
    if let error = error {
        print("Error: \(error)")
        return
    }
    guard let data = data, let jsonString = String(data: data, encoding: .utf8) else {
        print("No data received")
        return
    }
    print(jsonString)
}

task.resume()
```
```poweshell
$uri = "https://www.wasenderapi.com/api/send-presence-update"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
}
$body = @{
    "jid" = "1234567890@s.whatsapp.net"
    "type" = "composing"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body -ContentType "application/json"
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function sendPresenceUpdate() {
  try {
    const config = {
      method: 'POST',
      url: 'https://www.wasenderapi.com/api/send-presence-update',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      data: {
        jid: "1234567890@s.whatsapp.net",
        type: "composing"
      }
    };

    const response = await axios(config);
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

sendPresenceUpdate();
```
```rust
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "https://www.wasenderapi.com/api/send-presence-update";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let client = reqwest::Client::new();
    let response = client.post(url)
        .headers(headers)
        .json(&json!({
            "jid": "1234567890@s.whatsapp.net",
            "type": "composing"
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
    "jid": "123456789@whatsapp.net",
    "type": "composing"
  }
}
```
Error Response - Invalid JID:
```json
{
 "success": false,
 "error": "Error sending presence update: Invalid JID provided."
}
```

