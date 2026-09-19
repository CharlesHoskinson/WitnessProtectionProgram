# Return specific fields Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/fields-parameter

Retrieved: 2026-09-19T16:30:22.261721+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document explains how to use the `fields` parameter in Google Drive.

To return the exact fields you need, and to improve performance, use the
`fields` [system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions) in
your method call.

For information on other system parameters that apply to Drive API,
see [Alternative system parameters](https://developers.google.com/workspace/drive/api/guides/fields-parameter#alternative-system-parameters).

## How the fields parameter works

The `fields` parameter uses a
[FieldMask](https://protobuf.dev/reference/protobuf/google.protobuf/#field-mask)
for response filtering. Field masks are used to specify a subset of fields that
a request should return. Using a field mask is good design practice to make sure
that you don't request unnecessary data, which in turn helps avoid unnecessary
processing time.

If you don't specify the `fields` parameter, the server returns a default set of
fields specific to the method. For example, the
[`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource only returns the `kind`, `id`, `name`, and
`mimeType` fields. The [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/get) method on the
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource returns a different set
of default fields.

For all methods of the [`about`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about), [`approvals`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals), [`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments)
(excluding `delete`), and [`replies`](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies) (excluding
`delete`) resources you *must* set the `fields` parameter. These methods don't
return a default set of fields.

After a server processes a valid request that includes the `fields` parameter,
it returns an `HTTP 200 OK` status code, along with the requested data. If the
fields parameter has an error or is otherwise invalid, the server returns an
`HTTP 400 Bad Request` status code, along with an error message stating what's
wrong with your fields selection. For example,
`files.list(fields='files(id,capabilities,canAddChildren)')` yields an error of
"Invalid field selection canAddChildren." The correct fields parameter for this
example is `files.list(fields='files(id,capabilities/canAddChildren)')`.

To determine the fields you can return using the `fields` parameter, visit the
documentation page of the resource you're querying. For example, to see what
fields you can return for a file, refer to the `files` resource documentation.
For more file-specific query terms, see [Search query terms and operators](https://developers.google.com/workspace/drive/api/guides/ref-search-terms).

**Important:** Use query parameters that support data pagination (such as
`maxResults` and `nextPageToken`) to reduce the results of each query to a
manageable size. Otherwise, the performance gains possible with a [partial
response](https://developers.google.com/workspace/drive/api/guides/performance#partial) might not be realized.

## Field parameter format rules

The format of the fields request parameter value is loosely based on XPath
syntax. The following are formatting rules for the `fields` parameter. All these
rules use examples related to the `files.get` method.

* Use a comma-separated list to select multiple fields, such as `'name,
  mimeType'`.
* Use `a/b` to select field `b` that's nested within field `a`, such as
  `'capabilities/canDownload'`. For more information, see [Fetch the fields of
  a nested resource](https://developers.google.com/workspace/drive/api/guides/fields-parameter#nested).
* Use a sub-selector to request a set of specific sub-fields of arrays or
  objects by placing expressions in parentheses "()". For example,
  `'permissions(id)'` returns only the permission ID for each element in the
  permissions array.
* To return all fields in an object, use an asterisk (`*`) as a wildcard in
  field selections. For example, `'permissions/permissionDetails/*'` selects
  all available permission details fields per permission. Note that using the
  wildcard can lead to negative performance impacts on the request.
* You cannot select individual elements of a map when their keys contain
  special characters (such as forward slashes `/` or periods `.`). For
  example, attempting to select a specific export format key in `exportLinks`
  using `fields=exportLinks/application/pdf` yields an `HTTP 400 Bad Request`
  error because the path parser interprets the `/` as a nested property
  delimiter. To retrieve key-value pairs with special characters in their
  keys, request the entire map (such as `fields=exportLinks`) and filter the
  results client-side.

**Request**

In this example, we provide the file ID path parameter and multiple fields as a query parameter in the request. The response returns the field values for the file ID.

```
GET https://www.googleapis.com/drive/v3/files/FILE_ID?fields=name,starred,shared
```

**Response**

```
{
  "name": "File1",
  "starred": false,
  "shared": true
  }
}
```

## Fetch the fields of a nested resource

When a field refers to another resource, you can specify which fields of the
nested resource should be fetched.

For example, to retrieve the `role` field (nested resource) of the `permissions`
resource, use any of the following options:

* `permissions.get` with `fields=role`.
* `permissions.get` with `fields=*` to show all `permissions` fields.
* `files.get` with `fields=permissions(role)` or `fields=permissions/role`.
* `files.get` with `fields=permissions` to show all `permissions` fields.
* `changes.list` with `fields=changes(file(permissions(role)))`.

To retrieve multiple fields, use a comma-separated list. For example,
`files.list` with `fields=files(id,name,createdTime,modifiedTime,size)`.

To specify nested fields within nested arrays or objects, use nested
parentheses. For example, to list files with their ID, name, and nested owner
details (display name and email address) while also retrieving the next page
token for pagination:
`files.list` with `fields=nextPageToken,files(id,name,owners(displayName,emailAddress))`.

**Request**

In this example, we provide the file ID path parameter and multiple fields, including certain fields of the nested permissions resource, as a query parameter in the request. The response returns the field values for the file ID.

```
GET https://www.googleapis.com/drive/v3/files/FILE_ID?fields=name,starred,shared,permissions(kind,type,role)
```

**Response**

```
{
  "name": "File1",
  "starred": false,
  "shared": true,
  "permissions": [
    {
      "kind": "drive#permission",
      "type": "user",
      "role": "owner"
    }
  ]
}
```

## Alternative system parameters

Query parameters that apply to all Google Drive API operations are documented at
[System Parameters](https://cloud.google.com/apis/docs/system-parameters).

**Note:** Per-user quotas are always enforced by the Drive API, and the
user's identity is determined from the access token passed in the request. The
`quotaUser` and `userIp` parameters can only be used for anonymous requests
against public files.

## Related topics

* [Resolve errors](https://developers.google.com/workspace/drive/api/guides/handle-errors)
* [Troubleshoot authentication and authorization issues](https://developers.google.com/workspace/drive/api/troubleshoot-authentication-authorization)
* [Improve performance](https://developers.google.com/workspace/drive/api/guides/performance)
