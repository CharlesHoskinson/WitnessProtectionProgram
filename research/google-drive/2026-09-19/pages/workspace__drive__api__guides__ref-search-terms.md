# Search query terms and operators Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/ref-search-terms

Retrieved: 2026-09-19T16:31:42.716942+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This reference guide provides query terms and operators you can use with the
Google Drive API to filter for files, folders, and shared drives.

For file search examples, see [Search for files and
folders](https://developers.google.com/workspace/drive/api/guides/search-files).

For example searches of shared drives, see [Search for shared drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives).

## Query string syntax

A query string contains the following three parts:

*`query_term operator values`*

Where:

* *`query_term`* is the query term or field to search upon.
* *`operator`* specifies the condition for the query term.
* *`values`* are the specific values you want to use to filter your search
  results.

## Query operators

The following table lists the valid query operators:

| Operator | Usage |
| --- | --- |
| `contains` | The content of one string is present in the other. |
| `=` | The content of a string or boolean is equal to the other. |
| `!=` | The content of a string or boolean is not equal to the other. |
| `<` | A value is less than another. |
| `<=` | A value is less than or equal to another. |
| `>` | A value is greater than another. |
| `>=` | A value is greater than or equal to another. |
| `in` | An element is contained within a collection. |
| `and` | Return items that match both queries. |
| `or` | Return items that match either query. |
| `not` | Negates a search query. |
| `has` | A collection contains an element matching the parameters. |

## File-specific query terms

The following table lists all valid file query terms. For data types and
descriptions, refer to the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource
reference.

**Important:** The following query terms use fields from [Drive API v3](https://developers.google.com/workspace/drive/api/reference/rest/v3). Some resource fields changed between v2 and v3. For
example, `files.name` replaces `files.title`. If you're using [Drive API v2](https://developers.google.com/workspace/drive/api/reference/rest/v2), adjust these queries to use the
v2 fields. For more information, see [Drive API v2 and v3 comparison
reference](https://developers.google.com/workspace/drive/api/guides/v2-to-v3-reference).

| Query term | Valid operators | Usage |
| --- | --- | --- |
| `name` | `contains`, `=`, `!=` | Name of the file. Surround with single quotes (`'`). Escape single quotes in queries with `\'`, such as `'Valentine\'s Day'`. |
| `fullText` | `contains` | Whether the `name`, `description`, [`indexableText`](https://developers.google.com/workspace/drive/api/guides/file#indexable-text) properties, or text in the file's content or metadata of the file matches. Surround with single quotes (`'`). Escape single quotes in queries with `\'`, such as `'Valentine\'s Day'`. |
| `mimeType` | `contains`, `=`, `!=` | MIME type of the file. Surround with single quotes (`'`). Escape single quotes in queries with `\'`, such as `'Valentine\'s Day'`. For further information on MIME types, see [Google Workspace and Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types). |
| `modifiedTime` | `<=`, `<`, `=`, `!=`, `>`, `>=` | Date of the last file modification. [RFC 3339](http://tools.ietf.org/html/rfc3339) format, default time zone is UTC, such as `2012-06-04T12:00:00-08:00`. Fields of type `date` are not comparable to each other, only to constant dates. |
| `viewedByMeTime` | `<=`, `<`, `=`, `!=`, `>`, `>=` | Date that the user last viewed a file. [RFC 3339](http://tools.ietf.org/html/rfc3339) format, default time zone is UTC, such as `2012-06-04T12:00:00-08:00`. Fields of type `date` are not comparable to each other, only to constant dates. |
| `trashed` | `=`, `!=` | Whether the file is in the trash or not. Can be either `true` or `false`. |
| `starred` | `=`, `!=` | Whether the file is starred or not. Can be either `true` or `false`. |
| `parents` | `in` | Whether the parents collection contains the specified ID. |
| `owners` | `in` | Users who own the file. |
| `writers` | `in` | Users or groups who have permission to modify the file. See the [`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource reference. |
| `readers` | `in` | Users or groups who have permission to read the file. See the [`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource reference. |
| `sharedWithMe` | `=`, `!=` | Files that are in the user's ["Shared with me" collection](https://developers.google.com/workspace/drive/api/guides/about-files#corpora). All file users are in the file's Access Control List (ACL). Can be either `true` or `false`. |
| `createdTime` | `<=`, `<`, `=`, `!=`, `>`, `>=` | Date when the file was created. Use [RFC 3339](http://tools.ietf.org/html/rfc3339) format, default time zone is UTC, such as `2012-06-04T12:00:00-08:00`. Supported in Drive API v3 only. |
| `properties` | `has` | Public custom file properties. |
| `appProperties` | `has` | Private custom file properties. |
| `visibility` | `=`, `!=` | The visibility level of the file. Valid values are `anyoneCanFind`, `anyoneWithLink`, `domainCanFind`, `domainWithLink`, and `limited`. Surround with single quotes (`'`). |
| `shortcutDetails.targetId` | `=`, `!=` | The ID of the item the shortcut points to. |

The following demonstrates operator and query term combinations:

* The `contains` operator only performs prefix matching for a
  `name` term. For example, suppose you have a name
  of `HelloWorld`. A query of `name contains 'Hello'` returns a
  result, but a query of `name contains 'World'` doesn't.
* The `contains` operator only performs matching on entire string tokens for
  the `fullText` term. For example, if the full text of a document contains
  the string "HelloWorld", only the query `fullText contains 'HelloWorld'`
  returns a result.
* The `contains` operator matches a phrase if the right operand is surrounded
  by double quotes. For example:

  + If the `fullText` of a document contains the string "Hello there world",
    then the query `fullText contains '"Hello there"'` returns a result, but the
    query `fullText contains '"Hello world"'` doesn't.
  + If the full text of a document contains the string "Hello\_world", then
    the query `fullText contains '"Hello world"'` still returns a result as
    the underscore in the document string is treated as a space.
* The `owners`, `writers`, and `readers` terms are indirectly reflected in the
  [`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) list and refer to the `role`
  on the permission. For a complete list of role permissions, see [Roles and
  permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles).

For more examples of query string searches, see [file query string examples](https://developers.google.com/workspace/drive/api/guides/search-files#examples).

## Shared drive-specific query terms

The following table lists all valid shared drive query terms. For data types and
descriptions, see the [`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource reference.

| Query term | Valid operators | Usage | `useDomainAdminAccess` setting |
| --- | --- | --- | --- |
| `createdTime` | `<=`, `<`, `=`, `!=`, `>`, `>=` | Date when the shared drive was created. [RFC 3339](http://tools.ietf.org/html/rfc3339) format, default time zone is UTC, such as `2012-06-04T12:00:00-08:00`. | `true` |
| `hidden` | `=`, `!=` | Specifies whether the shared drive is hidden. Can be either `true` or `false`. | `false` |
| `memberCount` | `<=`, `<`, `=`, `!=`, `>`, `>=` | Number of users and groups that are members of the shared drive. Takes a numerical value. | `true` |
| `name` | `contains`, `=`, `!=` | Name of the shared drive. Surround with single quotes (`'`). Escape single quotes in queries with `\'`, such as `'Valentine\'s Day'`. | `true` |
| `organizerCount` | `<=`, `<`, `=`, `!=`, `>`, `>=` | Number of users and groups that are organizers of the shared drive. Takes a numerical value. | `true` |
| `orgUnitId` | `=`, `!=` | The organizational unit ID of a shared drive. Takes a string value. | `true` |

**Note:** For more information on the `useDomainAdminAccess` setting, see the
[`drives.list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list) method.

For more examples of query string searches, see [shared drive query string
examples](https://developers.google.com/workspace/drive/api/guides/search-shareddrives#examples).

## Related topics

* [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files)
* [Search for shared drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives)
* [Google Workspace and Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types)
* [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles)
