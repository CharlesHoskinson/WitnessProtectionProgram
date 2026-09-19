# Verify the Google ID token on your server side Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

Retrieved: 2026-09-19T16:29:18.645997+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Google ID tokens are submitted to your login endpoint via an HTTP `POST` request with the parameter name `credential`.
* To validate and consume the ID token, you should first verify the Cross-Site Request Forgery (CSRF) token using the double-submit-cookie pattern.
* The ID token is returned in the `credential` field, not the `g_csrf_token` field.
* After confirming the token's validity, you can use the Google ID token information to determine the account status of the user on your site (unregistered, existing, or returning federated user).
* Only use the Google ID token's `sub` field as the unique identifier for the user and associate it with the user in your account management system.

When using Google Identity Services or OAuth 2.0 authorization code flow, Google
returns the ID token using POST method to the redirect endpoint. Alternatively,
the OIDC implicit flow uses a GET request. Consequently, your application is
responsible to securely transmit these received credentials to your server.

GET

This is the implicit flow, the ID token is returned within the URL
fragment, which the client-side JavaScript must parse. Your application
is responsible for implementing its own validation mechanisms to ensure
the request's authenticity and prevent attacks like CSRF.

```
    HTTP/1.1 302 Found
    Location: https://<REDIRECT_URI>#access_token=<ACCESS_TOKEN>&token_type=bearer&expires_in=<TIME_IN_SECONDS>&scope=<SCOPE>&state=<STATE_STRING>
```

POST

The ID token is sent back as the `credential` field. When
preparing to send the ID Token to the server the GIS library automatically
adds the `g_csrf_token` to the header cookie and the request
body. This is an example POST request:

```
POST /auth/token-verification HTTP/1.1
Host: example.com
Content-Type: application/json;charset=UTF-8
Cookie: g_csrf_token=<CSRF_TOKEN>
Origin: https://example.com
Content-Length: <LENGTH_OF_JSON_BODY>
    {
      "credential": "<ID_TOKEN>",
      "g_csrf_token": "<CSRF_TOKEN>",
      "client_id": "<CLIENT_ID>"
    }
```

1. Validating the `g_csrf_token` to prevent Cross-Site Request Forgery (CSRF)
   attacks:

   * Extract the CSRF token value from the `g_csrf_token` cookie.
   * Extract the CSRF token value from the request body. The GIS library
     includes this token in the POST request body as a parameter, also named
     `g_csrf_token`.
   * Compare the two token values
     + If both the values are present and match completely, the request
       is considered legitimate and originated from your domain.
     + If the values are not present or does not match, the request has to
       be rejected by the server.
       This check ensures that the request was initiated from JavaScript running on
       your own domain, as only your domain can access the `g_csrf_token` cookie.
2. Verify the ID token.

   To verify that the token is valid, ensure that the following
   criteria are satisfied:

   * The ID token is properly signed by Google. Use Google's public keys
     (available in
     [JWK](https://www.googleapis.com/oauth2/v3/certs) or
     [PEM](https://www.googleapis.com/oauth2/v1/certs) format)
     to verify the token's signature. These keys are regularly rotated; examine
     the `Cache-Control` header in the response to determine when
     you should retrieve them again.
   * The value of `aud` in the ID token is equal to one of your app's
     client IDs. This check is necessary to prevent ID tokens issued to a malicious
     app being used to access data about the same user on your app's backend server.
   * The value of `iss` in the ID token is equal to
     `accounts.google.com` or `https://accounts.google.com`.
   * The expiry time (`exp`) of the ID token has not passed.
   * If you need to validate that the ID token represents a Google Workspace or Cloud
     organization account, you can check the `hd` claim, which indicates the hosted
     domain of the user. This must be used when restricting access to a resource to only members of
     certain domains. The absence of this claim indicates that the account does not belong to a
     Google hosted domain.

   Using the `email`, `email_verified` and `hd` fields, you can determine if
   Google hosts and is authoritative for an email address. In the cases where Google is authoritative,
   the user is known to be the legitimate account owner, and you may skip password or other
   challenge methods.

   Cases where Google is authoritative:

   * `email` has a `@gmail.com` suffix, this is a Gmail account.
   * `email_verified` is true and `hd` is set, this is a Google Workspace account.

   Users may register for Google Accounts without using Gmail or Google Workspace. When
   `email` does not contain a `@gmail.com` suffix and `hd` is absent, Google is not
   authoritative and password or other challenge methods are recommended to verify
   the user. `email_verified` can also be true as Google initially verified the
   user when the Google account was created, however ownership of the third party
   email account may have since changed.

   Rather than writing your own code to perform these verification steps, we strongly
   recommend using a Google API client library for your platform, or a general-purpose
   JWT library. For development and debugging, you can call our `tokeninfo`
   validation endpoint.

   ### Using a Google API Client Library

   Using one of the [Google API Client Libraries](https://developers.google.com/api-client-library) (e.g.
   [Java](https://github.com/googleapis/google-auth-library-java),
   [Node.js](https://github.com/google/google-api-nodejs-client),
   [PHP](https://developers.google.com/api-client-library/php/start/get_started),
   [Python](https://google-auth.readthedocs.io/))
   is the recommended way to validate Google ID tokens in a production environment.

   Java

   To validate an ID token in Java, use the [GoogleIdTokenVerifier](https://github.com/googleapis/google-api-java-client/blob/master/google-api-client/src/main/java/com/google/api/client/googleapis/auth/oauth2/GoogleIdTokenVerifier.java) object. For example:

   ```
   import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
   import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload;
   import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;

   ...

   GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(transport, jsonFactory)
       // Specify the WEB_CLIENT_ID of the app that accesses the backend:
       .setAudience(Collections.singletonList(WEB_CLIENT_ID))
       // Or, if multiple clients access the backend:
       //.setAudience(Arrays.asList(WEB_CLIENT_ID_1, WEB_CLIENT_ID_2, WEB_CLIENT_ID_3))
       .build();

   // (Receive idTokenString by HTTPS POST)

   GoogleIdToken idToken = verifier.verify(idTokenString);
   if (idToken != null) {
     Payload payload = idToken.getPayload();

     // Print user identifier. This ID is unique to each Google Account, making it suitable for
     // use as a primary key during account lookup. Email is not a good choice because it can be
     // changed by the user.
     String userId = payload.getSubject();
     System.out.println("User ID: " + userId);

     // Get profile information from payload
     String email = payload.getEmail();
     boolean emailVerified = Boolean.valueOf(payload.getEmailVerified());
     String name = (String) payload.get("name");
     String pictureUrl = (String) payload.get("picture");
     String locale = (String) payload.get("locale");
     String familyName = (String) payload.get("family_name");
     String givenName = (String) payload.get("given_name");

     // Use or store profile information
     // ...

   } else {
     System.out.println("Invalid ID token.");
   }
   ```

   The `GoogleIdTokenVerifier.verify()` method verifies the JWT
   signature, the `aud` claim, the `iss` claim, and the
   `exp` claim.

   If you need to validate that the ID token represents a Google Workspace or Cloud
   organization account, you can verify the `hd` claim by checking the domain name
   returned by the `Payload.getHostedDomain()` method. The domain of the
   `email` claim is insufficient to ensure that the account is managed by a domain
   or organization.

   Node.js

   To validate an ID token in Node.js, use the [Google Auth Library for Node.js](https://github.com/google/google-auth-library-nodejs).
   Install the library:

   ```
   npm install google-auth-library --save
   ```

   Then, call the `verifyIdToken()` function. For example:

   ```
   const {OAuth2Client} = require('google-auth-library');
   const client = new OAuth2Client();
   async function verify() {
     const ticket = await client.verifyIdToken({
         idToken: token,
         audience: WEB_CLIENT_ID,  // Specify the WEB_CLIENT_ID of the app that accesses the backend
         // Or, if multiple clients access the backend:
         //[WEB_CLIENT_ID_1, WEB_CLIENT_ID_2, WEB_CLIENT_ID_3]
     });
     const payload = ticket.getPayload();
     // This ID is unique to each Google Account, making it suitable for use as a primary key
     // during account lookup. Email is not a good choice because it can be changed by the user.
     const userid = payload['sub'];
     // If the request specified a Google Workspace domain:
     // const domain = payload['hd'];
   }
   verify().catch(console.error);
   ```

   The `verifyIdToken` function verifies
   the JWT signature, the `aud` claim, the `exp` claim,
   and the `iss` claim.

   If you need to validate that the ID token represents a Google Workspace or Cloud
   organization account, you can check the `hd` claim, which indicates the hosted
   domain of the user. This must be used when restricting access to a resource to only members
   of certain domains. The absence of this claim indicates that the account does not belong to
   a Google hosted domain.

   PHP

   To validate an ID token in PHP, use the [Google API Client Library for PHP](https://github.com/google/google-api-php-client/).
   Install the library (for example, using Composer):

   ```
   composer require google/apiclient
   ```

   Then, call the `verifyIdToken()` function. For example:

   ```
   require_once 'vendor/autoload.php';

   // Get $id_token via HTTPS POST.

   $client = new Google_Client(['client_id' => $WEB_CLIENT_ID]);  // Specify the WEB_CLIENT_ID of the app that accesses the backend
   $payload = $client->verifyIdToken($id_token);
   if ($payload) {
     // This ID is unique to each Google Account, making it suitable for use as a primary key
     // during account lookup. Email is not a good choice because it can be changed by the user.
     $userid = $payload['sub'];
     // If the request specified a Google Workspace domain
     //$domain = $payload['hd'];
   } else {
     // Invalid ID token
   }
   ```

   The `verifyIdToken` function verifies
   the JWT signature, the `aud` claim, the `exp` claim,
   and the `iss` claim.

   If you need to validate that the ID token represents a Google Workspace or Cloud
   organization account, you can check the `hd` claim, which indicates the hosted
   domain of the user. This must be used when restricting access to a resource to only members
   of certain domains. The absence of this claim indicates that the account does not belong to
   a Google hosted domain.

   Python

   To validate an ID token in Python, use the
   [verify\_oauth2\_token](https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html#google.oauth2.id_token.verify_oauth2_token)
   function. For example:

   ```
   from google.oauth2 import id_token
   from google.auth.transport import requests

   # (Receive token by HTTPS POST)
   # ...

   try:
       # Specify the WEB_CLIENT_ID of the app that accesses the backend:
       idinfo = id_token.verify_oauth2_token(token, requests.Request(), WEB_CLIENT_ID)

       # Or, if multiple clients access the backend server:
       # idinfo = id_token.verify_oauth2_token(token, requests.Request())
       # if idinfo['aud'] not in [WEB_CLIENT_ID_1, WEB_CLIENT_ID_2, WEB_CLIENT_ID_3]:
       #     raise ValueError('Could not verify audience.')

       # If the request specified a Google Workspace domain
       # if idinfo['hd'] != DOMAIN_NAME:
       #     raise ValueError('Wrong domain name.')

       # ID token is valid. Get the user's Google Account ID from the decoded token.
       # This ID is unique to each Google Account, making it suitable for use as a primary key
       # during account lookup. Email is not a good choice because it can be changed by the user.
       userid = idinfo['sub']
   except ValueError:
       # Invalid token
       pass
   ```

   The `verify_oauth2_token` function verifies the JWT
   signature, the `aud` claim, and the `exp` claim.
   You must also verify the `hd`
   claim (if applicable) by examining the object that
   `verify_oauth2_token` returns. If multiple clients access the
   backend server, also manually verify the `aud` claim.

   **Key Point:** The ID token is returned in the `credential` field, instead of
   the `g_csrf_token` field.
3. Once the token's validity is confirmed, you can use the information in
   the [Google ID token](https://developers.google.com/identity/gsi/web/reference/js-reference#credential) to correlate the account status of your site:

   * **An unregistered user:** You can show a sign-up user interface
     (UI) that allows the user to provide additional profile information, if
     required. It also allows the user to silently create the new account and
     a logged-in user session.
   * **An existing account that already exists in your site:** You can show a
     web page that allows the end user to input their password and link the
     legacy account with their Google credentials. This confirms that the
     user has access to the existing account.
   * **A returning federated user:** You can silently sign the user in.

**Key Point:** Only use [Google ID token](https://developers.google.com/identity/gsi/web/reference/js-reference#credential) **`sub`** field as identifier for the
user as it is unique among all Google Accounts and never reused. You should
store the **`sub`** field and associate it with the user in your account
management system. While you can use the email address from the ID token to
check if the user has a existing account, **don't** use email address as an
identifier because a Google Account can have multiple email addresses at
different points in time.
