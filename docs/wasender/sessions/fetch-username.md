# Fetch Username

> Source: https://www.wasenderapi.com/api-docs/sessions/fetch-username
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/fetch-username
Endpoint: GET /api/fetch-username/{contact_identifier}
Description: Fetches WhatsApp username metadata for a contact.

Details:
Fetch Username

 Fetches WhatsApp username metadata for a contact.

 You can pass a phone number, WhatsApp user JID, LID JID, or username handle. For values containing @, such as 1234567890@s.whatsapp.net, 1234567890@lid, or @jane_doe, URL-encode the @ symbol as %40 when passing it in the path.

Parameters:
- contact_identifier (string, required): Phone number, WhatsApp user JID, LID JID, or username handle. Examples: +1234567890, 1234567890@s.whatsapp.net, 1234567890@lid, or @jane_doe. URL-encode @ as %40 in the path.

Code examples:
```bash
curl "https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net"
  -H "Authorization: Bearer YOUR_API_KEY"
```
```python
import requests

url = "https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net"
headers = {
    "Authorization": "Bearer YOUR_API_KEY"
}

response = requests.get(url, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net", {
    method: "GET",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY"
    }
  });

  const result = await response.json();
  console.log(result);
}

callApi();
```
```php
<?php
require "vendor/autoload.php"; // Assuming Guzzle is installed

use GuzzleHttp\Client;

$client = new Client();
$apiKey = "YOUR_API_KEY";
$url = "https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net";

try {
    $response = $client->get($url, [
        "headers" => [
            "Authorization" => "Bearer " . $apiKey,
            "Accept" => "application/json",
        ]
    ]);

    echo $response->getBody();
} catch (\GuzzleHttp\Exception\RequestException $e) {
    echo "Request failed: " . $e->getMessage();
    if ($e->hasResponse()) {
        echo "
Response: " . $e->getResponse()->getBody();
    }
}
```
```ruby
require "net/http"
require "uri"
require "json"

uri = URI.parse("https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == "https"

request = Net::HTTP::Get.new(uri.request_uri)
request["Authorization"] = "Bearer YOUR_API_KEY"

response = http.request(request)
puts JSON.parse(response.body)
```
```go
package main

import (
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {
    url := "https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net"
    apiKey := "YOUR_API_KEY"

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
        var client = new RestClient("https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net");
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
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .method("GET", HttpRequest.BodyPublishers.noBody());

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net")!
var request = URLRequest(url: url)
request.httpMethod = "GET"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")

let task = URLSession.shared.dataTask(with: request) { data, response, error in
    if let error = error {
        print("Error: (error)")
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
$uri = "https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
}
$response = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers
$response | ConvertTo-Json
```
```typescript
import axios from "axios";

async function callApi() {
  try {
    const config = {
      method: "GET",
      url: "https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net",
      headers: {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    };

    const response = await axios(config);
    console.log(response.data);
  } catch (error) {
    console.error("Error:", error);
  }
}

callApi();
```
```rust
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "https://www.wasenderapi.com/api/fetch-username/1234567890%40s.whatsapp.net";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);

    let client = reqwest::Client::new();
    let response = client.get(url)
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
    "jid": "1234567890@s.whatsapp.net",
    "username": "jane_doe"
  }
}
```

