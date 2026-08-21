# Mark Message as Read

> Source: https://www.wasenderapi.com/api-docs/messages/mark-message-as-read
> Category: Messages
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/messages/mark-message-as-read
Endpoint: POST /api/messages/read
Description: Marks a specific received WhatsApp message as read (blue ticks).

Details:
Mark Message as Read

 This endpoint allows you to programmatically mark a message as read, which will trigger the "blue ticks" on the sender's device.

 To mark a message as read, you must pass the exact key object associated with the message. You typically receive this key object in incoming message webhooks (e.g., messages.received).

 The key object must contain three properties: id, remoteJid, and fromMe.

Parameters:
- key (object, required): The exact message key object representing the message you want to mark as read.
- key.id (string, required): The unique message ID (e.g., 3EB06A5E244031B4A5D1).
- key.remoteJid (string, required): The JID of the chat where the message was sent (e.g., 1234567890@s.whatsapp.net).
- key.fromMe (boolean, required): Indicates if the message was sent by you (`true`) or received (`false`). Usually `false` when marking incoming messages as read.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/messages/read" 
  -H "Authorization: Bearer YOUR_API_KEY" 
  -H "Content-Type: application/json" 
  -d '{
    "key": {
        "id": "3EB06A5E244031B4A5D1",
        "remoteJid": "1234567890@s.whatsapp.net",
        "fromMe": false
    }
}'
```
```python
import requests

url = "https://www.wasenderapi.com/api/messages/read"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

data = {
    "key": {
        "id": "3EB06A5E244031B4A5D1",
        "remoteJid": "1234567890@s.whatsapp.net",
        "fromMe": False
    }
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/messages/read", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      "key": {
          "id": "3EB06A5E244031B4A5D1",
          "remoteJid": "1234567890@s.whatsapp.net",
          "fromMe": false
      }
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
$apiKey = 'YOUR_API_KEY';
$url = 'https://www.wasenderapi.com/api/messages/read';

try {
    $response = $client->post($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' => [
            'key' => [
                'id' => '3EB06A5E244031B4A5D1',
                'remoteJid' => '1234567890@s.whatsapp.net',
                'fromMe' => false
            ]
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

uri = URI.parse('https://www.wasenderapi.com/api/messages/read')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'

request.body = {
  key: {
    id: "3EB06A5E244031B4A5D1",
    remoteJid: "1234567890@s.whatsapp.net",
    fromMe: false
  }
}.to_json

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
    url := "https://www.wasenderapi.com/api/messages/read"
    apiKey := "YOUR_API_KEY"

    payloadMap := map[string]interface{}{
        "key": map[string]interface{}{
            "id": "3EB06A5E244031B4A5D1",
            "remoteJid": "1234567890@s.whatsapp.net",
            "fromMe": false,
        },
    }
    payload, _ := json.Marshal(payloadMap)

    req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
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
        var client = new RestClient("https://www.wasenderapi.com/api/messages/read");
        var request = new RestRequest(Method.POST);
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");
        request.AddHeader("Content-Type", "application/json");

        var body = @"{
            ""key"": {
                ""id"": ""3EB06A5E244031B4A5D1"",
                ""remoteJid"": ""1234567890@s.whatsapp.net"",
                ""fromMe"": false
            }
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

        String jsonPayload = """
            {
                "key": {
                    "id": "3EB06A5E244031B4A5D1",
                    "remoteJid": "1234567890@s.whatsapp.net",
                    "fromMe": false
                }
            }
        """;

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/messages/read"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/messages/read")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = [
    "key": [
        "id": "3EB06A5E244031B4A5D1",
        "remoteJid": "1234567890@s.whatsapp.net",
        "fromMe": false
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
$uri = "https://www.wasenderapi.com/api/messages/read"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type"  = "application/json"
}
$body = @'
{
    "key": {
        "id": "3EB06A5E244031B4A5D1",
        "remoteJid": "1234567890@s.whatsapp.net",
        "fromMe": $false
    }
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
      url: 'https://www.wasenderapi.com/api/messages/read',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      data: {
        "key": {
            "id": "3EB06A5E244031B4A5D1",
            "remoteJid": "1234567890@s.whatsapp.net",
            "fromMe": false
        }
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
    let url = "https://www.wasenderapi.com/api/messages/read";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}"), api_key))?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let client = reqwest::Client::new();
    let response = client.post(url)
        .headers(headers)
        .json(&json!({
            "key": {
                "id": "3EB06A5E244031B4A5D1",
                "remoteJid": "1234567890@s.whatsapp.net",
                "fromMe": false
            }
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
        "status": "read"
    }
}
```
Error Response (Validation):
```json
{
    "success": false,
    "error": "The key.id field is required and must be a non-empty string."
}
```

