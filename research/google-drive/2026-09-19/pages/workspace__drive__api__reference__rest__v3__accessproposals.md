# REST Resource: accessproposals Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals

Retrieved: 2026-09-19T16:30:34.315920+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: AccessProposal](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals#AccessProposal)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals#AccessProposal.SCHEMA_REPRESENTATION)
* [RoleAndView](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals#RoleAndView)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals#RoleAndView.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals#METHODS_SUMMARY)

## Resource: AccessProposal

Manage outstanding access proposals on a file.

| JSON representation |
| --- |
| ``` {   "fileId": string,   "proposalId": string,   "requesterEmailAddress": string,   "recipientEmailAddress": string,   "rolesAndViews": [     {       object (RoleAndView)     }   ],   "requestMessage": string,   "createTime": string } ``` |

| Fields | |
| --- | --- |
| `fileId` | `string`  The file ID that the proposal for access is on. |
| `proposalId` | `string`  The ID of the access proposal. |
| `requesterEmailAddress` | `string`  The email address of the requesting user. |
| `recipientEmailAddress` | `string`  The email address of the user that will receive permissions, if accepted. |
| `rolesAndViews[]` | `object (RoleAndView)`  A wrapper for the role and view of an access proposal. For more information, see [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles). |
| `requestMessage` | `string`  The message that the requester added to the proposal. |
| `createTime` | `string (Timestamp format)`  The creation time.  Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: `"2014-10-02T15:01:23Z"`, `"2014-10-02T15:01:23.045123456Z"` or `"2014-10-02T15:01:23+05:30"`. |

## RoleAndView

A wrapper for the role and view of an access proposal. For more information, see [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles).

| JSON representation |
| --- |
| ``` {   "role": string,   "view": string } ``` |

| Fields | |
| --- | --- |
| `role` | `string`  The role that was proposed by the requester. The supported values are:   * `writer` * `commenter` * `reader` |
| `view` | `string`  Indicates the view for this access proposal. Only populated for proposals that belong to a view. Only `published` is supported. |

| Methods | |
| --- | --- |
| `get` | Retrieves an access proposal by ID. |
| `list` | List the access proposals on a file. |
| `resolve` | Approves or denies an access proposal. |
