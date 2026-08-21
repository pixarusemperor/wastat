# Get LID from Phone Number

> Source: https://www.wasenderapi.com/api-docs/contacts/get-lid-from-phone-number
> Category: Contacts
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/contacts/get-lid-from-phone-number
Endpoint: GET /api/lid-from-pn/{pn}
Description: Retrieves the Link ID (LID) associated with a real phone number (PN).

Details:
Get LID from Phone Number

 This endpoint performs the reverse operation of the previous one. Given a user's full phone number JID (ending in @s.whatsapp.net), it retrieves their corresponding Link ID (LID).

Parameters:
- pn (string, required): The phone number JID of the user, which must end with @s.whatsapp.net.

Code examples:
```bash
curl -X GET "https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net" 
  -H "Authorization: Bearer YOUR_API_KEY"
```
```python
import requests

url = "https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net"
headers = {"Authorization": "Bearer YOUR_API_KEY"}

response = requests.get(url, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net", {
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
$pn = '1234567890@s.whatsapp.net';
$url = 'https://www.wasenderapi.com/api/lid-from-pn/' . $pn;

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

uri = URI.parse('https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net')
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
    url := "https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net"
    apiKey := "YOUR_API_KEY"

    req, err := http.NewRequest("GET", url, nil)
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
        var client = new RestClient("https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net");
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
            .uri(URI.create("https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net"))
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

let url = URL(string: "https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net")!
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
$uri = "https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net"
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
      url: 'https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net',
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
    let url = "https://www.wasenderapi.com/api/lid-from-pn/1234567890@s.whatsapp.net";
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
        "lid": "1234567890@lid"
    }
}
```
Error Response:
```json
{
    "success": false,
    "error": "Phone number not found or invalid."
}
```

