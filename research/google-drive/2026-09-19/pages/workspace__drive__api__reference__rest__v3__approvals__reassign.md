# Method: approvals.reassign Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign

Retrieved: 2026-09-19T16:30:43.604968+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#body.PATH_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#body.request_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#body.request_body.SCHEMA_REPRESENTATION)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#body.aspect)
* [AddReviewer](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#AddReviewer)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#AddReviewer.SCHEMA_REPRESENTATION)
* [ReplaceReviewer](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#ReplaceReviewer)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#ReplaceReviewer.SCHEMA_REPRESENTATION)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign#try-it)

Reassigns the reviewers on an approval. For more information, see [Manage approvals](https://developers.google.com/workspace/drive/api/guides/approvals).

Adds or replaces reviewers in the `ReviewerResponse` of the approval.

This can be called by any user with the `writer` permission on the file while the approval `Status` is `IN_PROGRESS` and the `Response` for the reviewer being reassigned is `NO_RESPONSE`. A user with the `reader` permission can only reassign an approval that's assigned to themselves.

Removing a reviewer isn't allowed.

### HTTP request

`POST https://www.googleapis.com/drive/v3/files/{fileId}/approvals/{approvalId}:reassign`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  Required. The ID of the file that the approval is on. |
| `approvalId` | `string`  Required. The ID of the approval to reassign. |

### Request body

The request body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "addReviewers": [     {       object (AddReviewer)     }   ],   "replaceReviewers": [     {       object (ReplaceReviewer)     }   ],   "message": string } ``` |

| Fields | |
| --- | --- |
| `addReviewers[]` | `object (AddReviewer)`  Optional. The list of reviewers to add. |
| `replaceReviewers[]` | `object (ReplaceReviewer)`  Optional. The list of reviewer replacements. |
| `message` | `string`  Optional. A message to send to the new reviewers. This message is included in notifications for the action and in the approval activity log. |

### Response body

If successful, the response body contains an instance of `Approval`.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.metadata`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).

## AddReviewer

Representation of a reviewer addition.

| JSON representation |
| --- |
| ``` {   "addedReviewerEmail": string } ``` |

| Fields | |
| --- | --- |
| `addedReviewerEmail` | `string`  Required. The email of the reviewer to add. |

## ReplaceReviewer

Representation of a reviewer replacement.

| JSON representation |
| --- |
| ``` {   "addedReviewerEmail": string,   "removedReviewerEmail": string } ``` |

| Fields | |
| --- | --- |
| `addedReviewerEmail` | `string`  Required. The email of the reviewer to add. |
| `removedReviewerEmail` | `string`  Required. The email of the reviewer to remove. |
