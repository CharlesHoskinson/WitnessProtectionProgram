# REST Resource: replies Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/replies

Retrieved: 2026-09-19T16:31:29.769324+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: Reply](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies#Reply)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies#Reply.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies#METHODS_SUMMARY)

## Resource: Reply

A reply to a comment on a file.

Some resource methods (such as `replies.update`) require a `replyId`. Use the `replies.list` method to retrieve the ID for a reply.

| JSON representation |
| --- |
| ``` {   "mentionedEmailAddresses": [     string   ],   "id": string,   "kind": string,   "createdTime": string,   "modifiedTime": string,   "action": string,   "author": {     object (User)   },   "deleted": boolean,   "htmlContent": string,   "content": string,   "assigneeEmailAddress": string } ``` |

| Fields | |
| --- | --- |
| `mentionedEmailAddresses[]` | `string`  Output only. A list of email addresses for users mentioned in this comment. If no users are mentioned, the list is empty. |
| `id` | `string`  Output only. The ID of the reply. |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string `"drive#reply"`. |
| `createdTime` | `string`  Output only. The time at which the reply was created ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)). |
| `modifiedTime` | `string`  Output only. The last time the reply was modified ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)). |
| `action` | `string`  The action the reply performed to the parent comment. The supported values are:   * `resolve` * `reopen` |
| `author` | `object (User)`  Output only. The author of the reply. The author's email address and permission ID won't be populated. |
| `deleted` | `boolean`  Output only. Whether the reply has been deleted. A deleted reply has no content. |
| `htmlContent` | `string`  Output only. The content of the reply with HTML formatting. |
| `content` | `string`  The plain text content of the reply. This field is used for setting the content, while `htmlContent` should be displayed. This field is required by the `create` method if no `action` value is specified. |
| `assigneeEmailAddress` | `string`  Output only. The email address of the user assigned to this comment. If no user is assigned, the field is unset. |

| Methods | |
| --- | --- |
| `create` | Creates a reply to a comment. |
| `delete` | Deletes a reply. |
| `get` | Gets a reply by ID. |
| `list` | Lists a comment's replies. |
| `update` | Updates a reply with patch semantics. |
