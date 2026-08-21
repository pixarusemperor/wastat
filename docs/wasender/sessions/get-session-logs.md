# Get Session Logs

> Source: https://www.wasenderapi.com/api-docs/sessions/get-session-logs
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/get-session-logs
Endpoint: GET /api/whatsapp-sessions/{whatsappSession}/session-logs
Description: Retrieves a paginated list of session activity logs.

Details:
Get Session Logs

 This endpoint fetches a paginated history of significant events for the specified WhatsApp session. These logs are crucial for debugging connection issues, tracking the session's lifecycle (e.g., when it connected, disconnected, or received a QR code), and general auditing.

 The response is a standard paginated object, which you can navigate using the page and per_page query parameters.

Parameters:
- whatsappSession (integer, required): The unique identifier of the WhatsApp session.
- page (integer, optional): The page number to retrieve. Defaults to 1.
- per_page (integer, optional): The number of items to retrieve per page. Defaults to 10.

Code examples:
```bash
curl -X GET "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs?page=1&per_page=15" 
  -H "Authorization: Bearer YOUR_API_KEY"
```
```python
import requests

url = "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs"
headers = {"Authorization": "Bearer YOUR_API_KEY"}
params = {
    "page": 1,
    "per_page": 15
}

response = requests.get(url, headers=headers, params=params)
print(response.json())
```
```javascript
async function callApi() {
  const url = new URL("https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs");
  url.searchParams.append('page', '1');
  url.searchParams.append('per_page', '15');

  const response = await fetch(url, {
    method: 'GET',
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
$sessionId = 'whatsapp-sessions/my-session-123';
$url = 'https://www.wasenderapi.com/api/' . $sessionId . '/session-logs';

try {
    $response = $client->get($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Accept' => 'application/json',
        ],
        'query' => [
            'page' => 1,
            'per_page' => 15
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

uri = URI.parse('https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs')
uri.query = URI.encode_www_form({ page: 1, per_page: 15 })

http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Get.new(uri.request_uri)
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
    baseUrl := "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs"
    apiKey := "YOUR_API_KEY"

    req, err := http.NewRequest("GET", baseUrl, nil)
    if err != nil {
        panic(err)
    }

    q := req.URL.Query()
    q.Add("page", "1")
    q.Add("per_page", "15")
    req.URL.RawQuery = q.Encode()

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
        var client = new RestClient("https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs?page=1&per_page=15");
        var request = new RestRequest(Method.GET);
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
            .uri(URI.create("https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs?page=1&per_page=15"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .GET()
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}
```
```swift
import Foundation

var components = URLComponents(string: "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs")!
components.queryItems = [
    URLQueryItem(name: "page", value: "1"),
    URLQueryItem(name: "per_page", value: "15")
]

let url = components.url!
var request = URLRequest(url: url)
request.httpMethod = "GET"
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
$uri = "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs"
$params = @{ page = 1; per_page = 15 }
$headers = @{"Authorization" = "Bearer YOUR_API_KEY"}

$response = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -Body $params
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'get',
      url: 'https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY'
      },
      params: {
        page: 1,
        per_page: 15
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
    let url = "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/session-logs";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap.new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}"), api_key))?);

    let client = reqwest::Client::new();
    let response = client.get(url)
        .headers(headers)
        .query(&[("page", 1), ("per_page", 15)])
        .send()
        .await?;

    let json_response = response.json::<serde_json::Value>().await?;
    println!("{:#?}", json_response);

    Ok(())
}
```

Response examples:
Success Response (Paginated):
```json
{
    "success": true,
    "data": {
        "current_page": 1,
        "data": [
            {
                "id": 201,
                "whatsapp_session_id": 1,
                "event_type": "session_restarted",
                "status":"connected",
                "occurred_at": "2025-09-23T12:00:00.000000Z"
            },
            {
                "id": 200,
                "whatsapp_session_id": 1,
                "event_type": "status_change",
                "status": "need_scan",
                "occurred_at": "2025-09-23T11:59:30.000000Z"
            }
        ],
        "first_page_url": "/api/whatsapp-sessions/my-session-123/session-logs?page=1",
        "from": 1,
        "last_page": 3,
        "last_page_url": "/api/whatsapp-sessions/my-session-123/session-logs?page=3",
        "next_page_url": "/api/whatsapp-sessions/my-session-123/session-logs?page=2",
        "path": "/api/whatsapp-sessions/my-session-123/session-logs",
        "per_page": 2,
        "prev_page_url": null,
        "to": 2,
        "total": 6
    }
}
```
Error Response:
```json
{
    "success": false,
    "error": "The specified session was not found."
}
```

