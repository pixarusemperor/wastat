# Get Message Logs

> Source: https://www.wasenderapi.com/api-docs/sessions/get-message-logs
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/get-message-logs
Endpoint: GET /api/whatsapp-sessions/{whatsappSession}/message-logs
Description: Retrieves a paginated list of message logs for a specific session.

Details:
Get Message Logs

 This endpoint fetches a paginated history of messages sent using our API by the specified WhatsApp session. It is useful for auditing, analytics, or displaying message history in an application.

 Important: Message logging must be enabled for each session individually in your settings. If logging is disabled, the content and the to field will benull.

 The response is structured as a standard paginated object, which you can navigate using the optional page and per_page query parameters.

Parameters:
- whatsappSession (string, required): The unique identifier of the WhatsApp session.
- page (integer, optional): The page number to retrieve. Defaults to 1.
- per_page (integer, optional): The number of items to retrieve per page. Defaults to 10.

Code examples:
```bash
curl -X GET "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs?page=1&per_page=20" 
  -H "Authorization: Bearer YOUR_API_KEY"
```
```python
import requests

url = "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs"
headers = {"Authorization": "Bearer YOUR_API_KEY"}
params = {
    "page": 1,
    "per_page": 20
}

response = requests.get(url, headers=headers, params=params)
print(response.json())
```
```javascript
async function callApi() {
  const url = new URL("https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs");
  url.searchParams.append('page', '1');
  url.searchParams.append('per_page', '20');

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
$url = 'https://www.wasenderapi.com/api/' . $sessionId . '/message-logs';

try {
    $response = $client->get($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Accept' => 'application/json',
        ],
        'query' => [
            'page' => 1,
            'per_page' => 20
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

uri = URI.parse('https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs')
uri.query = URI.encode_www_form({ page: 1, per_page: 20 })

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
    baseUrl := "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs"
    apiKey := "YOUR_API_KEY"

    req, err := http.NewRequest("GET", baseUrl, nil)
    if err != nil {
        panic(err)
    }

    q := req.URL.Query()
    q.Add("page", "1")
    q.Add("per_page", "20")
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
        var client = new RestClient("https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs?page=1&per_page=20");
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
            .uri(URI.create("https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs?page=1&per_page=20"))
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

var components = URLComponents(string: "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs")!
components.queryItems = [
    URLQueryItem(name: "page", value: "1"),
    URLQueryItem(name: "per_page", value: "20")
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
$uri = "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs"
$params = @{ page = 1; per_page = 20 }
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
      url: 'https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY'
      },
      params: {
        page: 1,
        per_page: 20
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
    let url = "https://www.wasenderapi.com/api/whatsapp-sessions/my-session-123/message-logs";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}"), api_key))?);

    let client = reqwest::Client::new();
    let response = client.get(url)
        .headers(headers)
        .query(&[("page", 1), ("per_page", 20)])
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
                "id": "1001",
                "whatsapp_session_id": "501",
                "to": "+155501001234",
                "content": "{\"text\":\"This is a sample message. Lorem ipsum dolor sit amet, consectetur adipiscing elit.\"}",
                "status": "sent",
                "failed_reason": null,
                "created_at": "2023-10-27 10:30:15",
                "updated_at": "2023-10-27 10:30:17"
            },
            {
                "id": "1002",
                "whatsapp_session_id": "502",
                "to": "+4455501005678",
                "content": "{\"text\":\"Hello! This is an example message sent to a user. How can we help you today?\"}",
                "status": "in_progress",
                "failed_reason": null,
                "created_at": "2023-10-27 10:32:45",
                "updated_at": "2023-10-27 10:32:48"
            },
            {
                "id": "1003",
                "whatsapp_session_id": "503",
                "to": "+5255501009876",
                "content": "{\"text\":\"Just a test message to verify the connection.\"}",
                "status": "failed",
                "failed_reason": "invalid WhatsApp number",
                "created_at": "2023-10-27 10:35:01",
                "updated_at": "2023-10-27 10:35:03"
            }
        ],
        "first_page_url": "/api/session-id-123/message-logs?page=1",
        "from": 1,
        "last_page": 5,
        "last_page_url": "/api/session-id-123/message-logs?page=5",
        "next_page_url": "/api/session-id-123/message-logs?page=2",
        "path": "/api/session-id-123/message-logs",
        "per_page": 3,
        "prev_page_url": null,
        "to": 3,
        "total": 15
    }
}
```

