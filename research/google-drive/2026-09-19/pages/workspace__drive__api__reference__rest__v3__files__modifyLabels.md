# Method: files.modifyLabels Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels

Retrieved: 2026-09-19T16:31:19.123786+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#body.PATH_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#body.ModifyLabelsResponse.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#body.aspect)
* [ModifyLabelsRequest](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#ModifyLabelsRequest)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#ModifyLabelsRequest.SCHEMA_REPRESENTATION)
* [LabelModification](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#LabelModification)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#LabelModification.SCHEMA_REPRESENTATION)
* [FieldModification](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#FieldModification)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#FieldModification.SCHEMA_REPRESENTATION)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/modifyLabels#try-it)

Modifies the set of labels applied to a file. For more information, see [Set a label field on a file](https://developers.google.com/workspace/drive/api/guides/set-label).

Returns a list of the labels that were added or modified.

### HTTP request

`POST https://www.googleapis.com/drive/v3/files/{fileId}/modifyLabels`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file to which the labels belong. |

### Request body

The request body contains an instance of `ModifyLabelsRequest`.

### Response body

Response to a `files.modifyLabels` request. This contains only those labels which were added or updated by the request.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "modifiedLabels": [     {       object (Label)     }   ],   "kind": string } ``` |

| Fields | |
| --- | --- |
| `modifiedLabels[]` | `object (Label)`  The list of labels which were added or updated by the request. |
| `kind` | `string`  This is always `"drive#modifyLabelsResponse"`. |

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.metadata`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).

## ModifyLabelsRequest

A request to modify the set of labels on a file. This request may contain many modifications that will either all succeed or all fail atomically.

| JSON representation |
| --- |
| ``` {   "labelModifications": [     {       object (LabelModification)     }   ],   "kind": string } ``` |

| Fields | |
| --- | --- |
| `labelModifications[]` | `object (LabelModification)`  The list of modifications to apply to the labels on the file. |
| `kind` | `string`  This is always `"drive#modifyLabelsRequest"`. |

## LabelModification

A modification to a label on a file. A `LabelModification` can be used to apply a label to a file, update an existing label on a file, or remove a label from a file.

| JSON representation |
| --- |
| ``` {   "fieldModifications": [     {       object (FieldModification)     }   ],   "labelId": string,   "removeLabel": boolean,   "kind": string } ``` |

| Fields | |
| --- | --- |
| `fieldModifications[]` | `object (FieldModification)`  The list of modifications to this label's fields. |
| `labelId` | `string`  The ID of the label to modify. |
| `removeLabel` | `boolean`  If true, the label will be removed from the file. |
| `kind` | `string`  This is always `"drive#labelModification"`. |

## FieldModification

A modification to a label's field.

| JSON representation |
| --- |
| ``` {   "setDateValues": [     string   ],   "setTextValues": [     string   ],   "setSelectionValues": [     string   ],   "setIntegerValues": [     string   ],   "setUserValues": [     string   ],   "fieldId": string,   "kind": string,   "unsetValues": boolean } ``` |

| Fields | |
| --- | --- |
| `setDateValues[]` | `string`  Replaces the value of a `date` field with these new values. The string must be in the RFC 3339 full-date format: YYYY-MM-DD. |
| `setTextValues[]` | `string`  Sets the value of a `text` field. |
| `setSelectionValues[]` | `string`  Replaces a `selection` field with these new values. |
| `setIntegerValues[]` | `string (int64 format)`  Replaces the value of an `integer` field with these new values. |
| `setUserValues[]` | `string`  Replaces a `user` field with these new values. The values must be a valid email addresses. |
| `fieldId` | `string`  The ID of the field to be modified. |
| `kind` | `string`  This is always `"drive#labelFieldModification"`. |
| `unsetValues` | `boolean`  Unsets the values for this field. |
