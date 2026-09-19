# REST Resource: approvals Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals

Retrieved: 2026-09-19T16:30:37.743161+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: Approval](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#Approval)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#Approval.SCHEMA_REPRESENTATION)
* [Status](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#Status)
* [ReviewerResponse](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#ReviewerResponse)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#ReviewerResponse.SCHEMA_REPRESENTATION)
* [Response](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#Response)
* [FileContentChangeBehavior](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#FileContentChangeBehavior)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#METHODS_SUMMARY)

## Resource: Approval

Metadata for an approval. An approval is a review or approve process for a Drive item.

| JSON representation |
| --- |
| ``` {   "kind": string,   "approvalId": string,   "targetFileId": string,   "createTime": string,   "modifyTime": string,   "completeTime": string,   "dueTime": string,   "status": enum (Status),   "initiator": {     object (User)   },   "reviewerResponses": [     {       object (ReviewerResponse)     }   ],   "fileContentChangeBehavior": enum (FileContentChangeBehavior) } ``` |

| Fields | |
| --- | --- |
| `kind` | `string`  This is always drive#approval. |
| `approvalId` | `string`  The approval ID. |
| `targetFileId` | `string`  Target file id of the approval. |
| `createTime` | `string (Timestamp format)`  Output only. The time the approval was created.  Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: `"2014-10-02T15:01:23Z"`, `"2014-10-02T15:01:23.045123456Z"` or `"2014-10-02T15:01:23+05:30"`. |
| `modifyTime` | `string (Timestamp format)`  Output only. The most recent time the approval was modified.  Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: `"2014-10-02T15:01:23Z"`, `"2014-10-02T15:01:23.045123456Z"` or `"2014-10-02T15:01:23+05:30"`. |
| `completeTime` | `string (Timestamp format)`  Output only. The time the approval was completed.  Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: `"2014-10-02T15:01:23Z"`, `"2014-10-02T15:01:23.045123456Z"` or `"2014-10-02T15:01:23+05:30"`. |
| `dueTime` | `string (Timestamp format)`  The time that the approval is due.  Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: `"2014-10-02T15:01:23Z"`, `"2014-10-02T15:01:23.045123456Z"` or `"2014-10-02T15:01:23+05:30"`. |
| `status` | `enum (Status)`  Output only. The status of the approval at the time this resource was requested. |
| `initiator` | `object (User)`  The user that requested the approval. |
| `reviewerResponses[]` | `object (ReviewerResponse)`  The responses made on the approval by reviewers. |
| `fileContentChangeBehavior` | `enum (FileContentChangeBehavior)`  Output only. The behavior of the approval when the file content changes. |

## Status

Possible statuses of an approval.

| Enums | |
| --- | --- |
| `STATUS_UNSPECIFIED` | The approval status has not been set or was set to an invalid value. |
| `IN_PROGRESS` | The approval process has started and not finished. |
| `APPROVED` | The approval process is finished and the target was approved. |
| `CANCELLED` | The approval process was cancelled before it finished. |
| `DECLINED` | The approval process is finished and the target was declined. |

## ReviewerResponse

A response on an approval made by a specific reviewer.

| JSON representation |
| --- |
| ``` {   "kind": string,   "reviewer": {     object (User)   },   "response": enum (Response) } ``` |

| Fields | |
| --- | --- |
| `kind` | `string`  This is always drive#reviewerResponse. |
| `reviewer` | `object (User)`  The user that's responsible for this response. |
| `response` | `enum (Response)`  A reviewer’s response for the approval. |

## Response

Possible responses for an approval.

| Enums | |
| --- | --- |
| `RESPONSE_UNSPECIFIED` | The response was set to an unrecognized value. |
| `NO_RESPONSE` | The reviewer hasn't responded. |
| `APPROVED` | The reviewer has approved the item. |
| `DECLINED` | The reviewer has declined the item. |

## FileContentChangeBehavior

The behavior of the approval when the file content changes while the approval [Status][] is IN\_PROGRESS. This behavior no longer occurs once the approval is complete.

| Enums | |
| --- | --- |
| `FILE_CONTENT_CHANGE_BEHAVIOR_UNSPECIFIED` | The behavior is unspecified. |
| `RESET_APPROVAL` | Any `ReviewerResponse` with a `Response` of APPROVED will be reset to NO\_DECISION when the file content changes while the approval has a [Status][] of IN\_PROGRESS. When the approval has a [Status][] of APPROVED and RESET\_APPROVAL is selected, the file is locked. |
| `NO_APPROVAL_ACTION` | No action is taken when the file content changes. |

| Methods | |
| --- | --- |
| `approve` | Approves an approval. |
| `cancel` | Cancels an approval. |
| `comment` | Comments on an approval. |
| `decline` | Declines an approval. |
| `get` | Gets an approval by ID. |
| `list` | Lists the approvals on a file. |
| `reassign` | Reassigns the reviewers on an approval. |
| `start` | Starts an approval on a file. |
