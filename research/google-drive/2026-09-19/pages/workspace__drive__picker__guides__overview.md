# Overview of the Google Picker Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/picker/guides/overview

Retrieved: 2026-09-19T16:28:45.608736+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document introduces the Google Picker and the Google Picker API. It also
helps you decide which approach is best for your app.

The Google Picker provides a polished, "File Open" dialog for
information stored in Google Drive. It's a way to let users select or upload
photos, videos, and documents from their Drive account without
ever leaving your application.

The Google Picker API is the technical interface used to implement the
Google Picker in your app. By using the Google Picker API, you create
a familiar interface that handles the complexity of authentication and file
browsing, returning specific file metadata (such as IDs and URLs) back to your
app once a user makes a selection.

## Key use cases

The Google Picker is versatile and can be tailored to various
application workflows:

* **File upload alternative**: Users can upload a file into
  Drive directly through the Google Picker.
* **Collaboration tools**: Enable users to link specific Google Docs or
  Google Sheets to a project management task or shared calendar event.
* **Asset attachments**: Use the Google Picker as a way for users to
  attach supporting documentation from Drive to an expense
  report or support ticket.

## Comparison of web apps versus desktop and mobile apps

While the core functionality remains consistent, the implementation of the
Google Picker API differs depending on where your app is running. The
following comparison table lists the technical and functional differences when
implementing for web apps versus desktop and mobile apps.

| Feature | Web apps | Desktop & mobile apps |
| --- | --- | --- |
| Primary technology | Client-side JavaScript library. | OAuth 2.0 URL parameters and HTTP redirects. |
| Rendering | Integrates into the app's existing UI layout. | Opens in a new tab of the user's default system browser. Can no longer be displayed within an embedded webview. |
| Auth flow | Requires a specific access token passed through [`setOAuthToken`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setoauthtoken). | Triggered by adding `trigger_onepick=true` to the OAuth request. |
| Response method | Direct JavaScript callbacks. | Redirect URIs or custom URL schemes. |
| Scopes | Flexible; can use `drive.file`, `drive.readonly`, etc. | Strict; only `drive.file` is permitted and cannot be combined with other scopes. |
| Configuration | Uses the `PickerBuilder` fluent interface in JavaScript. | Uses query string parameters in the authorization URL. |

Note that the user must be signed in while accessing the Google Picker.

The key strategic differences are:

* Web apps are designed for high-interactivity and deep customization (such as
  specific views by file type and restricting the view to specific Drive
  folders).
* Desktop and mobile apps are designed for security and simplicity, utilizing
  the system browser to handle authentication and file picking in a single,
  unified flow.

## Related topics

* [Integrate the Google Picker into web apps](https://developers.google.com/workspace/drive/picker/guides/web-picker)
* [Integrate the Google Picker into desktop and mobile apps](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker)
* [Use the Google Picker in Google Apps Script](https://developers.google.com/apps-script/guides/dialogs#file-open-dialogs)
* [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
