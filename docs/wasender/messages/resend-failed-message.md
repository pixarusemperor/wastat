# Resend Failed Message

> Source: https://www.wasenderapi.com/api-docs/messages/resend-failed-message
> Category: Messages
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/messages/resend-failed-message
Endpoint: POST /api/messages/{message}/resend
Description: Initiates the resending of a previously failed message from the logs.

Details:
Resend Failed Message

 This endpoint allows you to attempt to resend a message from your logs that has previously failed. The message must have a status of "failed" for this operation to be permitted.

 Important: Message logging must be enabled for your session to use this feature, as the endpoint relies on the stored message content to perform the resend. The API key you use must belong to the same session that originally sent the message.

 Upon a successful request, the message status is updated to "in_progress" and it is re-queued for sending. The success response indicates that the resend has been initiated, not that it has been delivered.

Parameters:
- message (integer, required): The unique ID of the failed message log to be resent.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend" 
  -H "Authorization: Bearer YOUR_API_KEY"
```
```python
import requests

url = "https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend"
headers = {"Authorization": "Bearer YOUR_API_KEY"}

response = requests.post(url, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
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
$messageId = 'failed-msg-id-123';
$url = 'https://www.wasenderapi.com/api/messages/' . $messageId . '/resend';

try {
    $response = $client->post($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Accept' => 'application/json',
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

uri = URI.parse('https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'

response = http.request(request)
puts response.body
```
```go
package main

import (
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {
    url := "https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend"
    apiKey := "YOUR_API_KEY"

    req, err := http.NewRequest("POST", url, nil)
    if err != nil {
        panic(err)
    }

    req.Header.Add("Authorization", "Bearer "+apiKey)

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
        var client = new RestClient("https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend");
        var request = new RestRequest(Method.POST);
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");

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

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")

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
```powershell
$uri = "https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend"
$headers = @{"Authorization" = "Bearer YOUR_API_KEY"}

$response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'post',
      url: 'https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY'
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
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "https://www.wasenderapi.com/api/messages/failed-msg-id-123/resend";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}"), api_key))?);

    let client = reqwest::Client::new();
    let response = client.post(url)
        .headers(headers)
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
    "message": "Message resend initiated successfully."
}
```
Error Response (Not Failed):
```json
{
    "success": false,
    "error": "Only messages with status 'failed' can be resent."
}
```
Error Response (Unauthorized):
```json
{
    "success": false,
    "error": "You are not authorized to modify this message."
}
```

