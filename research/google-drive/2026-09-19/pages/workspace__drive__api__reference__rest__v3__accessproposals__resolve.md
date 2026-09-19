# Method: accessproposals.resolve Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve

Retrieved: 2026-09-19T16:30:36.947500+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve#body.PATH_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve#body.request_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve#body.request_body.SCHEMA_REPRESENTATION)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve#body.aspect)
* [Action](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve#Action)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve#try-it)

Approves or denies an access proposal. For more information, see [Manage pending access proposals](https://developers.google.com/workspace/drive/api/guides/pending-access).

### HTTP request

`POST https://www.googleapis.com/drive/v3/files/{fileId}/accessproposals/{proposalId}:resolve`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  Required. The ID of the item the request is on. |
| `proposalId` | `string`  Required. The ID of the access proposal to resolve. |

### Request body

The request body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "role": [     string   ],   "view": string,   "action": enum (Action),   "sendNotification": boolean } ``` |

| Fields | |
| --- | --- |
| `role[]` | `string`  Optional. The roles that the approver has allowed, if any. For more information, see [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles).  Note: This field is required for the `ACCEPT` action. |
| `view` | `string`  Optional. Indicates the view for this access proposal. This should only be set when the proposal belongs to a view. Only `published` is supported. |
| `action` | `enum (Action)`  Required. The action to take on the access proposal. |
| `sendNotification` | `boolean`  Optional. Whether to send an email to the requester when the access proposal is denied or accepted. |

### Response body

If successful, the response body is an empty JSON object.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/docs`
* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).

## Action

The state change of the access proposal.

| Enums | |
| --- | --- |
| `ACTION_UNSPECIFIED` | Unspecified action |
| `ACCEPT` | The user accepts the access proposal.  Note: If this action is used, the `role` field must have at least one value. |
| `DENY` | The user denies the access proposal. |
