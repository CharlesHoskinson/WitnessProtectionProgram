# Install the Google Drive client libraries Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/downloads

Retrieved: 2026-09-19T16:31:41.929801+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The Google Drive API is built on HTTP and JSON, so any standard HTTP client can
send requests to it and parse the responses.

However, the Google API client libraries provide better language integration,
improved security, and facilitate making calls that require user authorization.
The client libraries use each supported language's natural conventions and
reduce boilerplate code that you have to write. The client libraries are
available in several programming languages. By using them you can avoid the need
to manually set up HTTP requests and parse the responses.

Read more about the Cloud Client Libraries and the older Google API Client
Libraries in [Client libraries and Cloud APIs
explained](https://docs.cloud.google.com/apis/docs/client-libraries-explained).

## Client libraries

Drive provides client libraries for the following languages.
Select the programming language that you want to use.

### Dart

Get the latest [Google Drive API client library for
Dart](https://github.com/google/googleapis.dart/tree/master/generated/googleapis).

Run the following command to install this client library in your environment
for Dart:

```
dart pub add googleapis
```

Run the following command to install this client library in your environment
for Flutter:

```
flutter pub add googleapis
```

### Code samples

To view or get individual code samples, see the
[`googleapis.dart`](https://github.com/google/googleapis.dart/tree/master/generated/googleapis/example)
GitHub repository.

### Client library documentation

For more information, view the [client library
documentation](https://pub.dartlang.org/packages/googleapis).

### Go

Get the latest [Google Drive API client library for
Go](https://github.com/googleapis/google-api-go-client).

Run the following command to install an API and a version of that API in
your environment:

```
go get google.golang.org/api/urlshortener/v1
```

### Code samples

To view or get individual code samples, see the
[`google-api-go-client`](https://github.com/googleapis/google-api-go-client/tree/main/examples)
GitHub repository.

### Client library documentation

For more information, view the [client library
documentation](https://pkg.go.dev/google.golang.org/api/drive/v3).

### Java

Get the latest [Google Drive API client library for
Java](https://github.com/googleapis/google-api-java-client-services/tree/main/clients/google-api-services-drive/v3).

To use Maven, add the following lines to your `pom.xml` file:

```
<project>
  <dependencies>
    <dependency>
      <groupId>com.google.apis</groupId>
      <artifactId>google-api-services-drive</artifactId>
      <version>v3-rev20240509-2.0.0</version>
    </dependency>
  </dependencies>
</project>
```

To use Gradle, add the following lines to your `build.gradle` file:

```
repositories {
  mavenCentral()
}
dependencies {
  implementation 'com.google.apis:google-api-services-drive:v3-rev20240509-2.0.0'
}
```

### Code samples

To view or get individual code samples, see the
[`google-api-java-client-services`](https://github.com/googleapis/google-api-java-client-services/tree/main/clients/google-api-services-drive/v3)
GitHub repository.

### Client library documentation

For more information, view the [client library
documentation](https://googleapis.dev/java/google-api-services-drive/latest/).

### JavaScript

Get the latest [Google Drive API client library for
JavaScript](https://github.com/google/google-api-javascript-client).

Use `gapi.client.request` to make requests to the JavaScript client library.

### Code samples

To view or get individual code samples, see the
[`google-api-javascript-client`](https://github.com/google/google-api-javascript-client/tree/master/samples)
GitHub repository.

### .NET

Get the latest [Google Drive API client library for
.NET](https://github.com/googleapis/google-api-dotnet-client).

Run the following command to install this package in your environment:

```
dotnet add package Google.Apis --version 1.68.0
```

For alternative methods of installation, see the
[`Google.Apis`](https://www.nuget.org/packages/Google.Apis) NuGet page.

### Code samples

To view or get individual code samples, see the [Get
started](https://developers.google.com/api-client-library/dotnet/get_started)
page.

### Client library documentation

For more information, view the [client library
documentation](https://googleapis.dev/dotnet/Google.Apis.Drive.v3/latest/api/Google.Apis.Drive.v3.html).

### Node.js

Get the latest [Google Drive API client library for
Node.js](https://github.com/googleapis/google-api-nodejs-client).

Run the following command to install this client library in your
environment:

```
npm install @googleapis/drive
```

### Code samples

To view or get individual code samples, see the
[`google-api-nodejs-client`](https://github.com/googleapis/google-api-nodejs-client/tree/main/samples)
GitHub repository.

### Client library documentation

For more information, view the [client library
documentation](https://googleapis.dev/nodejs/googleapis/latest/drive/classes/Drive.html).

### Obj-C

Get the latest [Google Drive API client library for Objective-C for
REST](https://github.com/google/google-api-objectivec-client-for-rest).

If you're building from CocoaPods, add the required pod to the `Podfile` in
your environment:

```
pod 'GoogleAPIClientForREST/Drive'
```

### Code samples

To view or get individual code samples, see the
[`google-api-objectivec-client-for-rest`](https://github.com/google/google-api-objectivec-client-for-rest/tree/main/Examples)
GitHub repository.

### Client library documentation

For more information, view the [client library
documentation](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/Introduction/Introduction.html#//apple_ref/doc/uid/TP40011210).

### PHP

Get the latest [Google Drive API client library for
PHP](https://github.com/googleapis/google-api-php-client).

To use Composer, run the following command to install this client library in
your environment:

```
composer require google/apiclient:^2.15.0
```

To download and install the release instead, extract the download file
and include the autoloader in your project:

```
require_once '/path/to/google-api-php-client/vendor/autoload.php';
```

### Code samples

To view or get individual code samples, see the
[`google-api-php-client`](https://github.com/googleapis/google-api-php-client/tree/main/examples)
GitHub repository.

### Client library documentation

For more information, view the [client library
documentation](https://developers.google.com/resources/api-libraries/documentation/drive/v3/php/latest/).

### Python

Get the latest [Google Drive API client library for
Python](https://github.com/googleapis/google-api-python-client).

Install this client library in a
[virtualenv](https://virtualenv.pypa.io/en/latest/) in your environment
using `pip`.

To install on Mac or Linux:

```
pip3 install virtualenv
virtualenv <your-env>
source <your-env>/bin/activate
<your-env>/bin/pip install google-api-python-client
```

To install on Windows:

```
pip install virtualenv
virtualenv <your-env>
<your-env>\Scripts\activate
<your-env>\Scripts\pip.exe install google-api-python-client
```

### Code samples

To view or get individual code samples, see the
[`google-api-python-client`](https://github.com/googleapis/google-api-python-client/tree/main/samples)
GitHub repository.

### Client library documentation

For more information, view the [client library
documentation](https://googleapis.github.io/google-api-python-client/docs/dyn/drive_v3.html).

### Ruby

Get the latest [Google Drive API client library for
Ruby](https://github.com/googleapis/google-api-ruby-client).

To use `gem install`, run the following command to install this client
library in your environment:

```
gem install google-apis-drive_v3 -v 0.5.0
```

To require the file instead, add it to your `Gemfile`, add the require
statement in your project, and instantiate the service:

```
require 'google/apis/drive_v3'
drive = Google::Apis::DriveV3::DriveService.new
```

### Code samples

To view or get individual code samples, see the
[`google-api-ruby-client`](https://github.com/googleapis/google-api-ruby-client/tree/main/samples)
GitHub repository.

### Client library documentation

For more information, view the [client library
documentation](https://googleapis.dev/ruby/google-api-client/latest/Google/Apis/DriveV3.html).
