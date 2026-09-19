# REST Resource: channels Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/channels

Retrieved: 2026-09-19T16:30:52.840757+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: Channel](https://developers.google.com/workspace/drive/api/reference/rest/v3/channels#Channel)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/channels#Channel.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/channels#METHODS_SUMMARY)

## Resource: Channel

A notification channel used to watch for resource changes.

| JSON representation |
| --- |
| ``` {   "params": {     string: string,     ...   },   "payload": boolean,   "id": string,   "resourceId": string,   "resourceUri": string,   "token": string,   "expiration": string,   "type": string,   "address": string,   "kind": string } ``` |

| Fields | |
| --- | --- |
| `params` | `map (key: string, value: string)`  Additional parameters controlling delivery channel behavior. Optional.  An object containing a list of `"key": value` pairs. Example: `{ "name": "wrench", "mass": "1.3kg", "count": "3" }`. |
| `payload` | `boolean`  A Boolean value to indicate whether payload is wanted. Optional. |
| `id` | `string`  A UUID or similar unique string that identifies this channel. |
| `resourceId` | `string`  An opaque ID that identifies the resource being watched on this channel. Stable across different API versions. |
| `resourceUri` | `string`  A version-specific identifier for the watched resource. |
| `token` | `string`  An arbitrary string delivered to the target address with each notification delivered over this channel. Optional. |
| `expiration` | `string (int64 format)`  Date and time of notification channel expiration, expressed as a Unix timestamp, in milliseconds. Optional. |
| `type` | `string`  The type of delivery mechanism used for this channel. Valid values are "web\_hook" or "webhook". |
| `address` | `string`  The address where notifications are delivered for this channel. |
| `kind` | `string`  Identifies this as a notification channel used to watch for changes to a resource, which is `api#channel`. |

| Methods | |
| --- | --- |
| `stop` | Stops watching resources through this channel. |
