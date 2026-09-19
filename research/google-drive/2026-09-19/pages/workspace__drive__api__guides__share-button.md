# Display the sharing dialog Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/share-button

Retrieved: 2026-09-19T16:30:11.710857+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

To allow users to share Drive files directly from your app, you can use the
Google Drive sharing dialog. This modal dialog is invoked
from your app to allow sharing of items on Drive. Figure 1 shows the Google Docs
Share button and the resulting sharing dialog.

![Share button and dialog](/static/drive/images/share-dialog.png)

**Figure 1.** Share button and dialog.

To enable the Drive sharing dialog, add the dialog script and a launch button
or other launching mechanism to your UI.

### Add the dialog script

To create an instance of the sharing dialog, add the following script to your
launching page:

```
<head>
...
<script type="text/javascript" src="https://apis.google.com/js/api.js"></script>
<script type="text/javascript">
    init = function() {
        s = new gapi.drive.share.ShareClient();
        s.setOAuthToken('<OAUTH_TOKEN>');
        s.setItemIds(['<FILE_ID>']);
    }
    window.onload = function() {
        gapi.load('drive-share', init);
    }
</script>
</head>
```

Where:

* `<OAUTH_TOKEN>` should be replaced with the
  [authorized user's OAuth2 access token](https://developers.google.com/workspace/drive/api/guides/about-auth).
* `<FILE_ID>` should be replaced with the id of the file to share.

### Add a launch button

In your UI, add a line of code similar to the following:

```
<button onclick="s.showSettingsDialog()">Share</button>
```

This code calls the `showSettingsDialog()` function when the Share button is
clicked.

**Note:** For the dialog to work as expected, third-party party cookies must be
enabled and the user must be currently signed in to the Google account matching
the identity of the oauth token.
