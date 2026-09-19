# Add the "Save to Drive" button Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/savetodrive

Retrieved: 2026-09-19T16:30:10.779571+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The "Save to Drive" button allows users to save files to Drive from your
website. For example, suppose your web site lists several instruction
manuals (PDFs) that users can download. The "Save to Drive" button can be
placed alongside each manual allowing users to save manuals to their My Drive.

When the user clicks the button, the file is downloaded from the data source and
uploaded to Google Drive as data is received. Because
the download is made in the context of the user's browser, this process
allows the user to authenticate the action to save files using their
established browser session.

## Supported browsers

The "Save to Drive" button supports [these browsers.](https://support.google.com/a/answer/33864)

## Add the "Save to Drive" button to a page

To create an instance of the "Save to Drive" button, add the following script to
your web page:

```
<script src="https://apis.google.com/js/platform.js" async defer></script>
<div class="g-savetodrive"
   data-src="//example.com/path/to/myfile.pdf"
   data-filename="My Statement.pdf"
   data-sitename="My Company Name">
</div>
```

Where:

* `class` is a required parameter that must be set to `g-savetodrive` if you
  are using a standard HTML tag.
* `data-src` is a required parameter containing the URL of the file to be
  saved.

  + URLs can be absolute or relative.
  + The `data-src` URL can be served from the same domain, subdomain, and
    protocol as the domain where the button is hosted. You must use matching
    protocols between the page and the data source.
  + Data URIs and `file://` URLs are not supported.
  + Due to the browser's same origin policy, this URL must be served from
    the same domain as the page upon which it is placed, or be accessible
    using Cross Origin Resource Sharing (CORS). If the button and resource are
    on different domains, refer to
    [Handle buttons and resources on different domains](https://developers.google.com/workspace/drive/api/guides/savetodrive#domain).(#domain).
  + To serve the file when the same page is served by both http and https,
    specify the resource without a protocol such as
    `data-src="//example.com/files/file.pdf"`, which uses the appropriate
    protocol based on how the hosting page was accessed.
* `data-filename` is a required parameter containing the name used for the
  save file.
* `data-sitename` is a required parameter containing the name of the web site
  providing the file.

You may place these attributes on any HTML element. However, the most commonly
used elements are `div`, `span`, or `button`. Each of these elements displays
slightly differently while the page is loading because the browser renders the
element before the "Save to Drive" JavaScript re-renders the element.

This script must be loaded using the HTTPS protocol and can be included
from any point on the page without restriction. You can also load the script
asynchronously for improved performance.

**Note:** The button is rendered inline. The "Save to Drive" button can be wrapped in
another element to make the initial layout look similar to the final layout.**Note:** If the user navigates away from the page before the download is complete,
the data is discarded and no file is created in Google Drive.

## Use multiple buttons on a page

You can place multiple "Save to Drive" buttons on the same page. For example,
you might have a button at the top and at the bottom of a long page.

If the `data-src` and `data-filename` parameters are the same for multiple
buttons, saving from one button causes all similar buttons to display the same
progress information. If multiple different buttons are clicked, they save
sequentially.

### Handle buttons and resources on different domains

If your "Save to Drive" button is on a separate page from the data source, the
request to save the file must use
[Cross Origin Resource Sharing (CORS)](https://www.w3.org/TR/cors/) to access
the resource. *CORS* is a mechanism allowing a web application at one domain
to access resources from a server at a different domain.

For example, if a "Save to Drive" button is placed on a page at
`http://example.com/page.html`, and the data source is specified as
`data-src="https://otherserver.com/files/file.pdf"`, the button will fail to
access the PDF unless the browser can use CORS to access the resource.

The `data-src` URL can be served from another domain but the responses
from the HTTP server needs to support HTTP OPTION requests and
include the following special HTTP headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Range
Access-Control-Expose-Headers: Cache-Control, Content-Encoding, Content-Range
```

`Access-Control-Allow-Origin` can have the value `*` to allow CORS from any
domain or can alternatively specify the domains that have access to the
resource via CORS, like `http://example.com/page.html`. If you don't
have a server to host your content, consider using
[Google App Engine](https://developers.google.com/appengine/).

For more information, refer to your server documentation on how to enable CORS
from the origin serving your "Save to Drive" button. For more information on
enabling your server for CORS, refer to
[I want to add CORS support to my server](http://enable-cors.org/server.html).

## JavaScript API

The "Save to Drive" button JavaScript defines two button-rendering functions under the
`gapi.savetodrive` namespace. If you disable automatic rendering you must call one of these functions
by setting `parsetags` to `explicit`.

| Method | Description |
| --- | --- |
| `gapi.savetodrive.render( container, parameters )` | Renders the specified container as a "Save to Drive" button widget.  ---   container  The container to render as the "Save to Drive" button. Specify either the ID of the container (string) or the DOM element itself.  parameters  An object containing "Save to Drive" tag attributes as key=value pairs, without the `data-` prefixes. For example, `{"src": "//example.com/path/to/myfile.pdf", "filename": "My Statement.pdf", "sitename": "My Company Name"}`. |
| `gapi.savetodrive.go( opt_container )` | Renders all "Save to Drive" tags and classes in the specified container. This function should be used only if `parsetags` is set to `explicit`, which you might do for performance reasons.  ---   opt\_container  The container containing the "Save to Drive" button tags to render. Specify either the ID of the container (string) or the DOM element itself. If the `opt_container` parameter is omitted, all "Save to Drive" tags on the page are rendered. |

### Example "Save to Drive" JavaScript with explicit load

```
<!DOCTYPE html>
    <html>
      <head>
        <title>Save to Drive Demo: Explicit Load</title>
        <link rel="canonical" href="http://www.example.com">
        <script src="https://apis.google.com/js/platform.js" async defer>
          {parsetags: 'explicit'}
        </script>
      </head>
      <body>
        <div id="container">
          <div class="g-savetodrive"
             data-src="//example.com/path/to/myfile.pdf"
             data-filename="My Statement.pdf"
             data-sitename="My Company Name">
          <div>
        </div>
        <script type="text/javascript">
          gapi.savetodrive.go('container');
        </script>
      </body>
    </html>
```

### Example "Save to Drive" JavaScript with explicit render

```
    <!DOCTYPE html>
    <html>
      <head>
        <title>Save to Drive Demo: Explicit Render</title>
        <link rel="canonical" href="http://www.example.com">
        <script>
          window.___gcfg = {
            parsetags: 'explicit'
          };
        </script>
        <script src="https://apis.google.com/js/platform.js" async defer></script>
      </head>
      <body>
        <a href="javascript:void(0)" id="render-link">Render the Save to Drive button</a>
        <div id="savetodrive-div"></div>
        <script>
          function renderSaveToDrive() {
            gapi.savetodrive.render('savetodrive-div', {
              src: '//example.com/path/to/myfile.pdf',
              filename: 'My Statement.pdf',
              sitename: 'My Company Name'
            });
          }
          document.getElementById('render-link').addEventListener('click', renderSaveToDrive);
        </script>
      </body>
    </html>
```

## Localize the "Save to Drive" button

If your web page supports a specific language, set the `window.___gcfg.lang`
variable to that language. If not set, the user's Google Drive language is used.

For available language code values, see the
[list of supported language codes](https://developers.google.com/+/web/+1button#available-languages).

```
    <!DOCTYPE html>
    <html>
      <head>
        <title>Save to Drive Demo: Async Load with Language</title>
        <link rel="canonical" href="http://www.example.com">
      </head>
      <body>
        <div class="g-savetodrive"
             data-src="//example.com/path/to/myfile.pdf"
             data-filename="My Statement.pdf"
             data-sitename="My Company Name">
        </div>

        <script type="text/javascript">
          window.___gcfg = {
            lang: 'en-US'
          };
        </script>
        <script src = 'https://apis.google.com/js/platform.js' async defer></script>

      </body>
    </html>
```

## Troubleshooting

If you get an XHR error when downloading your `data-src` URL, verify that
the resource actually exists, and that you do not have a [CORS](https://developers.google.com/workspace/drive/api/guides/savetodrive#cors) issue.

If large files are truncated to 2MB, it is likely that your server is not
exposing Content-Range, likely a [CORS](https://developers.google.com/workspace/drive/api/guides/savetodrive#cors) issue.
