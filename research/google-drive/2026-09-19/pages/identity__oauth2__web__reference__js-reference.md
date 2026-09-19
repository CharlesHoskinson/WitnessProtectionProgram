# Google Account Authorization JavaScript API reference Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/oauth2/web/reference/js-reference

Retrieved: 2026-09-19T16:29:27.613525+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* The Google Account Authorization JavaScript API is used to obtain authorization codes or access tokens from Google.
* The `initCodeClient` method initializes a code client for the OAuth 2.0 Code UX flow.
* The `initTokenClient` method initializes a token client for the OAuth 2.0 Token UX flow.
* You can check if specific scopes have been granted using `hasGrantedAllScopes` and `hasGrantedAnyScope` methods.
* The `revoke` method allows you to revoke all scopes granted by the user for your application.

This reference describes the Google Account Authorization JavaScript API,
used to obtain authorization codes or access tokens from Google.

## Method: google.accounts.oauth2.initCodeClient

The `initCodeClient` method initializes and returns a code client, with the
configurations in the parameter.

```
google.accounts.oauth2.initCodeClient(config: CodeClientConfig)
```

### Data type: CodeClientConfig

The following table lists the properties of the `CodeClientConfig` data type.

| Properties | |
| --- | --- |
| `client_id` | **Required.** The client ID for your application. You can find this value in the [Google Cloud Console.](https://console.developers.google.com/) |
| `scope` | **Required.** A space-delimited list of scopes that identify the resources that your application could access on the user's behalf. These values inform the consent screen that Google displays to the user. |
| `include_granted_scopes` | Optional, defaults to `true`. Enables applications to use incremental authorization to request access to additional scopes in context. If you set this parameter's value to `false` and the authorization request is granted, then the new access token will only cover any scopes to which the `scope` requested in this `CodeClientConfig`. |
| `redirect_uri` | Required for redirect UX. Determines where the API server redirects the user after the user completes the authorization flow. The value must exactly match one of the authorized redirect URIs for the OAuth 2.0 client, which you [configured](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) in the Google Cloud Console and must conform to [Redirect URI validation rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation). When `ux_mode: 'popup'` is used this parameter is ignored and `redirect_uri` defaults to the origin of the page that calls `initCodeClient`. |
| `callback` | Required for popup UX. The JavaScript function that handles returned code response. The property will be ignored by the redirect UX. |
| `state` | Optional. Recommended for redirect UX. Specifies any string value that your application uses to maintain state between your authorization request and the authorization server's response. |
| `enable_granular_consent` | Deprecated, no effect if set. See [granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions) for details of consent behavior. |
| `enable_serial_consent` | Deprecated, no effect if set. See [granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions) for details of consent behavior. |
| `login_hint` | Optional. If your application knows which user should authorize the request, it can use this property to provide a login hint to Google. When successful, account selection is skipped. The email address or ID token [sub](https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload) field value for the target user. For more information, see the [`login_hint`](https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters) field in the OpenID Connect documentation. |
| `hd` | Optional. If your application knows the Workspace domain the user belongs to, use this to provide a hint to Google. When successful, user accounts are limited to or pre-selected for the provided domain. For more information, see the [`hd`](https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters) field in the OpenID Connect documentation. |
| `ux_mode` | Optional. Either `popup` or `redirect`, defaults to `popup`. Controls the UX mode used for the authorization code flow, either by using a popup dialog on the current page or through full page redirects. |
| `select_account` | Optional, defaults to **'false'**. Boolean value to prompt the user to select an account. |
| `error_callback` | Optional. The JavaScript function that handles some non-OAuth errors, such as the popup window is failed to open; or closed before an OAuth response is returned.    The `type` field of the input parameter gives the detailed reason.  * **popup\_failed\_to\_open** The popup window is failed to open. * **popup\_closed** The popup window is closed before an OAuth   response is returned. * **unknown** Placeholder for other errors. |

### Data type: CodeClient

The class has only one public method requestCode, which starts the OAuth 2.0
Code UX flow.

```
interface CodeClient {
  requestCode(): void;
}
```

### Data type: CodeResponse

A `CodeResponse` JavaScript object will be passed to your `callback` method in
the popup UX. In the redirect UX, the `CodeResponse` will be passed as URL
parameters.

The following table lists the properties of the `CodeResponse` data type.

| Properties | |
| --- | --- |
| `code` | The authorization code of a successful token response. |
| `scope` | A space-delimited list of scopes that are approved by the user. |
| `state` | The string value that your application uses to maintain state between your authorization request and the response. |
| `error` | A single ASCII error code. |
| `error_description` | Human-readable ASCII text providing additional information, used to assist the client developer in understanding the error that occurred. |
| `error_uri` | A URI identifying a human-readable web page with information about the error, used to provide the client developer with additional information about the error. |

## Method: google.accounts.oauth2.initTokenClient

The `initTokenClient` method initializes and returns a token client, with the
configurations in the parameter.

```
google.accounts.oauth2.initTokenClient(config: TokenClientConfig)
```

### Data type: TokenClientConfig

The following table lists the properties of the `TokenClientConfig` data type.

| Properties | |
| --- | --- |
| `client_id` | **Required.** The client ID for your application. You can find this value in the [Google Cloud Console](https://console.developers.google.com/). |
| `callback` | **Required.** The JavaScript function that handles returned token response. |
| `scope` | **Required.** A space-delimited list of scopes that identify the resources that your application could access on the user's behalf. These values inform the consent screen that Google displays to the user. |
| `include_granted_scopes` | Optional, defaults to `true`. Enables applications to use incremental authorization to request access to additional scopes in context. If you set this parameter's value to `false` and the authorization request is granted, then the new access token will only cover any scopes to which the `scope` requested in this `TokenClientConfig`. |
| `prompt` | Optional, defaults to **'select\_account'**. A space-delimited, case-sensitive list of prompts to present the user. Possible values are:  * **empty string** The user will be prompted only the first time your app requests access. Cannot be specified with other values. * **'none'** Don't display any authentication or consent screens. Must not be specified with other values. * **'consent'** Prompt the user for consent. * **'select\_account'** Prompt the user to select an account. |
| `enable_granular_consent` | Deprecated, no effect if set. See [granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions) for details of consent behavior. |
| `enable_serial_consent` | Deprecated, no effect if set. See [granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions) for details of consent behavior. |
| `login_hint` | Optional. If your application knows which user should authorize the request, it can use this property to provide a login hint to Google. When successful, account selection is skipped. The email address or ID token [sub](https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload) field value for the target user. For more information, see the [`login_hint`](https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters) field in the OpenID Connect documentation. |
| `hd` | Optional. If your application knows the Workspace domain the user belongs to, use this to provide a hint to Google. When successful, user accounts are limited to or pre-selected for the provided domain. For more information, see the [`hd`](https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters) field in the OpenID Connect documentation. |
| `state` | Optional. Not recommended. Specifies any string value that your application uses to maintain state between your authorization request and the authorization server's response. |
| `error_callback` | Optional. The JavaScript function that handles some non-OAuth errors, such as the popup window is failed to open; or closed before an OAuth response is returned.    The `type` field of the input parameter gives the detailed reason.  * **popup\_failed\_to\_open** The popup window is failed to open. * **popup\_closed** The popup window is closed before an OAuth   response is returned. * **unknown** Placeholder for other errors. |

### Data type: TokenClient

The class has only one public method `requestAccessToken`, which starts the
OAuth 2.0 Token UX flow.

```
interface TokenClient {
  requestAccessToken(overrideConfig?: OverridableTokenClientConfig): void;
}
```

| Arguments | | |
| --- | --- | --- |
| `overrideConfig` | OverridableTokenClientConfig | Optional. The configurations to be overridden in this method. |

### Data type: OverridableTokenClientConfig

The following table lists the properties of the `OverridableTokenClientConfig`
data type.

| Properties | |
| --- | --- |
| `scope` | Optional. A space-delimited list of scopes that identify the resources that your application could access on the user's behalf. These values inform the consent screen that Google displays to the user. |
| `include_granted_scopes` | Optional, defaults to `true`. Enables applications to use incremental authorization to request access to additional scopes in context. If you set this parameter's value to `false` and the authorization request is granted, then the new access token will only cover any scopes to which the `scope` requested in this `OverridableTokenClientConfig`. |
| `prompt` | Optional. A space-delimited, case-sensitive list of prompts to present the user. |
| `enable_granular_consent` | Deprecated, no effect if set. See [granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions) for details of consent behavior. |
| `enable_serial_consent` | Deprecated, no effect if set. See [granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions) for details of consent behavior. |
| `login_hint` | Optional. If your application knows which user should authorize the request, it can use this property to provide a login hint to Google. When successful, account selection is skipped. The email address or ID token [sub](https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload) field value for the target user. For more information, see the [`login_hint`](https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters) field in the OpenID Connect documentation. |
| `state` | Optional. Not recommended. Specifies any string value that your application uses to maintain state between your authorization request and the authorization server's response. |

### Data type: TokenResponse

A `TokenResponse` JavaScript object will be passed to your callback method in
the popup UX.

The following table lists the properties of the `TokenResponse` data type.

| Properties | |
| --- | --- |
| `access_token` | The access token of a successful token response. |
| `expires_in` | The lifetime in seconds of the access token. |
| `hd` | The hosted domain the signed-in user belongs to. |
| `prompt` | The prompt value that was used from the possible list of values specified by TokenClientConfig or OverridableTokenClientConfig. |
| `token_type` | The type of the token issued. |
| `scope` | A space-delimited list of scopes that are approved by the user. |
| `state` | The string value that your application uses to maintain state between your authorization request and the response. |
| `error` | A single ASCII error code. |
| `error_description` | Human-readable ASCII text providing additional information, used to assist the client developer in understanding the error that occurred.. |
| `error_uri` | A URI identifying a human-readable web page with information about the error, used to provide the client developer with additional information about the error. |

## Method: google.accounts.oauth2.hasGrantedAllScopes

Checks if the user granted all the specified scope or scopes.

```
google.accounts.oauth2.hasGrantedAllScopes(
                                            tokenResponse: TokenResponse,
                                            firstScope: string, ...restScopes: string[]
                                          ): boolean;
```

| Arguments | | |
| --- | --- | --- |
| `tokenResponse` | `TokenResponse` | **Required.** A [`TokenResponse`](https://developers.google.com/identity/oauth2/web/reference/js-reference#TokenResponse) object. |
| `firstScope` | string | **Required.** The scope to check. |
| `restScopes` | string[] | Optional. Other scopes to check. |

| Returns | |
| --- | --- |
| boolean | True if all the scopes are granted. |

## Method: google.accounts.oauth2.hasGrantedAnyScope

Checks if the user granted any of the specified scope or scopes.

```
google.accounts.oauth2.hasGrantedAnyScope(
                                           tokenResponse: TokenResponse,
                                           firstScope: string, ...restScopes: string[]
                                         ): boolean;
```

| Arguments | | |
| --- | --- | --- |
| `tokenResponse` | `TokenResponse` | **Required.** A [`TokenResponse`](https://developers.google.com/identity/oauth2/web/reference/js-reference#TokenResponse) object. |
| `firstScope` | string | **Required.** The scope to check. |
| `restScopes` | string[] | Optional. Other scopes to check. |

| Returns | |
| --- | --- |
| boolean | True if any of the scopes are granted. |

## Method: google.accounts.oauth2.revoke

The `revoke` method revokes all of the scopes that the user granted to the app.
A valid access token is required to revoke the permission.

```
google.accounts.oauth2.revoke(accessToken: string, done: () => void): void;
```

| Arguments | | |
| --- | --- | --- |
| `accessToken` | string | **Required.** A valid access token. |
| `callback` | function | Optional. [RevocationResponse](https://developers.google.com/identity/oauth2/web/reference/js-reference#RevocationResponse) handler. |

### Data type: RevocationResponse

A `RevocationResponse` JavaScript object will be passed to your callback method.

The following table lists the properties of the `RevocationResponse` data type.

| Properties | |
| --- | --- |
| `successful` | Boolean. `true` on succeeded, `false` on failure. |
| `error` | String. Undefined on success. A single ASCII error code. This includes but not limited to the [standard OAuth 2.0 error codes](https://datatracker.ietf.org/doc/html/rfc6749#section-5.2). Common errors for `revoke` method:  * `invalid_token` - Token is already expired or revoked before `revoke` method is called. In most cases, you can regard the grant associated with   the `accessToken` is revoked. * `invalid_request` - Token is not revocable. You should make sure   `accessToken` is a valid Google OAuth 2.0 credential. |
| `error_description` | String. Undefined on success. Human-readable ASCII text provides additional information on `error` property. Developers can use this to better understand the error that occurred. The `error_description` string is in English only. For the common errors listed in `error` the corresponding `error_description`:  * `invalid_token` - Token expired or revoked. * `invalid_request` - Token is not revocable. |
