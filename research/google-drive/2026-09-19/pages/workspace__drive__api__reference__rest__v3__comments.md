# REST Resource: comments Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/comments

Retrieved: 2026-09-19T16:30:54.993156+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: Comment](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments#Comment)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments#Comment.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments#METHODS_SUMMARY)

## Resource: Comment

A comment on a file.

Some resource methods (such as `comments.update`) require a `commentId`. Use the `comments.list` method to retrieve the ID for a comment in a file.

| JSON representation |
| --- |
| ``` {   "replies": [     {       object (Reply)     }   ],   "mentionedEmailAddresses": [     string   ],   "id": string,   "kind": string,   "createdTime": string,   "modifiedTime": string,   "resolved": boolean,   "anchor": string,   "author": {     object (User)   },   "deleted": boolean,   "htmlContent": string,   "content": string,   "quotedFileContent": {     "mimeType": string,     "value": string   },   "assigneeEmailAddress": string } ``` |

| Fields | |
| --- | --- |
| `replies[]` | `object (Reply)`  Output only. The full list of replies to the comment in chronological order. |
| `mentionedEmailAddresses[]` | `string`  Output only. A list of email addresses for users mentioned in this comment. If no users are mentioned, the list is empty. |
| `id` | `string`  Output only. The ID of the comment. |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string `"drive#comment"`. |
| `createdTime` | `string`  Output only. The time at which the comment was created (RFC 3339 date-time). |
| `modifiedTime` | `string`  Output only. The last time the comment or any of its replies was modified (RFC 3339 date-time). |
| `resolved` | `boolean`  Output only. Whether the comment has been resolved by one of its replies. |
| `anchor` | `string`  A region of the document represented as a JSON string. For details on defining anchor properties, refer to [Manage comments and replies](https://developers.google.com/workspace/drive/api/v3/manage-comments). |
| `author` | `object (User)`  Output only. The author of the comment. The author's email address and permission ID will not be populated. |
| `deleted` | `boolean`  Output only. Whether the comment has been deleted. A deleted comment has no content. |
| `htmlContent` | `string`  Output only. The content of the comment with HTML formatting. |
| `content` | `string`  The plain text content of the comment. This field is used for setting the content, while `htmlContent` should be displayed. |
| `quotedFileContent` | `object`  The file content to which the comment refers, typically within the anchor region. For a text file, for example, this would be the text at the location of the comment. |
| `quotedFileContent.mimeType` | `string`  The MIME type of the quoted content. |
| `quotedFileContent.value` | `string`  The quoted content itself. This is interpreted as plain text if set through the API. |
| `assigneeEmailAddress` | `string`  Output only. The email address of the user assigned to this comment. If no user is assigned, the field is unset. |

| Methods | |
| --- | --- |
| `create` | Creates a comment on a file. |
| `delete` | Deletes a comment. |
| `get` | Gets a comment by ID. |
| `list` | Lists a file's comments. |
| `update` | Updates a comment with patch semantics. |
