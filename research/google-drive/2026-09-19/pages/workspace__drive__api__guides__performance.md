# Improve performance Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/performance

Retrieved: 2026-09-19T16:30:23.045958+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document covers some techniques you can use to improve the performance of your application. In some cases, examples from other APIs or generic APIs are used to illustrate the ideas presented. However, the same concepts are applicable to the Google Drive API.

## Compression using gzip

An easy and convenient way to reduce the bandwidth needed for each request is to enable gzip compression. Although this requires additional CPU time to uncompress the results, the trade-off with network costs usually makes it very worthwhile.

In order to receive a gzip-encoded response you must do two things: Set an `Accept-Encoding` header, and modify your user agent to contain the string `gzip`. Here is an example of properly formed HTTP headers for enabling gzip compression:

```
Accept-Encoding: gzip
User-Agent: my program (gzip)
```

## Working with partial resources

Another way to improve the performance of your API calls is by sending and receiving only the portion of the data that you're interested in. This lets your application avoid transferring, parsing, and storing unneeded fields, so it can use resources including network, CPU, and memory more efficiently.

There are two types of partial requests:

* [Partial response](https://developers.google.com/workspace/drive/api/guides/performance#partial-response): A request where you specify which fields to include in the response (use the `fields` request parameter).
* [Patch](https://developers.google.com/workspace/drive/api/guides/performance#patch): An update request where you send only the fields you want to change (use the `PATCH` HTTP verb).

More details on making partial requests are provided in the following sections.

### Partial response

By default, the server sends back the full representation of a resource after processing requests. For better performance, you can ask the server to send only the fields you really need and get a *partial response* instead.

To request a partial response, use the `fields` request parameter to specify the fields you want returned. You can use this parameter with any request that returns response data.

Note that the `fields` parameter only affects the response data; it does not affect the data that you need to send, if any. To reduce the amount of data you send when modifying resources, use a [patch](https://developers.google.com/workspace/drive/api/guides/performance#patch) request.

### Patch (partial update)

You can also avoid sending unnecessary data when modifying resources. To send updated data only for the specific fields that you’re changing, use the HTTP `PATCH` verb. The patch semantics described in this document are different (and simpler) than they were for the older, GData implementation of partial update.

The short example below shows how using patch minimizes the data you need to send to make a small update.

#### Example

#### Handling the response to a patch

After processing a valid patch request, the API returns a `200 OK` HTTP response code along with the complete representation of the modified resource. If ETags are used by the API, the server updates ETag values when it successfully processes a patch request, just as it does with `PUT`.

The patch request returns the entire resource representation unless you use the `fields` parameter to reduce the amount of data it returns.

If a patch request results in a new resource state that is syntactically or semantically invalid, the server returns a `400 Bad Request` or `422 Unprocessable Entity` HTTP status code, and the resource state remains unchanged. For example, if you attempt to delete the value for a required field, the server returns an error.

#### Alternate notation when PATCH HTTP verb is not supported

If your firewall does not allow HTTP `PATCH` requests, then do an HTTP `POST` request and set the override header to `PATCH`, as shown below:

```
POST https://www.googleapis.com/...
X-HTTP-Method-Override: PATCH
...
```

#### Difference between patch and update

In practice, when you send data for an update request that uses the HTTP `PUT` verb, you only need to send those fields which are either required or optional; if you send values for fields that are set by the server, they are ignored. Although this might seem like another way to do a partial update, this approach has some limitations. With updates that use the HTTP `PUT` verb, the request fails if you don't supply required parameters, and it clears previously set data if you don't supply optional parameters.

It's much safer to use patch for this reason. You only supply data for the fields you want to change; fields that you omit are not cleared. The only exception to this rule occurs with repeating elements or arrays: If you omit all of them, they stay just as they are; if you provide any of them, the whole set is replaced with the set that you provide.

## Batch requests

This document shows how to batch API calls together to reduce the number of HTTP connections
your client has to make.

This document is specifically about making a batch request by sending an
HTTP request. If, instead, you're using a Google client library to make a batch request, see the [client library's documentation](https://developers.google.com/api-client-library/).

## Overview

Each HTTP connection your client makes results in a certain amount of overhead. The Google Drive API supports batching, to allow your client to put several API calls into a single HTTP request.

Examples of situations when you might want to use batching:

* Retrieving metadata for a large number of files.
* Updating metadata or properties in bulk.
* Changing permissions for a large number of files, such as adding a new user or group.
* Synchronizing local client data for the first time or after being offline for an extended time.

In each case, instead of sending each call separately, you can group them together into a single HTTP request. All the inner requests must go to the same Google API.

You're limited to 100 calls in a single batch request. If you must make more calls than that, use multiple batch requests.

**Note**: The batch system for the Google Drive API uses the same syntax as the [OData batch processing](http://www.odata.org/documentation/odata-version-3-0/batch-processing/) system, but the semantics differ.

Additional constraints include:

* Batch requests with more than 100 calls might cause an error.
* There's an 8,000 character limit on the length of the URL for each inner request.
* Google Drive doesn't support batch operations for media, either for upload or download, or for exporting files.

## Batch details

A batch request consists of multiple API calls combined into one HTTP request, which can be sent to the `batchPath` specified in the [API discovery document](https://developers.google.com/discovery/v1/reference/apis). The default path is `/batch/api_name/api_version`. This section describes the batch syntax in detail; later, there's an [example](https://developers.google.com/workspace/drive/api/guides/performance#example).

**Note**: A set of n requests batched together counts toward your usage limit as n requests, not as one request. The batch request is separated into a set of requests before processing.

### Format of a batch request

A batch request is a single standard HTTP request containing multiple Google Drive API calls, using the `multipart/mixed` content type. Within that main HTTP request, each of the parts contains a nested HTTP request.

Each part begins with its own `Content-Type: application/http` HTTP header. It can also have an optional `Content-ID` header. However, the part headers are just there to mark the beginning of the part; they're separate from the nested request. After the server unwraps the batch request into separate requests, the part headers are ignored.

The body of each part is a complete HTTP request, with its own verb, URL, headers, and body. The HTTP request must only contain the path portion of the URL; full URLs are not allowed in batch requests.

The HTTP headers for the outer batch request, except for the `Content-` headers such as `Content-Type`, apply to every request in the batch. If you specify a given HTTP header in both the outer request and an individual call, then the individual call header's value overrides the outer batch request header's value. The headers for an individual call apply only to that call.

For example, if you provide an Authorization header for a specific call, then that header applies only to that call. If you provide an Authorization header for the outer request, then that header applies to all of the individual calls unless they override it with Authorization headers of their own.

When the server receives the batched request, it applies the outer request's query parameters and headers (as appropriate) to each part, and then treats each part as if it were a separate HTTP request.

### Response to a batch request

The server's response is a single standard HTTP response with a `multipart/mixed` content type; each part is the response to one of the requests in the batched request, in the same order as the requests.

Like the parts in the request, each response part contains a complete HTTP response, including a status code, headers, and body. And like the parts in the request, each response part is preceded by a `Content-Type` header that marks the beginning of the part.

If a given part of the request had a `Content-ID` header, then the corresponding part of the response has a matching `Content-ID` header, with the original value preceded by the string `response-`, as shown in the following example.

**Note**: The server might perform your calls in any order. Don't count on their being executed in the order in which you specified them. If you want to ensure that two calls occur in a given order, you can't send them in a single request; instead, send the first one by itself, then wait for the response to the first one before sending the second one.

## Example

The following example shows the use of batching with the Google Drive API.

### Example batch request

```
POST https://www.googleapis.com/batch/drive/v3
Accept-Encoding: gzip
User-Agent: Google-HTTP-Java-Client/1.20.0 (gzip)
Content-Type: multipart/mixed; boundary=END_OF_PART
Content-Length: 963

--END_OF_PART
Content-Length: 337
Content-Type: application/http
content-id: 1
content-transfer-encoding: binary



POST https://www.googleapis.com/drive/v3/files/fileId/permissions?fields=id
Authorization: Bearer authorization_token
Content-Length: 70
Content-Type: application/json; charset=UTF-8



{
  "emailAddress":"example@appsrocks.com",
  "role":"writer",
  "type":"user"
}
--END_OF_PART
Content-Length: 353
Content-Type: application/http
content-id: 2
content-transfer-encoding: binary



POST https://www.googleapis.com/drive/v3/files/fileId/permissions?fields=id&sendNotificationEmail=false
Authorization: Bearer authorization_token
Content-Length: 58
Content-Type: application/json; charset=UTF-8



{
   "domain":"appsrocks.com",
   "role":"reader",
   "type":"domain"
}
--END_OF_PART--
```

### Example batch response

This is the response to the example request in the previous section.

```
HTTP/1.1 200 OK
Alt-Svc: quic=":443"; p="1"; ma=604800
Server: GSE
Alternate-Protocol: 443:quic,p=1
X-Frame-Options: SAMEORIGIN
Content-Encoding: gzip
X-XSS-Protection: 1; mode=block
Content-Type: multipart/mixed; boundary=batch_6VIxXCQbJoQ_AATxy_GgFUk
Transfer-Encoding: chunked
X-Content-Type-Options: nosniff
Date: Fri, 13 Nov 2015 19:28:59 GMT
Cache-Control: private, max-age=0
Vary: X-Origin
Vary: Origin
Expires: Fri, 13 Nov 2015 19:28:59 GMT

--batch_6VIxXCQbJoQ_AATxy_GgFUk
Content-Type: application/http
Content-ID: response-1



HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Date: Fri, 13 Nov 2015 19:28:59 GMT
Expires: Fri, 13 Nov 2015 19:28:59 GMT
Cache-Control: private, max-age=0
Content-Length: 35



{
 "id": "12218244892818058021i"
}



--batch_6VIxXCQbJoQ_AATxy_GgFUk
Content-Type: application/http
Content-ID: response-2



HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Date: Fri, 13 Nov 2015 19:28:59 GMT
Expires: Fri, 13 Nov 2015 19:28:59 GMT
Cache-Control: private, max-age=0
Content-Length: 35



{
 "id": "04109509152946699072k"
}



--batch_6VIxXCQbJoQ_AATxy_GgFUk--
```

## Return specific fields from the request

If you don't specify the `fields` parameter, the server returns a default set of
fields specific to the method. For example, the [`files.list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method only returns the `kind`, `id`, `name`, and
`mimeType` fields.

The default fields returned might not be what you need. If you want to specify
which fields to return in the response, use the `fields` [system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions).
For more information, see [Return specific
fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

For all methods of the [`about`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about), [`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) (excluding `delete`), and [`replies`](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies) (excluding `delete`) resources you *must* set the
`fields` parameter. These methods don't return a default set of fields.
