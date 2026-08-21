# Send Channel Message

> Source: https://www.wasenderapi.com/api-docs/channels-communities/send-channel-message
> Category: Channels (Communities)
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/channels-communities/send-channel-message
Endpoint: POST /api/send-message
Description: Sends a message to a specific WhatsApp channel using its Channel ID.

Details:
Send Message to a WhatsApp Channel

 To send a message to a WhatsApp Channel, follow these steps:

 -
 First, listen for the message.upsert event.
 This event will include the channel's unique ID (e.g., 123456789@newsletter) in the jid field.

 -
 Once you have the channel ID, use it in the to field when sending a message through your usual send endpoint.

 -
 The message parameters are the same as those for regular messages. Just ensure the to field is set to the channel's ID.

Parameters:
- to (string, required): Channel ID (e.g., '123456789@newsletter') .
- text (string, required): The text content of the message. Required if no media/contact/location is sent.
- imageUrl (string, optional): URL of the image to send.
- videoUrl (string, optional): URL of the video to send.
- documentUrl (string, optional): URL of the document to send.
- audioUrl (string, optional): URL of the audio file to send (sent as voice note).
- stickerUrl (string, optional): URL of the sticker (.webp) to send.
- contact (object, optional): Contact card object.
- location (object, optional): Location object.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/send-message"
  -H "Authorization: Bearer YOUR_API_KEY"
  -H "Content-Type: application/json"
  -d '{
      "to": "123456789@newsletter",
      "text": "Hello everyone in the channel!"
  }'
```
```python
import requests

url = "https://www.wasenderapi.com/api/send-message"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
data = {"to": "123456789@newsletter", "text": "Hello everyone in the channel!"}
response = requests.post(url, json=data, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/send-message", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({"to":"123456789@newsletter","text":"Hello everyone in the channel !"})
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
$url = 'https://www.wasenderapi.com/api/send-message';

try {
    $response = $client->post($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' =>             [
            'to' => '123456789@newsletter',
            'text' => 'Hello everyone in the channel!',
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

uri = URI.parse('https://www.wasenderapi.com/api/send-message')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'
request.body = {"to":"123456789@newsletter","text":"Hello everyone in the channel!"}.to_json

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
    url := "https://www.wasenderapi.com/api/send-message"
    apiKey := "YOUR_API_KEY"

    payload := []byte(`{"to":"123456789@newsletter","text":"Hello everyone in the channel!"}`)
    req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
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
using System;
using System.Threading.Tasks;
using RestSharp;

class Program
{
    static async Task Main(string[] args)
    {
        var client = new RestClient("https://www.wasenderapi.com/api/send-message");
        var request = new RestRequest(Method.Post);
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");
        request.AddHeader("Content-Type", "application/json");
        var body = @"{""to"":""123456789@newsletter"",""text"":""Hello everyone in the channel!""}";
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
            .uri(URI.create("https://www.wasenderapi.com/api/send-message"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .header("Content-Type", "application/json")
            .method("POST", HttpRequest.BodyPublishers.ofString("{\"to\":\"123456789@newsletter\",\"text\":\"Hello everyone in the channel!\"}"));

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/send-message")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = {"to":"123456789@newsletter","text":"Hello everyone in the channel!"}
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
$uri = "https://www.wasenderapi.com/api/send-message"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
}
$body = @'
{
    "to": "123456789@newsletter",
    "text": "Hello everyone in the channel!"
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
      url: 'https://www.wasenderapi.com/api/send-message',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      data: {"to":"123456789@newsletter","text":"Hello everyone in the channel!"}
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
    let url = "https://www.wasenderapi.com/api/send-message";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let client = reqwest::Client::new();
    let response = client.POST(url)
        .headers(headers)
        .json(&json!({"to":"123456789@newsletter","text":"Hello everyone in the channel!"}))
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
    "msgId": 100000,
    "jid": "+123456789",
    "status": "in_progress"
  }
}
```

