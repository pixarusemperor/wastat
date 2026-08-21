# Regenerate API Key

> Source: https://www.wasenderapi.com/api-docs/sessions/regenerate-api-key
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/regenerate-api-key
Endpoint: POST /api/whatsapp-sessions/{whatsappSession}/regenerate-key
Description: Regenerates the API key for a specific WhatsApp session.

Details:
Regenerate API Key

 Regenerates the API key for a specific WhatsApp session.

 This endpoint requires an access token to be included in the Authorization header.
 You can get the token from here.

Parameters:
- whatsappSession (integer, required): ID of the WhatsApp session.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key"
  -H "Authorization: Bearer YOUR_API_KEY"
  -H "Content-Type: application/json"
```
```python
import requests

url = "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key"
headers = {
    "Authorization": "Bearer YOUR_API_KEY"
}
response = requests.post(url, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key", {
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
$url = 'https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key';

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
require 'json'

uri = URI.parse('https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'

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
    url := "https://www.wasenderapi.com/api/whatsapp-sessionsv
/{whatsappSession}/regenerate-key"
    apiKey := "YOUR_API_KEY"

    req, err := http.NewRequest("POST", url, nil)
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
        var client = new RestClient("https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key");
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
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .method("POST", HttpRequest.BodyPublishers.noBody());

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/whatsapp-sessionsv
/{whatsappSession}/regenerate-key")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")

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
$uri = "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
}
$response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'POST',
      url: 'https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key',
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
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}/regenerate-key";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);

    let client = reqwest::Client::new();
    let response = client.POST(url)
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
    "api_key": "new_whatsapp_api_key_abc456"
}
```

