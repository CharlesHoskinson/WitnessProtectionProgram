# Manage comments and replies Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/manage-comments

Retrieved: 2026-09-19T16:29:58.361194+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

*Comments* are user-provided feedback on a file, such as a reader of a
word-processing document suggesting how to rephrase a sentence. There are two
types of comments: *anchored comments* and *unanchored comments*. An anchored
comment is associated with a specific location, such as a sentence in a
word-processing document, within a specific version of a document. Conversely,
an unanchored comment is just associated with the document.

*Replies* are attached to comments and represent a user's response to the
comment. The Google Drive API lets your users add comments and replies to documents
created by your app. Collectively, a comment with replies is known as a
*discussion*.

## Use the fields parameter

For all methods (excluding `delete`) on the
[`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource, you *must* set the `fields`
[system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions) to
specify the fields to return in the response. In most Drive
resource methods this action is only required to return non-default fields, but
it's mandatory for the `comments` resource. If you omit the `fields` parameter,
the method returns an error. For more information, see [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

## Comment constraints

The following constraints are enforced when working with anchored and unanchored
comments with the Drive API:

| Comment type | File type |
| --- | --- |
| Anchored | * Developers can define their own format for the anchor   specification. * The anchor is saved and returned when retrieving the comment,   but Google Workspace editor apps treat these comments as   unanchored comments. * When retrieving comments on Google Workspace files (such as   Google Docs, Google Sheets, or Google Slides) created in the   editor, the `anchor` field contains editor-specific   internal anchor data (such as a `workbook-range` JSON   string on Sheets files). The Drive API treats   this data as opaque and can't resolve internal document regions, cell   coordinates, or slide elements. To work with anchored comments   directly on these file types, use their respective APIs:   [Google Docs API](https://developers.google.com/workspace/docs/api/how-tos/suggestions),   [Google Sheets API](https://developers.google.com/workspace/sheets/api/guides/comments), or   [Google Slides API](https://developers.google.com/workspace/slides/api/guides/comments). |
| Unanchored | * Supported on Google Workspace documents, which show them in the   "All Comments" view. * Unanchored comments are not shown on PDFs rendered in the   Drive file previewer, though they are saved and can be   retrieved through the Drive API. |

## Add an anchored comment

When you add a comment, you might want to anchor it to a region in the file. An
*anchor* defines a region in a file to which a comment refers. The
[`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource defines the [`anchor`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments#Comment.FIELDS.anchor) field as a JSON string.

**Important:** Anchors are immutable, and their position relative to the content of
a document cannot be guaranteed between revisions. We recommend you use anchors
in documents where the position doesn't change, such as image files or read-only
documents. Furthermore, Google Workspace editor apps (such as
Docs, Sheets, and Slides) don't
render comments created with the Drive API anchored to content; they
treat these comments as unanchored comments. To work with anchored comments
directly in these file types, use the
[Docs API](https://developers.google.com/workspace/docs/api/how-tos/suggestions),
[Sheets API](https://developers.google.com/workspace/sheets/api/guides/comments), or
[Slides API](https://developers.google.com/workspace/slides/api/guides/comments).

To add an anchored comment:

1. (Optional). Call the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list) method on
   the [`revisions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions) resource to list every
   `revisionID` for a document. Only follow this step if you want to anchor a
   comment to any revision other than the latest revision. If you want to use
   the latest revision, use `head` for the `revisionID`.
2. Call the [`create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/create) method on the
   [`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource with the `fileId`
   parameter, a `comments` resource containing the comment, and a JSON anchor
   string defined by your application.

The following code sample shows how to create an anchored comment:

### Python

```
import json

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- Configuration ---
# The ID of the file to comment on.
# Example: '1_aBcDeFgHiJkLmNoPqRsTuVwXyZ'
FILE_ID = 'FILE_ID'

# The text content of the comment.
COMMENT_TEXT = 'This is an example of an anchored comment.'

# The line number in your application to anchor the comment to.
# Note: Google Workspace editor apps (such as Google Docs, Sheets, and
# Slides) treat comments created using the Drive API as unanchored
# comments. Custom anchors are intended for your own applications or
# custom file viewers.
ANCHOR_LINE = 10
# --- End of user-configuration section ---

SCOPES = ["https://www.googleapis.com/auth/drive"]

creds = Credentials.from_authorized_user_file("token.json", SCOPES)

def create_anchored_comment():
    """
    Create an anchored comment with a custom application-defined anchor.

    Returns:
        The created comment object or None if an error occurred.
    """
    try:
        # Build the Drive API service
        service = build("drive", "v3", credentials=creds)

        # Define a custom anchor specification for your application.
        # The Drive API stores the anchor as an opaque string. Your custom
        # application or file viewer can parse this JSON string to position
        # the comment in your UI.
        anchor_data = {
            'line': ANCHOR_LINE,
            'revision': 'head'
        }

        # The comment body. The 'anchor' field must be a serialized
        # JSON string.
        comment_body = {
            'content': COMMENT_TEXT,
            'anchor': json.dumps(anchor_data)
        }

        # Create the comment request.
        comment = (
            service.comments()
            .create(fileId=FILE_ID, fields="*", body=comment_body)
            .execute()
        )

        print(f"Comment ID: {comment.get('id')}")
        return comment

    except HttpError as error:
        print(f"An error occurred: {error}")
        return None

create_anchored_comment()
```

The Drive API returns an instance of the `comments` resource object
which includes the `anchor` string.

**Note:** We recommend you check that a user has the correct permissions to add
comments. Further, only the creator of a comment or a reply can delete or edit a
comment or a reply. Errors occur when a person in a non-creator role tries to
delete or edit a comment. To avoid these errors, check the `author.me` field of
the [`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource.

## Add an unanchored comment

To add an unanchored comment, call the [`create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/create) method with the `fileId` parameter and a
[`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource containing the comment.

The comment is inserted as plain text, but the response body provides an
[`htmlContent`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments#Comment.FIELDS.html_content) field
containing content formatted for display.

The following code sample shows how to create an unanchored comment:

### Python

```
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- Configuration ---
# The ID of the file to comment on.
# Example: '1_aBcDeFgHiJkLmNoPqRsTuVwXyZ'
FILE_ID = 'FILE_ID'

# The text content of the comment.
COMMENT_TEXT = 'This is an example of an unanchored comment.'
# --- End of user-configuration section ---

SCOPES = ["https://www.googleapis.com/auth/drive"]

creds = Credentials.from_authorized_user_file("token.json", SCOPES)

def create_unanchored_comment():
    """
    Create an unanchored comment on a file in Drive.

    Returns:
        The created comment object or None if an error occurred.
    """
    try:
        # Build the Drive API service
        service = build("drive", "v3", credentials=creds)

        # The comment body. For an unanchored comment,
        # omit the 'anchor' property.
        comment_body = {
            'content': COMMENT_TEXT
        }

        # Create the comment request.
        comment = (
            service.comments()
            .create(fileId=FILE_ID, fields="*", body=comment_body)
            .execute()
        )

        print(f"Comment ID: {comment.get('id')}")
        return comment

    except HttpError as error:
        print(f"An error occurred: {error}")
        return None

create_unanchored_comment()
```

**Important:** We recommend you check that a user has the correct permissions to add
comments. Further, only the creator of a comment or a reply can delete or edit a
comment or a reply. Errors occur when a user in a non-creator role tries to
delete or edit a comment. To avoid these errors, check the `author.me` field of
the [`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource to make sure the user
making the request is the author of the comment and then verify their
permissions relative to the comment.

## Add a reply to a comment

To add a reply to a comment, use the
[`create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/create) method on the
[`replies`](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies) resource with the `fileId` and
`commentId` parameters. The request body uses the `content` field to add the
reply.

The reply is inserted as plain text, but the response body provides an
`htmlContent` field containing content formatted for display.

The method returns the fields listed in the `fields` field.

**Request**

In this example, we provide the `fileId` and `commentId` path parameters and multiple fields.

```
POST https://www.googleapis.com/drive/v3/files/FILE_ID/comments/COMMENT_ID/replies?fields=id,comment
```

**Request body**

```
{
  "content": "This is a reply to a comment."
}
```

### Resolve a comment

A comment can only be resolved by posting a reply to a comment.

To resolve a comment, use the [`create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/create)
method on the [`replies`](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies) resource with the `fileId`
and `commentId` parameters.

The request body uses the
[`action`](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies#Reply.FIELDS.action) field to resolve
the comment. You can also set the `content` field to add a reply that closes the
comment.

When a comment is resolved, Drive marks the `comments` resource
as `resolved: true`. Unlike [deleted comments](https://developers.google.com/workspace/drive/api/guides/manage-comments#delete-comment), resolved
comments can include the `htmlContent` or `content` fields.

When your app resolves a comment, your UI should indicate that the comment has
been addressed. For example, your app might:

* Disallow further replies and dim all previous replies plus the original
  comment.
* Hide resolved comments.

**Request**

In this example, we provide the `fileId` and `commentId` path parameters and multiple fields.

```
POST https://www.googleapis.com/drive/v3/files/FILE_ID/comments/COMMENT_ID/replies?fields=id,comment
```

**Request body**

```
{
  "action": "resolve",
  "content": "This comment has been resolved."
}
```

## Get a comment

To get a comment on a file, use the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/get)
method on the [`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource with the
`fileId` and `commentId` parameters. If you don't know the comment ID, you can
[list all comments](https://developers.google.com/workspace/drive/api/guides/manage-comments#list-comments) using the `list` method.

The method returns an instance of a `comments` resource.

To include deleted comments in the results, set the [`includeDeleted`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/get#body.QUERY_PARAMETERS.include_deleted) query
parameter to `true`.

**Request**

In this example, we provide the `fileId` and `commentId` path parameters and multiple fields.

```
GET https://www.googleapis.com/drive/v3/files/FILE_ID/comments/COMMENT_ID?fields=id,comment,modifiedTime,resolved
```

## List comments

To list comments on a file, use the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/list)
method on the [`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource with the
`fileId` parameter. The method returns a list of comments.

Pass the following query parameters to customize pagination of, or filter,
comments:

* `includeDeleted`: Set to `true` to include deleted comments. Deleted
  comments don't include the `htmlContent` or `content` fields.
* `pageSize`: The maximum number of comments to return per page.
* `pageToken`: A page token, received from a previous list call. Provide this
  token to retrieve the subsequent page.
* `startModifiedTime`: The minimum value of the `modifiedTime` field for the
  result comments.

**Request**

In this example, we provide the `fileId` path parameter, the `includeDeleted` query parameter, and multiple fields.

```
GET https://www.googleapis.com/drive/v3/files/FILE_ID/comments?includeDeleted=true&fields=(id,comment,kind,modifiedTime,resolved)
```

## Update a comment

To update a comment on a file, use the
[`update`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/update) method on the [`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource with the `fileId` and `commentId`
parameters. The request body uses the `content` field to update the comment.

The boolean [`resolved`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments#Comment.FIELDS.resolved)
field on the `comments` resource is read-only. A comment can only be resolved by
posting a reply to a comment. For more information, see [Resolve a
comment](https://developers.google.com/workspace/drive/api/guides/manage-comments#resolve-comment).

The method returns the fields listed in the `fields` query parameter.

**Request**

In this example, we provide the `fileId` and `commentId` path parameters and multiple fields.

```
PATCH https://www.googleapis.com/drive/v3/files/FILE_ID/comments/COMMENT_ID?fields=id,comment
```

**Request body**

```
{
  "content": "This comment is now updated."
}
```

## Delete a comment

To delete a comment on a file, use the
[`delete`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/delete) method on the [`comments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource with the `fileId` and `commentId`
parameters.

When a comment is deleted, Drive marks the comment resource as
`deleted: true`. Deleted comments don't include the `htmlContent` or `content`
fields.

**Request**

In this example, we provide the `fileId` and `commentId` path parameters.

```
DELETE https://www.googleapis.com/drive/v3/files/FILE_ID/comments/COMMENT_ID
```

## Related topics

* [Files and folders overview](https://developers.google.com/workspace/drive/api/guides/about-files)
* [Manage file revisions](https://developers.google.com/workspace/drive/api/guides/manage-revisions)
* [Google Docs API: Work with comments and
  suggestions](https://developers.google.com/workspace/docs/api/how-tos/suggestions)
* [Google Sheets API: Manage comments](https://developers.google.com/workspace/sheets/api/guides/comments)
* [Google Slides API: Manage comments](https://developers.google.com/workspace/slides/api/guides/comments)
