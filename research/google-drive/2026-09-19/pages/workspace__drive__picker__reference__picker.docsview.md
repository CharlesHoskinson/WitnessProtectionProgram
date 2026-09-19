# Class DocsView Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/picker/reference/picker.docsview

Retrieved: 2026-09-19T16:28:51.779624+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

Use `DocsView` to select files from Google Drive.

## Signature

```
export class DocsView extends View
```

## Heritage

|  |  |
| --- | --- |
| Extends | `View` |

## Details

|  |  |
| --- | --- |
| Final | No |

## Constructors

| Name | Description |
| --- | --- |
| [`(constructor)(viewId)`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview._constructor_) | Constructs a new instance of the `DocsView` class |

## Methods

| Name | Description |
| --- | --- |
| [`getId()`](https://developers.google.com/workspace/drive/picker/reference/picker.view.getid.md) | Returns the `ViewId` of the view. *(Inherited from [`View`](https://developers.google.com/workspace/drive/picker/reference/picker.view))* |
| [~~`getLabel()`~~](https://developers.google.com/workspace/drive/picker/reference/picker.view.getlabel.md) | *(Deprecated)*  *(Inherited from [`View`](https://developers.google.com/workspace/drive/picker/reference/picker.view))* |
| [`setEnableDrives(enabled)`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setenabledrives) | Shows shared drives and the files they contain. Before enabling, refer to [GoogleDrive API documentation for enabling shared drives](https://developers.google.com/workspace/drive/v3/web/enable-shareddrives). |
| [`setFileIds(fileIds)`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setfileids) | Sets the file IDs included in the view. |
| [`setIncludeFolders(included)`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setincludefolders) | Show folders in the view items. |
| [~~`setLabel(label)`~~](https://developers.google.com/workspace/drive/picker/reference/picker.view.setlabel.md) | *(Deprecated)*  *(Inherited from [`View`](https://developers.google.com/workspace/drive/picker/reference/picker.view))* |
| [`setMimeTypes(mimeTypes)`](https://developers.google.com/workspace/drive/picker/reference/picker.view.setmimetypes.md) | Sets the MIME types included in the view. Use commas to separate MIME types if more than one is required. If you don't set MIME types, files of all MIME types are displayed in the view. *(Inherited from [`View`](https://developers.google.com/workspace/drive/picker/reference/picker.view))* |
| [`setMode(mode)`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setmode) | Selects which mode the view will use to display the documents. |
| [`setOwnedByMe(me)`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setownedbyme) | Filters the documents based on whether they are owned by the user, or shared with the user. |
| [`setParent(parentId)`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setparent) | Sets the initial parent folder to display. |
| [`setQuery(query)`](https://developers.google.com/workspace/drive/picker/reference/picker.view.setquery.md) | For views involving searches, prepopulate the search query with these terms. *(Inherited from [`View`](https://developers.google.com/workspace/drive/picker/reference/picker.view))* |
| [`setSelectFolderEnabled(enabled)`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setselectfolderenabled) | Allows the user to select a folder in Google Drive. |
| [`setStarred(starred)`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setstarred) | Filters the documents based on whether they are starred by the user. |
