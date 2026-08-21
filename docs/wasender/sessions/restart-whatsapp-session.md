# Restart WhatsApp Session

> Source: https://www.wasenderapi.com/api-docs/sessions/restart-whatsapp-session
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/restart-whatsapp-session
Endpoint: POST /api/whatsapp-sessions/{whatsappSession}/restart
Description: Restarts a specific, currently connected WhatsApp session.

Details:
Restart WhatsApp Session

 This endpoint initiates a soft restart of the WhatsApp session connection. It is useful for refreshing the connection to the server without needing to re-scan a QR code.

 The session must be in a connected state for the restart to be successful. If the session is disconnected or in another state, the request will fail.

Parameters:
- whatsappSession (integer, required): The unique identifier of the WhatsApp session to restart.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart" 
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN"
```
```python
import requests

url = "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart"
headers = {"Authorization": "Bearer YOUR_PERSONAL_ACCESS_TOKEN"}

response = requests.post(url, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_PERSONAL_ACCESS_TOKEN'
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
$apiKey = 'YOUR_PERSONAL_ACCESS_TOKEN';
$sessionId = 'whatsapp-sessions/my-session-123';
$url = 'https://www.wasenderapi.com/api/' . $sessionId . '/restart';

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

uri = URI.parse('https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_PERSONAL_ACCESS_TOKEN'

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
    url := "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart"
    apiKey := "YOUR_PERSONAL_ACCESS_TOKEN"

    req, err := http.NewRequest("POST", url, nil) // No body
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
        var client = new RestClient("https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart");
        var request = new RestRequest(Method.POST);
        request.AddHeader("Authorization", "Bearer YOUR_PERSONAL_ACCESS_TOKEN");

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
            .uri(URI.create("https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart"))
            .header("Authorization", "Bearer YOUR_PERSONAL_ACCESS_TOKEN")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer YOUR_PERSONAL_ACCESS_TOKEN", forHTTPHeaderField: "Authorization")

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
$uri = "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart"
$headers = @{
    "Authorization" = "Bearer YOUR_PERSONAL_ACCESS_TOKEN"
}

$response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'post',
      url: 'https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart',
      headers: {
        'Authorization': 'Bearer YOUR_PERSONAL_ACCESS_TOKEN'
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
    let url = "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/restart";
    let api_key = "YOUR_PERSONAL_ACCESS_TOKEN";

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
    "message": "WhatsApp session restarted successfully."
}
```
Error Response (Not Connected):
```json
{
    "success": false,
    "error": "WhatsApp session is not connected. Cannot restart."
}
```

