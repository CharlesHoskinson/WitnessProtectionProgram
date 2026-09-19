# User Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/User

Retrieved: 2026-09-19T16:31:41.089671+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/User#SCHEMA_REPRESENTATION)

Information about a Drive user.

| JSON representation |
| --- |
| ``` {   "displayName": string,   "kind": string,   "me": boolean,   "permissionId": string,   "emailAddress": string,   "photoLink": string } ``` |

| Fields | |
| --- | --- |
| `displayName` | `string`  Output only. A plain text displayable name for this user. |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string `drive#user`. |
| `me` | `boolean`  Output only. Whether this user is the requesting user. |
| `permissionId` | `string`  Output only. The user's ID as visible in Permission resources. |
| `emailAddress` | `string`  Output only. The email address of the user. This may not be present in certain contexts if the user has not made their email address visible to the requester. |
| `photoLink` | `string`  Output only. A link to the user's profile photo, if available. |
