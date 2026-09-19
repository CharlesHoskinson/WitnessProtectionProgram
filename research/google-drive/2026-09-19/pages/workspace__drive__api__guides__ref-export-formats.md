# Export MIME types for Google Workspace documents Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/ref-export-formats

Retrieved: 2026-09-19T16:31:44.426223+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The following table shows how Google Workspace documents map to export [MIME
types](https://www.iana.org/assignments/media-types/media-types.xhtml):

| Document Type | Format | MIME Type | File Extension |
| --- | --- | --- | --- |
| **Documents** | Microsoft Word | application/vnd.openxmlformats-officedocument.wordprocessingml.document | .docx |
|  | OpenDocument | application/vnd.oasis.opendocument.text | .odt |
|  | Rich Text | application/rtf | .rtf |
|  | PDF | application/pdf | .pdf |
|  | Plain Text | text/plain | .txt |
|  | Web Page (HTML) | text/html | .html |
|  | Web Page (HTML, zipped) | application/zip | .zip |
|  | EPUB | application/epub+zip | .epub |
|  | Markdown | text/markdown | .md |
| **Spreadsheets** | Microsoft Excel | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | .xlsx |
|  | OpenDocument | application/vnd.oasis.opendocument.spreadsheet | .ods |
|  | PDF | application/pdf | .pdf |
|  | Web Page (HTML, zipped) | application/zip | .zip |
|  | Comma Separated Values (first-sheet only) | text/csv | .csv |
|  | Tab Separated Values (first-sheet only) | text/tab-separated-values | .tsv |
| **Presentations** | Microsoft PowerPoint | application/vnd.openxmlformats-officedocument.presentationml.presentation | .pptx |
|  | ODP | application/vnd.oasis.opendocument.presentation | .odp |
|  | PDF | application/pdf | .pdf |
|  | Plain Text | text/plain | .txt |
| **Drawings** | PDF | application/pdf | .pdf |
|  | JPEG | image/jpeg | .jpg |
|  | PNG | image/png | .png |
|  | Scalable Vector Graphics | image/svg+xml | .svg |
| **Apps Script** | JSON | application/vnd.google-apps.script+json | .json |
| **Google Vids** | MP4 | video/mp4 | .mp4 |

**Note:** Google Vids files cannot be exported using the `files.export` method
or the `exportLinks` field on the `files` resource. Attempting to do so returns
a `fileNotExportable` error. To download Google Vids files as MP4, use the
[`files.download`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/download) method with [long-running
operations](https://developers.google.com/workspace/drive/api/guides/manage-downloads#download-content-lro).

## Additional export options

To view a list of all system supported export formats for a user, use the
[`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get) method on the [`about`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about) resource with the `fields` parameter set to
[`exportFormats`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about#About.FIELDS.export_formats).

You can also export Google Workspace documents using Google Apps Script. For
more information on supported formats when exporting content in
Apps Script, see the reference documentation for [Google Docs](https://developers.google.com/apps-script/reference/document/document#getascontenttype), [Google Sheets](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet#getascontenttype),
and [Google Slides](https://developers.google.com/apps-script/reference/slides/image#getascontenttype).

## Related topics

* [Google Workspace and Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types)
* [Return user info](https://developers.google.com/workspace/drive/api/guides/user-info)
