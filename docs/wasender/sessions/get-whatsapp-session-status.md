# Get WhatsApp Session Status

> Source: https://www.wasenderapi.com/api-docs/sessions/get-whatsapp-session-status
> Category: Sessions
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/sessions/get-whatsapp-session-status
Endpoint: GET /api/status
Description: Returns the current status of the WhatsApp session, including QR and Passkey linking states.

Details:
Get WhatsApp Session Status

 This endpoint returns the current status of a specific WhatsApp session. The session must be previously initialized.

 Session Statuses Explained

 The following statuses may be returned by this endpoint:

 Status
 Meaning
 Recommended action

 connecting
 The session is attempting to establish a connection with WhatsApp servers.
 Wait and check the status again.

 connected
 The session is authenticated and actively connected to WhatsApp.
 You can send and receive messages.

 disconnected
 The session is not currently connected.
 Start the connect flow again using QR or Passkey.

 need_scan
 The session is waiting for the user to scan a WhatsApp QR code.
 Show the QR code to the user or call the QR code endpoint to refresh it.

 need_passkey
 The session is waiting for the user to approve a WhatsApp Passkey linking request.
 Fetch the Passkey token and ask the user to complete approval with Device Link Helper.

 logged_out
 The user logged out of the WhatsApp session manually or from another device.
 Ask the user to reconnect the session using QR or Passkey.

 expired
 The session is no longer valid, often due to inactivity or remote invalidation.
 Reconnect the session.

 Passkey note: When the status is need_passkey, call the Passkey token endpoint and show the temporary token to the user. The user can paste it into the Device Link Helper Chrome extension to finish linking.

 Passkey fallback: If Passkey linking cannot continue, the status may return to need_scan. In that case, show the normal QR linking flow.

Code examples:
```bash
curl "https://www.wasenderapi.com/api/status"
  -H "Authorization: Bearer YOUR_API_KEY"
```
```python
import requests

url = "https://www.wasenderapi.com/api/status"
headers = {
    "Authorization": "Bearer YOUR_API_KEY"
}
response = requests.get(url, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/status", {
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
$url = 'https://www.wasenderapi.com/api/status';

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

uri = URI.parse('https://www.wasenderapi.com/api/status')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Get.new(uri.request_uri)
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
    url := "https://www.wasenderapi.com/api/status"
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
        var client = new RestClient("https://www.wasenderapi.com/api/status");
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
            .uri(URI.create("https://www.wasenderapi.com/api/status"))
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

let url = URL(string: "https://www.wasenderapi.com/api/status")!
var request = URLRequest(url: url)
request.httpMethod = "GET"
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
$uri = "https://www.wasenderapi.com/api/status"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
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
      url: 'https://www.wasenderapi.com/api/status',
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
    let url = "https://www.wasenderapi.com/api/status";
    let api_key = "YOUR_API_KEY";

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
Session Connected Response:
```json
{
  "status": "connected"
}
```
Session Needs Passkey Response:
```json
{
  "status": "need_passkey"
}
```
Session Needs Scan Response:
```json
{
  "status": "need_scan"
}
```
Session Logged Out Response:
```json
{
  "status": "logged_out"
}
```
Session Expired Response:
```json
{
  "status": "expired"
}
```
Session Disconnected Response:
```json
{
  "status": "disconnected"
}
```

