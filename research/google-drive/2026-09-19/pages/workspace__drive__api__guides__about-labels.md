# Labels overview Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/about-labels

Retrieved: 2026-09-19T16:30:15.928394+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

*Labels* are metadata that you define to help users organize, find, and apply
policy to files in Google Drive. The Drive API allows developers to
apply labels to files and folders, set label field values, read labels and field
values on files, and search for files using metadata terms defined by the custom
label taxonomy.

Drive labels can support business processes by attaching metadata
to files and folders. Common uses for labels are:

* **Classify content to follow an information governance strategy**—Create a
  label to identify sensitive content or data that requires special handling.
  For example, you might create a badged label (a label with color-coded
  option values) titled "Sensitivity" with the values of "Top Secret,"
  "Confidential," and "Public."
* **Apply policy to items in Drive**—Create labels to manage
  Drive content throughout its lifecycle and ensure it adheres
  to your organization's record keeping practices. For example, use labels to
  manage a data loss policy (DLP) whereby users can't download files with a
  "Sensitivity" label set to "Top Secret".
* **Curate and find files**—Create labels to increase searchability of your
  company's content by letting people in your organization find items based on
  labels and their fields. For example, apply a "Signature Status" label set
  to "Awaiting Signature" to all contracts awaiting signature by a specific
  date. Drive search can then return these contracts when
  someone searches "awaiting signature".

Below is a list of common terms used by Drive labels:

*Label*
:   Structured metadata placed on a Drive file.
    Drive users can assign labels and set label field values
    for files. Labels are composed of:

    *Label name*
    :   The resource name of the label. The *label ID* is part of the
        Label name. Depending on the request, the name is in the form of either:
        `labels/{id}` or `labels/{id}@{revisionId}`. For more information, see
        [Label revision](https://developers.google.com/workspace/drive/api/guides/about-labels#revision) below.

    *Label ID*
    :   A globally unique identifier for the label. The ID is part of the
        label name, but unlike the name, it's consistent between revisions.

*Field*
:   An individual typed, settable component of a label. A label can have zero or
    more fields associated with it. Selection and user fields can be set with
    multiple values if the field is configured with
    [`ListOptions`](https://developers.google.com/workspace/drive/labels/reference/rest/v2/labels#listoptions) in the
    [Google Drive Labels API](https://developers.google.com/workspace/drive/labels/guides/overview).

    *Field type*
    :   The data type of the value associated with the *field*. Configurable as
        integer, dateString, text, user, or selection. The type chosen impacts
        both the valid values applicable to Drive items and the
        search query options available.

*Label taxonomy*
:   The configured label fields available to users for application to
    Drive files. Readable and writable through the
    Drive Labels API. Also known as the label schema.

*Label revision*
:   An instance of the label. Anytime a label is created, updated, published, or
    deprecated, the label revision increments.

    *Draft revision*
    :   The revision number of the current draft instance of the label. You can
        make several updates to a label, each incrementing its draft revision
        number, without affecting the published revision. The ability to have
        draft labels lets you test label updates before publishing.

    *Published revision*
    :   The revision number of the published version of a label. The published
        label is the instance of the label available to users.

## Related topics

* To learn about using labels in Drive, see [Set a label field
  on a file](https://developers.google.com/workspace/drive/api/guides/set-label).
* Learn more about the [Drive Labels API](https://developers.google.com/workspace/drive/labels/guides/overview).
