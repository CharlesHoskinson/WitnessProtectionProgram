# Label Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/Label

Retrieved: 2026-09-19T16:31:39.828756+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/Label#SCHEMA_REPRESENTATION)
* [Field](https://developers.google.com/workspace/drive/api/reference/rest/v3/Label#Field)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/Label#Field.SCHEMA_REPRESENTATION)

Representation of label and label fields.

| JSON representation |
| --- |
| ``` {   "id": string,   "revisionId": string,   "kind": string,   "fields": {     string: {       object (Field)     },     ...   } } ``` |

| Fields | |
| --- | --- |
| `id` | `string`  The ID of the label. |
| `revisionId` | `string`  The revision ID of the label. |
| `kind` | `string`  This is always drive#label |
| `fields` | `map (key: string, value: object (Field))`  A map of the fields on the label, keyed by the field's ID.  An object containing a list of `"key": value` pairs. Example: `{ "name": "wrench", "mass": "1.3kg", "count": "3" }`. |

## Field

Representation of field, which is a typed key-value pair.

| JSON representation |
| --- |
| ``` {   "kind": string,   "id": string,   "valueType": string,   "dateString": [     string   ],   "integer": [     string   ],   "selection": [     string   ],   "text": [     string   ],   "user": [     {       object (User)     }   ] } ``` |

| Fields | |
| --- | --- |
| `kind` | `string`  This is always drive#labelField. |
| `id` | `string`  The identifier of this label field. |
| `valueType` | `string`  The field type. While new values may be supported in the future, the following are currently allowed:   * `dateString` * `integer` * `selection` * `text` * `user` |
| `dateString[]` | `string`  Only present if `valueType` is `dateString`. RFC 3339 formatted date: YYYY-MM-DD. |
| `integer[]` | `string (int64 format)`  Only present if `valueType` is `integer`. |
| `selection[]` | `string`  Only present if `valueType` is `selection` |
| `text[]` | `string`  Only present if `valueType` is `text`. |
| `user[]` | `object (User)`  Only present if `valueType` is `user`. |
