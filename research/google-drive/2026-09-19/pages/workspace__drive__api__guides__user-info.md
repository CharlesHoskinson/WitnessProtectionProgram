# Return user info Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/user-info

Retrieved: 2026-09-19T16:30:01.077443+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

Google Drive provides two options to gather information about
Drive users:

* Using the [`about`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about) resource, you can retrieve
  information about the user, the user's Drive settings, and
  their system capabilities.
* Using the [`apps`](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps) resource, you can retrieve a
  list of the user's installed apps, with information about each app's
  supported MIME types, file extensions, and other details.

This guide explains how you can retrieve user info in Drive.

## Get details about a user

To return information on a Drive user as an instance of
[`about`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about), use the
[`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get) method. The returned values are measured
in bytes.

You *must* set the `fields` [system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions) on
the `get` method to specify the fields to return in the response. In most
Drive methods this action is only required to return non-default
fields but it's mandatory for the `about` resource. If you omit the parameter,
the method returns an error. For more information, see [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

**Note:** If you're using the previous Drive API v2 version, setting the
`fields` parameter in the `get` method isn't required. Learn how to [migrate to
Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

The following code sample shows how to provide multiple `fields` as a query parameter in the request. The response returns the field values for the request.

**Request**

```
GET https://www.googleapis.com/drive/v3/about/?fields=kind,user,storageQuota
```

**Response**

```
{
  "kind": "drive#about",
  "user": {
    "kind": "drive#user",
    "displayName": "DISPLAY_NAME",
    "photoLink": "PHOTO_LINK",
    "me": true,
    "permissionId": "PERMISSION_ID",
    "emailAddress": "EMAIL_ADDRESS"
  },
  "storageQuota": {
    "usage": "10845031958",
    "usageInDrive": "2222008387",
    "usageInDriveTrash": "91566"
  }
}
```

The response includes the following values:

* `DISPLAY_NAME`: the user's name in plain text.
* `PHOTO_LINK`: the URL of the user's profile photo.
* `PERMISSION_ID`: the user's ID within the `Permission` resources.
* `EMAIL_ADDRESS`: the user's email address

## List user apps

Google Drive apps are listed in the
[Google Workspace Marketplace](https://workspace.google.com/marketplace) and
are used to make Drive more convenient such as the Google Docs
app or an add-on used within Docs to
sign documents. For more information, see [Use Google Drive
apps](https://support.google.com/drive/answer/2500820).

To return a list of all the user's installed apps as an instance of [`apps`](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps), use the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/list) method
without any parameters.

If you want to specify the fields to return in the response, you can set the
`fields` [system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions). If
you don't specify the `fields` parameter, the server returns a default set of
fields. For more information, see [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

**Note:** If you're using the previous Drive API v2 version, the response
body also includes the `etag` field. Learn how to [migrate to
Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

The following code sample shows how to return a list of all the user's installed apps in the request. The response returns the field values for the request.

**Request**

```
GET https://www.googleapis.com/drive/v3/apps
```

**Response**

```
{
  "kind": "drive#appList",
  "selfLink": "https://www.googleapis.com/drive/v3/apps",
  "items": [
    {
      "kind": "drive#app",
      "id": "ID",
      "name": "Google Sheets",
      "supportsCreate": true,
      "supportsImport": true,
      "supportsMultiOpen": false,
      "supportsOfflineCreate": true,
      "productUrl": "https://chrome.google.com/webstore/detail/felcaaldnbdncclmgdcncolpebgiejap",
      "productId": "PRODUCT_ID"
    }
  ],
  "defaultAppIds": [
    "ID"
  ]
}
```

The response includes the following values:

* `ID`: the app ID.
* `PRODUCT_ID`: the product listing ID for this app.

### List user apps with query parameters

To find a specific app, use one or more of the optional query parameters:

* `appFilterExtensions`: Filter the search results using a comma-separated
  list of file extensions. Apps within the app query scope that can open the
  listed file extensions are included in the response. If `appFilterMimeTypes`
  are also provided, a union of the two resulting app lists is returned.
  Examples of extensions include `docx` for Microsoft Word and `pptx` for
  Microsoft PowerPoint. For more examples of file extensions, see [Export MIME
  types for Google Workspace documents](https://developers.google.com/workspace/drive/api/guides/ref-export-formats).

  The following code sample shows how to provide multiple file extensions as a
  query parameter: `GET
  https://www.googleapis.com/drive/v3/apps?appFilterExtensions=docx,pptx`.
* `appFilterMimeTypes`: Filter the search results using a comma-separated list
  of MIME types. Apps within the app query scope that can open the listed MIME
  types are included in the response. If `appFilterExtensions` are also
  provided, a union of the two resulting app lists is returned. Examples of
  MIME types include `application/vnd.google-apps.form` for Google Forms and
  `application/vnd.google-apps.site` for Google Sites. For more examples of
  MIME types, see [Google Workspace and Google Drive supported MIME
  types](https://developers.google.com/workspace/drive/api/guides/mime-types).

  The following code sample shows how to provide multiple MIME types as a
  query parameter: `GET
  https://www.googleapis.com/drive/v3/apps?appFilterMimeTypes=application/vnd.google-apps.form,application/vnd.google-apps.site`.
* `languageCode`: Filter the search results using a language or locale code,
  as defined by BCP 47, with some extensions from [Unicode's LDML
  format](https://www.unicode.org/reports/tr35/). Examples of language codes
  include `en-us` for English (United States) and `fr-ca` for French (Canada).

  The following code sample shows how to provide multiple language codes as a
  query parameter: `GET
  https://www.googleapis.com/drive/v3/apps?languageCode=en-us,fr-ca`.

## Get user app by ID

To download the detailed app info as an instance of
[`apps`](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps), use the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/get)
method with the app ID.

The following code sample shows how to provide an `appId` as a query parameter in the request. The response returns the field values for the request.

**Request**

```
GET https://www.googleapis.com/drive/v3/apps/APP_ID
```

**Response**

```
{
  "kind": "drive#app",
  "id": "ID",
  "name": "Google Sheets",
  "supportsCreate": true,
  "supportsImport": true,
  "supportsMultiOpen": false,
  "supportsOfflineCreate": true,
  "productUrl": "https://chrome.google.com/webstore/detail/felcaaldnbdncclmgdcncolpebgiejap",
  "productId": "PRODUCT_ID"
}
```

The response includes the following values:

* `ID`: the app ID.
* `PRODUCT_ID`: the product listing ID for this app.

## Related topics

Here are a few next steps you might try:

* To create a file in Drive, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file).
* To upload file data when you create or update a file, see [Upload file
  data](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
* To download and export files, see [Download and export
  files](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
