# Edit a Message

> Source: https://www.wasenderapi.com/api-docs/messages/edit-a-message
> Category: Messages
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/messages/edit-a-message
Endpoint: PUT /api/messages/{msgId}
Description: Edits the text content of a previously sent message. Note: This is usually only possible for a short period after the message was sent.

Details:
Edit a Message

 Edits the text content of a previously sent message. Note: This is usually only possible for a short period after the message was sent.

Parameters:
- msgId (integer, required): The ID of the message to retrieve information for its returned from send-message endpoints.
- text (string, required): The new text content for the message.

Code examples:
```bash
curl -X PUT "https://www.wasenderapi.com/api/messages/{msgId}"
  -H "Authorization: Bearer YOUR_API_KEY"
  -H "Content-Type: application/json"
  -d '{
      "text": "This is the new message content",
  }'
```
```python
import requests

url = "https://www.wasenderapi.com/api/messages/{msgId}"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
data = {"text": "This is the new message content",}
response = requests.put(url, json=data, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/messages/{msgId}", {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({"text": "This is the new message content"})
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
$url = 'https://www.wasenderapi.com/api/messages/{msgId}';

try {
    $response = $client->put($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' => ['text' => 'This is the new message content']
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

uri = URI.parse('https://www.wasenderapi.com/api/messages/{msgId}')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Put.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'
request.body = {"text": "This is the new message content"}.to_json

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
    url := "https://www.wasenderapi.com/api/messages/{msgId}"
    apiKey := "YOUR_API_KEY"

    payload := []byte(`{"text": "This is the new message content"}`)
    req, err := http.NewRequest("PUT", url, bytes.NewBuffer(payload))
    if err != nil {
        panic(err)
    }

    req.Header.Add("Authorization", "Bearer " + apiKey)
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
        var client = new RestClient("https://www.wasenderapi.com/api/messages/{msgId}");
        var request = new RestRequest(Method.PUT);
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");
        request.AddHeader("Content-Type", "application/json");
        var body = @"{"text": "This is the new message content"}";
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
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/messages/{msgId}"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .header("Content-Type", "application/json")
            .method("PUT", HttpRequest.BodyPublishers.ofString("{"text": "This is the new message content"}"));

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/messages/{msgId}")!
var request = URLRequest(url: url)
request.httpMethod = "PUT"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = {"text": "This is the new message content"}
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
$uri = "https://www.wasenderapi.com/api/messages/{msgId}"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
}
$body = @'
{
    "text": "This is the new message content",
}
'@

$response = Invoke-RestMethod -Uri $uri -Method PUT -Headers $headers -Body $body -ContentType "application/json"
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'PUT',
      url: 'https://www.wasenderapi.com/api/messages/{msgId}',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      data: {"text": "This is the new message content"}
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
    let url = "https://www.wasenderapi.com/api/messages/{msgId}";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let client = reqwest::Client::new();
    let response = client.PUT(url)
        .headers(headers)
        .json(&json!({"text": "This is the new message content"}))
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
        "remoteJid": "123456789@s.whatsapp.net",
        "id": "EN82FV0387IVR54JTE2R1",
        "msgId": 100000,
        "key": {
            "id": "EN82FV0387IVR54JTE2R1",
            "fromMe": true,
            "remoteJid": "123456789@s.whatsapp.net"
        },
      "message": {
            "protocolMessage": {
                "key": {
                    "id": "EN82FV0387IVR54JTE2R1",
                    "fromMe": true,
                    "remoteJid": "123456789@s.whatsapp.net"
                },
                "type": 14,
                "timestampMs": 1751302295563,
                "editedMessage": {
                    "extendedTextMessage": {
                        "text": "updated"
                    }
                }
            }
        "messageTimestamp": "1751297488",
        "status": 1
    }
}
```

