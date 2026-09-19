# Google Drive API overview Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/about-sdk

Retrieved: 2026-09-19T16:28:41.219042+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The Google Drive API lets you create apps that use Google Drive cloud storage.
You can develop applications that integrate with Drive, and
create robust functionality in your application using the Drive API.

This diagram shows the flow between your Drive-integrated app,
the Drive API, and Drive:

![Flow diagram showing a Drive-integrated app using the Drive API and OAuth 2.0 to access My Drive and shared drives.](/static/workspace/drive/images/drive-intro.svg)

**Figure 1.** A Drive-integrated app uses the
Drive API and OAuth 2.0 to interact with files in My
Drive and shared drives.

These terms define the key components shown in Figure 1:

*Google Drive*
:   Google's cloud file storage service provides users with a
    personal storage space, called *My Drive*, and the option to
    access collaborative shared folders, called *shared drives*.

*Google Drive API*
:   The REST API that lets you use Drive storage
    from within your app.

*Drive-integrated app*
:   An app that uses Drive as its storage solution.

*Google Drive UI*
:   Google's user interface that manages files stored on
    Drive. If your app is an editor-type app, such as a
    spreadsheet or word processor, you can integrate with the
    Drive UI to create and open files within your app.

*My Drive*
:   A Drive storage location that a
    specific user owns. Files stored on My Drive can be shared
    with other users, but ownership of the content remains specific to an
    individual user.

*OAuth 2.0*
:   The authorization protocol that the Drive API requires to
    authenticate your app users. If your application uses [Sign In With
    Google](https://developers.google.com/identity/gsi/web/guides/overview), it handles the OAuth 2.0 flow
    and application access tokens.

*Shared drive*
:   A Drive storage location that owns files that multiple users
    collaborate on. Any user with access to a shared drive has access to all
    files it contains. Users can also be granted access to individual
    files inside the shared drive.

## What can you do with the Drive API?

You can use the Drive API to:

* [Download files](https://developers.google.com/workspace/drive/api/guides/manage-downloads) from Drive
  and [upload files](https://developers.google.com/workspace/drive/api/guides/manage-uploads) to Drive.
* [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files) stored in
  Drive. Create complex search queries that return any of the
  file metadata fields in the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource.
* Let users [share files, folders, and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
  to collaborate on content.
* Combine with the [Google Picker API](https://developers.google.com/workspace/drive/picker/guides/overview)
  to search all files in Drive, then return the filename, URL,
  last modified date, and user.
* [Create third-party shortcuts](https://developers.google.com/workspace/drive/api/guides/third-party-shortcuts) that
  are external links to data stored outside of Drive, in a
  different datastore or cloud storage system.
* Create a dedicated Drive folder to [store
  application-specific data](https://developers.google.com/workspace/drive/api/guides/appdata) so the app cannot access
  all the user's content stored in Drive.
* Monitor or respond to file activity using [Google Drive
  events](https://developers.google.com/workspace/events/guides/events-drive).
* Integrate your Drive-integrated app with the [Drive UI](https://developers.google.com/workspace/drive/api/guides/about-apps) using the Google Drive
  UI. It's Google's standard web UI that you can use to create, organize,
  discover, and share Drive files.
* Apply [labels](https://developers.google.com/workspace/drive/api/guides/about-labels) to Drive files,
  set label field values, read label field values on files, and search for
  files using label metadata terms defined by the custom label taxonomy.

|  |  |
| --- | --- |
|  | Want to see the Google Drive API in action?  The Google Workspace Developers channel offers videos about tips, tricks, and the latest features.  [Subscribe now](https://www.youtube.com/channel/UCUcg6az6etU_gRtZVAhBXaw) |

## Related topics

* To learn about developing with Google Workspace APIs, including handling
  authentication and authorization, see [Develop on
  Google Workspace](https://developers.google.com/workspace/guides/getstarted-overview).
* To learn how to configure and run a Drive API app, read the
  [Quickstarts](https://developers.google.com/workspace/drive/api/quickstart/js).
