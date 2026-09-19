# Use the Google Picker web component Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/picker/guides/web-component

Retrieved: 2026-09-19T16:30:31.921899+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The Google Picker web component offers an additional way to integrate the
Google Picker API into your web apps.

The web component simplifies integrating Google Drive file selection into your
web apps. It wraps all the boilerplate API loading and authentication logic into
a single HTML element. It lets you drop a `<drive-picker>` tag directly into
your code without needing to write the `gapi` loading logic. It can be used in
plain HTML and JavaScript, and is also framework-agnostic, working seamlessly
with Svelte, Vue, Angular, and more.

For more information on the web component library, see
[`@googleworkspace/drive-picker-element`](https://npmjs.com/package/@googleworkspace/drive-picker-element).

For React apps, use the web component's official React wrapper package:
[`@googleworkspace/drive-picker-react`](https://www.npmjs.com/package/@googleworkspace/drive-picker-react).

## Key features

* **Straightforward integration:** Add Google Picker to your web apps
  with a few lines of code.
* **Framework independent:** Works seamlessly with any web framework you
  choose (React, Vue, Angular, etc.).
* **Open source and customizable:** The code is freely available and you can
  customize it to fit your specific needs.
* **Seamless OAuth support:** Handles user authentication automatically,
  providing a smooth user experience.
* **Customizable views:** Configure the Google Picker to display only
  the file types or views you need by setting attributes.

## Get started

1. Install the component using NPM or similar:

   ```
   npm i @googleworkspace/drive-picker-element
   ```

   A CDN version is also available. For available formats and versions, see
   [`unpkg`](https://unpkg.com/browse/@googleworkspace/drive-picker-element/dist/).

   ```
   <script src="https://unpkg.com/@googleworkspace/drive-picker-element@latest/dist/index.iife.min.js"></script>
   ```
2. Import the `@googleworkspace/drive-picker-element` components into your
   JavaScript file:

   ```
   import "@googleworkspace/drive-picker-element";
   ```

   The import isn't required if you're using the CDN version as it
   automatically loads the Google Picker library and the Google API
   client library used for authentication.
3. Add the custom elements to your HTML file:

   ```
   <drive-picker>
       <drive-picker-docs-view></drive-picker-docs-view>
   </drive-picker>
   ```

   For `<drive-picker/>` and `<drive-picker-docs-view/>` attributes and
   properties, see the reference documentation for the
   [`@googleworkspace/drive-picker-element`](https://www.npmjs.com/package/@googleworkspace/drive-picker-element#reference).

## Events

The `<drive-picker/>` element dispatches the following custom events:

| Event | Description |
| --- | --- |
| `picker-picked` | Fired when the user selects one or more items. |
| `picker-canceled` | Fired when the user cancels the selection by clicking the Cancel button or closing the dialog without a selection. |
| `picker-error` | Fired when an error occurs during initialization or file selection. |

For more information on events, see the
[`@googleworkspace/drive-picker-element`](https://www.npmjs.com/package/@googleworkspace/drive-picker-element#event-details)
documentation on NPM.

### Event details

For the `picker-picked` event, the event detail contains the full
Google Picker
[`ResponseObject`](https://developers.google.com/workspace/drive/picker/reference/picker.responseobject).

```
{
  "type": "picker-picked",
  "detail": {
    "action": "PICKED",
    "docs": [
      {
        "id": ID,
        "mimeType": "application/pdf",
        "name": NAME,
        "url": "https://drive.google.com/file/d/ID/view?usp=drive_web",
        "sizeBytes": 12345
      }
    ]
  }
}
```

The most commonly used properties in the response object are:

* [`action`](https://developers.google.com/workspace/drive/picker/reference/picker.responseobject.action): the action that
  triggered the callback (for example, `PICKED`).
* [`docs`](https://developers.google.com/workspace/drive/picker/reference/picker.responseobject.docs): an array of
  [`DocumentObject`](https://developers.google.com/workspace/drive/picker/reference/picker.documentobject)s selected by
  the user. Each object contains properties such as:
  + [`id`](https://developers.google.com/workspace/drive/picker/reference/picker.documentobject.id): the unique
    identifier of the selected item.
  + [`mimeType`](https://developers.google.com/workspace/drive/picker/reference/picker.documentobject.mimetype): the
    MIME type of the item.
  + [`name`](https://developers.google.com/workspace/drive/picker/reference/picker.documentobject.name): the name of the
    item.
  + [`url`](https://developers.google.com/workspace/drive/picker/reference/picker.documentobject.url): the URL to open
    the item in Drive.
  + [`sizeBytes`](https://developers.google.com/workspace/drive/picker/reference/picker.documentobject.sizebytes): the
    size of the picked item in bytes. The value isn't returned when an item
    is uploaded.

For the `picker-error` event, `event.detail` contains an error object or string
describing the failure (for example, `ERR_USER_NOT_AUTHENTICATED`).

## Examples

The following code samples show how to use the Google Picker web
component for common use cases. For each code sample, replace the following:

* PROMPT: a space-delimited, case-sensitive list of Google
  Account authorization prompts to present the user. For more information, see
  [`TokenClientConfig.prompt`](https://developers.google.com/identity/oauth2/web/reference/js-reference#TokenClientConfig).
* ORIGIN: the origin parameter for the picker. For example,
  `https://developers.google.com`. For more information, see
  [`PickerBuilder.setOrigin`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setorigin)
  method.
* APP\_ID: the Drive app ID. For more
  information, see the
  [`PickerBuilder.setAppId`](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setappid)
  method.
* CLIENT\_ID: the OAuth 2.0 client ID. For more information,
  see [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2).

### PDF files

Filters the view to show only PDF files using the `mime-types` attribute.

```
<drive-picker
  prompt="PROMPT"
  origin="ORIGIN"
  app-id="APP_ID"
  client-id="CLIENT_ID"
>
  <drive-picker-docs-view mime-types="application/pdf"></drive-picker-docs-view>
</drive-picker>
```

### Image and video files

Filters the view to show only image (JPEG, PNG) and video (MP4, QuickTime) files
using the `mime-types` attribute.

```
<drive-picker
  prompt="PROMPT"
  origin="ORIGIN"
  app-id="APP_ID"
  client-id="CLIENT_ID"
>
  <drive-picker-docs-view mime-types="image/jpeg,image/png,video/mp4,video/quicktime"></drive-picker-docs-view>
</drive-picker>
```

### Files owned by me

Filters the view to show only files owned by the current user using the `owned-by-me` attribute.

```
<drive-picker
  prompt="PROMPT"
  origin="ORIGIN"
  app-id="APP_ID"
  client-id="CLIENT_ID"
>
  <drive-picker-docs-view owned-by-me="true"></drive-picker-docs-view>
</drive-picker>
```

### Query for untitled files

Filters the view to show files matching the search query "Untitled" using the
`query` attribute.

```
<drive-picker
  prompt="PROMPT"
  origin="ORIGIN"
  app-id="APP_ID"
  client-id="CLIENT_ID"
>
  <drive-picker-docs-view query="Untitled"></drive-picker-docs-view>
</drive-picker>
```

### Starred files

Filters the view to show only starred files using the `starred` attribute.

```
<drive-picker
  prompt="PROMPT"
  origin="ORIGIN"
  app-id="APP_ID"
  client-id="CLIENT_ID"
>
  <drive-picker-docs-view starred="true"></drive-picker-docs-view>
</drive-picker>
```

## Related topics

* For in-depth information on attributes, events, and properties, see the full
  [`drive-picker-element`](https://github.com/googleworkspace/drive-picker-element)
  documentation on GitHub.
