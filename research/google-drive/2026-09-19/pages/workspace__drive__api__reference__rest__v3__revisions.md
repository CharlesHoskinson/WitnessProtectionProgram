# REST Resource: revisions Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions

Retrieved: 2026-09-19T16:31:35.613601+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: Revision](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions#Revision)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions#Revision.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions#METHODS_SUMMARY)

## Resource: Revision

The metadata for a revision to a file.

Some resource methods (such as `revisions.update`) require a `revisionId`. Use the `revisions.list` method to retrieve the ID for a revision.

| JSON representation |
| --- |
| ``` {   "exportLinks": {     string: string,     ...   },   "id": string,   "mimeType": string,   "kind": string,   "published": boolean,   "keepForever": boolean,   "md5Checksum": string,   "modifiedTime": string,   "publishAuto": boolean,   "publishedOutsideDomain": boolean,   "publishedLink": string,   "size": string,   "originalFilename": string,   "lastModifyingUser": {     object (User)   } } ``` |

| Fields | |
| --- | --- |
| `exportLinks` | `map (key: string, value: string)`  Output only. Links for exporting Docs Editors files to specific formats.  An object containing a list of `"key": value` pairs. Example: `{ "name": "wrench", "mass": "1.3kg", "count": "3" }`. |
| `id` | `string`  Output only. The ID of the revision. |
| `mimeType` | `string`  Output only. The MIME type of the revision. |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string `"drive#revision"`. |
| `published` | `boolean`  Whether this revision is published. This is only applicable to Docs Editors files. |
| `keepForever` | `boolean`  Whether to keep this revision forever, even if it is no longer the head revision. If not set, the revision will be automatically purged 30 days after newer content is uploaded. This can be set on a maximum of 200 revisions for a file.  This field is only applicable to files with binary content in Drive. |
| `md5Checksum` | `string`  Output only. The MD5 checksum of the revision's content. This is only applicable to files with binary content in Drive. |
| `modifiedTime` | `string`  Output only. The last time the revision was modified (RFC 3339 date-time). |
| `publishAuto` | `boolean`  Whether subsequent revisions will be automatically republished. This is only applicable to Docs Editors files. |
| `publishedOutsideDomain` | `boolean`  Whether this revision is published outside the domain. This is only applicable to Docs Editors files. |
| `publishedLink` | `string`  Output only. A link to the published revision. This is only populated for Docs Editors files. |
| `size` | `string (int64 format)`  Output only. The size of the revision's content in bytes. This is only applicable to files with binary content in Drive. |
| `originalFilename` | `string`  Output only. The original filename used to create this revision. This is only applicable to files with binary content in Drive. |
| `lastModifyingUser` | `object (User)`  Output only. The last user to modify this revision. This field is only populated when the last modification was performed by a signed-in user. |

| Methods | |
| --- | --- |
| `delete` | Permanently deletes a file version. |
| `get` | Gets a revision's metadata or content by ID. |
| `list` | Lists a file's revisions. |
| `update` | Updates a revision with patch semantics. |
