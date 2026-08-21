# Get Group Invite Info

> Source: https://www.wasenderapi.com/api-docs/groups/get-group-invite-info
> Category: Groups
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/groups/get-group-invite-info
Endpoint: GET /api/groups/invite/{inviteCode}
Description: Retrieves metadata for a group from its invite code.

Details:
Get Group Invite Info

 This endpoint allows you to fetch public information and metadata about a WhatsApp group by using its invitation code, without actually joining the group. It's useful for previewing a group's subject, description, and size.

Parameters:
- inviteCode (string, required): The unique invitation code from the group invite link. For example, in the link https://chat.whatsapp.com/ABCDE12345, the code is ABCDE12345.

Code examples:
```bash
curl -X GET "https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE"
  -H "Authorization: Bearer YOUR_API_KEY"
```
```python
import requests

url = "https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE"
headers = {"Authorization": "Bearer YOUR_API_KEY"}
response = requests.get(url, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE", {
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
require 'vendor/autoload.php';

use GuzzleHttp\Client;

$client = new Client();
$apiKey = 'YOUR_API_KEY';
$inviteCode = 'SAMPLE_INVITE_CODE';
$url = 'https://www.wasenderapi.com/api/groups/invite/' . $inviteCode;

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

uri = URI.parse('https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE')
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
    url := "https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE"
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
        var client = new RestClient("https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE");
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
            .uri(URI.create("https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE"))
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

let url = URL(string: "https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE")!
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
$uri = "https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE"
$headers = @{"Authorization" = "Bearer YOUR_API_KEY"}

$response = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'get',
      url: 'https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE',
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
    let url = "https://www.wasenderapi.com/api/groups/invite/SAMPLE_INVITE_CODE";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}"), api_key))?);

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
        "id": "123456789-987654321@g.us",
        "subject": "Official Project Group",
        "owner": "1234567890@s.whatsapp.net",
        "creation": 1672531200,
        "size": 42,
        "desc": "This is the official group for project updates.",
        "participants": [
            { "id": "111111111@s.whatsapp.net", "admin": "superadmin" },
            { "id": "222222222@s.whatsapp.net", "admin": "admin" }
        ]
    }
}
```
Error Response:
```json
{
    "success": false,
    "error": "Failed to get group invite info: Invalid or expired invite code."
}
```

