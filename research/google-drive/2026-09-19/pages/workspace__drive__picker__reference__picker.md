# Resource summary for Google Picker API Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/picker/reference/picker

Retrieved: 2026-09-19T16:28:48.777383+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The Google Picker API uses a builder pattern with
[`PickerBuilder`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder) and [`Picker`](https://developers.google.com/workspace/drive/picker/reference/picker.picker).

Note: The
[`@googleworkspace/drive-picker-element`](https://npmjs.com/package/@googleworkspace/drive-picker-element)
web component offers an additional way to integrate the Google Picker API into your web apps. For more
information, see [Use the Google Picker web component](https://developers.google.com/workspace/drive/picker/guides/web-component).

```
const picker = new google.picker.PickerBuilder()
    .setOAuthtoken('TOKEN_FOR_USER')
    .setAppId('1234567890')  // Cloud Project number
    .addView(google.picker.ViewId.DOCS)
    .setCallback((data) => {
      console.log(data);
    })
    .build();

picker.setVisible(true);
```

## Classes

| Name | Description |
| --- | --- |
| [`DocsUploadView`](https://developers.google.com/workspace/drive/picker/reference/picker.docsuploadview) | Use `DocsUploadView` to upload files to Google Drive. |
| [`DocsView`](https://developers.google.com/workspace/drive/picker/reference/picker.docsview) | Use `DocsView` to select files from Google Drive. |
| [`Picker`](https://developers.google.com/workspace/drive/picker/reference/picker.picker) | `Picker` is the top level object representing the UI action with the user. These objects are not created directly, but instead use the `PickerBuilder` class. |
| [`PickerBuilder`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder) | `PickerBuilder` is used to create `Picker` objects. Except where noted otherwise, the return type of methods below is of type `PickerBuilder`, allowing you to chain one call after another. |
| [`ResourceId`](https://developers.google.com/workspace/drive/picker/reference/picker.resourceid) | `ResourceId` is a utility class for generating resource IDs for documents. |
| [`View`](https://developers.google.com/workspace/drive/picker/reference/picker.view) | An abstract class for all views. |
| [`ViewGroup`](https://developers.google.com/workspace/drive/picker/reference/picker.viewgroup) | A `ViewGroup` is a visual grouping of views in the navigation pane. |

## Enums

| Name | Description |
| --- | --- |
| [`Action`](https://developers.google.com/workspace/drive/picker/reference/picker.action) | The action type for the `ResponseObject`. |
| [`Audience`](https://developers.google.com/workspace/drive/picker/reference/picker.audience) | `Audience` is an enumerated type used to describe the audience of the `DocumentObject`. |
| [`DocsViewMode`](https://developers.google.com/workspace/drive/picker/reference/picker.docsviewmode) | `DocsViewMode` is an enumerated type for displaying data within a DocsView. Use these values in calls to `DocsView.setMode`. |
| [`Document`](https://developers.google.com/workspace/drive/picker/reference/picker.document) | `Document` is an enumerated type used to describe the fields of a `DocumentObject`. |
| [`Feature`](https://developers.google.com/workspace/drive/picker/reference/picker.feature) | `Feature` is an enumerated type, for turning on/off features for various views. Use these values in calls to `PickerBuilder.enableFeature` and `PickerBuilder.disableFeature`. |
| [`Response`](https://developers.google.com/workspace/drive/picker/reference/picker.response) | `Response` is an enumerated type used to describe the fields of a `ResponseObject`. |
| [`ServiceId`](https://developers.google.com/workspace/drive/picker/reference/picker.serviceid) | `ServiceId` is an enumerated type used to describe the service the item was selected from. |
| [`Thumbnail`](https://developers.google.com/workspace/drive/picker/reference/picker.thumbnail) | `Thumbnail` is an enumerated type describing the fields of a `ThumbnailObject`. |
| [`Type`](https://developers.google.com/workspace/drive/picker/reference/picker.type) | The type of the selected item. |
| [`ViewId`](https://developers.google.com/workspace/drive/picker/reference/picker.viewid) | `ViewId` is an enumerated type for the various views available in the Picker. Use these values in calls to `DocsView` and `PickerBuilder`. |
| [`ViewToken`](https://developers.google.com/workspace/drive/picker/reference/picker.viewtoken) | `ViewToken` is an enumerated type used to describe the elements of a `ResponseObject.viewToken`. |

## Interfaces

| Name | Description |
| --- | --- |
| [`DocumentObject`](https://developers.google.com/workspace/drive/picker/reference/picker.documentobject) | `DocumentObject` is an interface describing the attributes of a selected item. |
| [`ResponseObject`](https://developers.google.com/workspace/drive/picker/reference/picker.responseobject) | The response object passed to the callback method. |
| [`ThumbnailObject`](https://developers.google.com/workspace/drive/picker/reference/picker.thumbnailobject) | `ThumbnailObject` is an interface describing the attributes of a photo or video. |

## Type aliases

| Name | Description |
| --- | --- |
| [`Locales`](https://developers.google.com/workspace/drive/picker/reference/picker.locales) | The supported ISO 639 language codes for `PickerBuilder.setLocale`. |
| [`ParentDocumentObject`](https://developers.google.com/workspace/drive/picker/reference/picker.parentdocumentobject) | `ParentDocumentObject` is an interface describing the attributes of a parent folder for a selected item. |
