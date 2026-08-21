# Get WhatsApp Session Details

> Source: https://www.wasenderapi.com/api-docs/sessions/get-whatsapp-session-details
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/get-whatsapp-session-details
Endpoint: GET /api/whatsapp-sessions/{whatsappSession}
Description: Retrieves details for a specific WhatsApp session.

Details:
Get WhatsApp Session Details

 Retrieves details for a specific WhatsApp session.

 This endpoint requires an access token to be included in the Authorization header.
 You can get the token from here.

Parameters:
- whatsappSession (integer, required): ID of the WhatsApp session.

Code examples:
```bash
curl "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}"
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN"
```
```python
import requests

url = "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}"
headers = {
    "Authorization": "Bearer YOUR_PERSONAL_ACCESS_TOKEN"
}
response = requests.get(url, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}", {
    method: 'GET',
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
$url = 'https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}';

try {
    $response = $client->get($url, [
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
require 'json'

uri = URI.parse('https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Get.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_PERSONAL_ACCESS_TOKEN'

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
    url := "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}"
    apiKey := "YOUR_PERSONAL_ACCESS_TOKEN"

    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        panic(err)
    }

    req.Header.Add("Authorization", "Bearer " + apiKey)

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
        var client = new RestClient("https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}");
        var request = new RestRequest(Method.GET);
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
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}"))
            .header("Authorization", "Bearer YOUR_PERSONAL_ACCESS_TOKEN")
            .method("GET", HttpRequest.BodyPublishers.noBody());

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}")!
var request = URLRequest(url: url)
request.httpMethod = "GET"
request.setValue("Bearer YOUR_PERSONAL_ACCESS_TOKEN", forHTTPHeaderField: "Authorization")

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
$uri = "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}"
$headers = @{
    "Authorization" = "Bearer YOUR_PERSONAL_ACCESS_TOKEN"
}
$response = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'GET',
      url: 'https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}',
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
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}";
    let api_key = "YOUR_PERSONAL_ACCESS_TOKEN";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);

    let client = reqwest::Client::new();
    let response = client.GET(url)
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
    "data": {
        "id": 1,
        "name": "Business WhatsApp",
        "phone_number": "+1234567890",
        "status": "connected",
        "account_protection": true,
        "log_messages": true,
        "webhook_url": "https://example.com/webhook",
        "webhook_enabled": true,
        "webhook_events": [
            "message",
            "group_update"
        ],
        "api_key": "75075a7bf6417bff59e76fb7205382c2dc74cf1769e76f382c2dc74cf176c0bf",
        "webhook_secret": "fb61be92ddb7935e0cedcec58e470f6c",
        "created_at": "2025-04-01T12:00:00Z",
        "updated_at": "2025-05-08T15:30:00Z"
    }
}
```

