# Region classifiers Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/ref-region-classifiers

Retrieved: 2026-09-19T16:31:46.144325+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

A region classifier specifies the format and location for an object. A
classifier might be a 2-dimensional rectangle for an image, a line of text in a
document, a time duration in a video, and so on. To define a region, select the
region classifier that matches the type of content you're trying to use. For
example, if your content is text, you're likely going to use either the `txt`
or `line` region classifier. To see an example of a region classifier, see
[Manage comments and
replies](https://developers.google.com/workspace/drive/api/guides/manage-comments#define).

The following is a list of the region classifiers included with the
Google Drive API:

`rect`
:   A rectangle in a 2-dimensional image.

    | Property | Description | Type |
    | --- | --- | --- |
    | `x` | Position on the x axis, units default to pixels for images and percent for PDFs. | Double |
    | `y` | Position on the y axis, units default to pixels for images and percent for PDFs. | Double |
    | `w` | Length on the x axis, units default to pixels for images and percent for PDFs. | Double |
    | `h` | Length on the y axis, units default to pixels for images and percent for PDFs. | Double |
    | `mw` | The full width of the document when the comment was made. Use this to make `x` and `w` unitless since they can act like a percentage. | Double |
    | `mh` | The full height of the document when the comment was made. See `mw` above for purpose. | Double |
    | `r` | The degrees of rotation of the document. For example, if an image is rotated 90 degrees clockwise then a rectangle at 0,0 displays in the top right of the image. Should be one of 0, 90, 180, 270. | Double |

`page`
:   A page number in a PDF, TIFF, or other document with pages. Use this for documents with page-like elements (such as a spreadsheet, slide, or layer).

    | Property | Description | Type |
    | --- | --- | --- |
    | `p` | The page number (0-indexed). | Integer |
    | `mp` | The number of pages in this document. | Integer |

`time`
:   A duration of time in a video or other document with a time dimension.

    | Property | Description | Type |
    | --- | --- | --- |
    | `t` | The start time. | `hh:MM:ss.frac` formatted time string (where M = minutes, m = millis; hours and minutes are optional) |
    | `d` | The duration of the time range. | `hh:MM:ss:mmm` formatted time string (where M = minutes, m = millis) |
    | `md` | The full-time duration of the document. | `hh:MM:ss:mmm` formatted time string (where M = minutes, m = millis) |

`txt`
:   A range of text in a document.

    | Property | Description | Type |
    | --- | --- | --- |
    | `o` | Start offset (character offset from the start of the file). | Integer |
    | `l` | The length of the text range. | Integer |
    | `ml` | The length of this document in characters. | Integer |

`line`
:   A specific line in a text file or any files with lines in it.

    | Property | Description | Type |
    | --- | --- | --- |
    | `n` | Line number. | Integer |
    | `l` | The length of the line range. | Integer |
    | `ml` | The maximum number of lines in the file. | Integer |

`matrix`
:   A location in a matrix-like structure. Used to define rows and columns in spreadsheet documents, or any other documents that have a row or column structure.

    | Property | Description | Type |
    | --- | --- | --- |
    | `c` | The column number. | Integer |
    | `r` | The row number. | Integer |
    | `w` | The number of columns. | Integer |
    | `h` | The number of rows. | Integer |
    | `mw` | The maximum width. | Integer |
    | `mh` | The maximum height. | Integer |
