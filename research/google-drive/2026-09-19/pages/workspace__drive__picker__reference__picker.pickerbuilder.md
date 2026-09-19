# Class PickerBuilder Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder

Retrieved: 2026-09-19T16:28:50.342455+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

`PickerBuilder` is used to create `Picker` objects. Except where noted
otherwise, the return type of methods below is of type `PickerBuilder`, allowing
you to chain one call after another.

**Note:** The
[@googleworkspace/drive-picker-element](https://npmjs.com/package/@googleworkspace/drive-picker-element)
custom web component is a streamlined way to integrate the Google Picker into
your web app. For React applications, use the
[@googleworkspace/drive-picker-react](https://npmjs.com/package/@googleworkspace/drive-picker-react)
React component.

## Examples

Build a basic `Picker` using the builder pattern.

```
const picker = new google.pickerPickerBuilder()
  .setOAuthToken('TOKEN_FOR_USER')
  .setAppId('1234567890')  // Cloud Project number
  .addView(google.picker.ViewId.DOCS)
  .setCallback((data) => {
    console.log(data);
  })
  .build();
```

## Signature

```
export class PickerBuilder
```

## Details

|  |  |
| --- | --- |
| Final | No |

## Methods

| Name | Description |
| --- | --- |
| [`addView(viewOrViewId)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.addview) | Add a view to the navigation pane. |
| [`addViewGroup(viewGroup)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.addviewgroup) | Add a ViewGroup to the top-level navigation pane. |
| [`build()`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.build) | Construct the Picker object. |
| [`disableFeature(feature)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.disablefeature) | Disable a picker feature. |
| [`enableFeature(feature)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.enablefeature) | Enable a picker feature. |
| [`getRelayUrl()`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.getrelayurl) | Get the relay URL, used for gadgets.rpc. |
| [`getTitle()`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.gettitle) | Get the dialog title. |
| [`hideTitleBar()`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.hidetitlebar) | Disable the title bar from being shown. To re-enable, call `setTitle` with a non-empty title or `undefined`. |
| [`isFeatureEnabled(feature)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.isfeatureenabled) | Check if a picker `Feature` is enabled. |
| [`setAppId(appId)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setappid) | Sets the Id of the application needing to access the user's files via the [`Drive API`](https://developers.google.com/workspace/drive/api). |
| [`setCallback(method)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setcallback) | Set the callback method. This method is called when the user selects items or cancels. The callback method receives a single callback object. The structure of the callback object is described in the [JSON Guide](https://developers.google.com/workspace/drive/picker/reference/results). |
| [`setDeveloperKey(key)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setdeveloperkey) | Sets the Browser API key obtained from Google Developers Console. See the Developer's Guide for details on how to obtain the Browser API key. |
| [`setDocument(document)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setdocument) | Set the document. |
| [`setLocale(locale)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setlocale) | Set the locale for the picker. The locale is an ISO 639 language code. If the language is not supported, en-US is used. |
| [`setMaxItems(max)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setmaxitems) | Sets the maximum number of items a user can pick. |
| [`setOAuthToken(token)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setoauthtoken) | Sets an OAuth token to use for authenticating the current user. |
| [`setOrigin(origin)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setorigin) | Sets the origin of picker dialog. The origin should be set to the window.location.protocol + '//' + window.location.host of the top-most page, if your application is running in an iframe. |
| [`setRelayUrl(url)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setrelayurl) | Set the relay URL, used for gadgets.rpc. |
| [`setSelectableMimeTypes(type)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setselectablemimetypes) | Set the list of MIME types which will be selectable. Use commas to separate MIME types if more than one is required. If you don't set MIME types, files of all MIME types are displayed in the view. |
| [`setSize(width, height)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setsize) | Set the preferred dialog size. The dialog will be auto-centered. It has a minimum size of (566,350) and a maximum size of (1051,650). |
| [`setTitle(title)`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.settitle) | Set the dialog title. |
| [`toUri()`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.touri) | Returns the URI generated by this builder. |
