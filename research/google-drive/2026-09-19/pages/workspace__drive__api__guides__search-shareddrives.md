# Search for shared drives Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/search-shareddrives

Retrieved: 2026-09-19T16:30:15.164779+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This guide explains how the Google Drive API supports several ways to search shared
drives.

To search for a specific set of shared drives, use the query string `q` field
with the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list) method on the [`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource to filter the drives to return by
combining one or more search terms.

A query string contains the following three parts:

*`query_term operator values`*

Where:

* *`query_term`* is the query term or field to search upon.

  **Note:** Most query terms require `useDomainAdminAccess=true`. For more
  information about this flag, see the
  [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list) method.
* *`operator`* specifies the condition for the query term.
* *`values`* are the specific values you want to use to filter your search
  results.

For example, the following query string filters the search to only return shared
drives with the name "Google Drive API resources."

```
q: name = 'Google Drive API resources' & useDomainAdminAccess=false
```

To view all shared drive query terms, see [Shared drive-specific query terms](https://developers.google.com/workspace/drive/api/guides/ref-search-terms#drive-properties).

To view all query operators that you can use to construct a query, see [Query
operators](https://developers.google.com/workspace/drive/api/guides/ref-search-terms#operators).

## Query string examples

The following table lists examples of some basic query strings for shared
drives. The actual code differs depending on the client library you use for your
search.

You must also escape special characters in your file names to make sure the
query works correctly. For example, if a filename contains both an apostrophe
(`'`) and a backslash (`"\"`) character, use a backslash to escape them: `name
contains 'quinn\'s paper\\essay'`.

**Note:** These examples show the unencoded `q` parameter, where `organizerCount =
0` is encoded as `organizerCount+%3d+0`. Client libraries handle this encoding
automatically.

| What to query | Example | `useDomainAdminAccess` setting |
| --- | --- | --- |
| **String match operator (`contains`)** | | |
| Shared drives with the word 'confidential' in the title among all shared drives that the user is a member of | `name contains 'confidential'` | `false` |
| **Equality and inequality operators (`=`, `!=`)** | | |
| Shared drives visible in the default view | `hidden = false` | `false` |
| Shared drives hidden from the default view | `hidden = true` | `false` |
| Shared drives with no assigned organizer | `organizerCount = 0` | `true` |
| Shared drives with exactly one member | `memberCount = 1` | `true` |
| Shared drives that belong to the organizational unit ID | `orgUnitId = 'C03az79cb'` | `true` |
| Shared drives that don't contain the organizational unit ID | `orgUnitId != 'C03az79cb'` | `true` |
| Shared drives with names not matching a specific name | `name != 'Archived Projects'` | `true` |
| **Comparison operators (`>`, `>=`, `<`, `<=`)** | | |
| Shared drives created after June 1, 2017 | `createdTime > '2017-06-01T12:00:00'` | `true` |
| Shared drives created before January 1, 2023 | `createdTime < '2023-01-01T00:00:00'` | `true` |
| Shared drives with more than one member | `memberCount > 1` | `true` |
| Shared drives with fewer than 5 members | `memberCount < 5` | `true` |
| Shared drives with 3 or fewer organizers | `organizerCount <= 3` | `true` |
| **Logical operators (`and`, `or`, `not`)** | | |
| Shared drives with the word 'confidential' in the title and 20 or more members | `name contains 'confidential' and memberCount >= 20` | `true` |
| Shared drives with the word 'confidential' in the title among all shared drives of the organization | `name contains 'confidential' and orgUnitId = 'C03az79cb'` | `true` |
| Shared drives with names containing either 'Project' or 'Archive' | `name contains 'Project' or name contains 'Archive'` | `true` |
| Shared drives that don't contain 'Draft' in their name | `not name contains 'Draft'` | `true` |
| Shared drives not belonging to a target organizational unit and created after a specific date | `orgUnitId != 'C03az79cb' and createdTime > '2023-01-01T00:00:00'` | `true` |

## Query multiple terms with parentheses

You can use parentheses to group multiple query terms together. For example, to
search for shared drives created after a specific date and that either have more
than five organizers or more than 20 members, use this query:

```
createdTime > '2019-01-01T12:00:00' and (organizerCount > 5 or memberCount > 20)
```

This search returns all shared drives created after January 1st, 2019 and that
have more than five organizers or more than 20 members.

The Drive API evaluates `and` and `or` operators from left to right,
so the same search without parentheses would return:

* Only shared drives with more than five organizers that were created after
  January 1st, 2019.
* All shared drives with more than 20 members, even those created before
  January 1st, 2019.

## Related topics

* [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files)
* [Search query terms and operators](https://developers.google.com/workspace/drive/api/guides/ref-search-terms)
