# Configure Google for the WPP beta

Status: planned Google Drive beta; researched on 2026-09-19. No application integration is implemented or tested yet.

Use this guide as the publisher setting up a Google Cloud project. You need administrative access to that project and control of the application domains. Consumers will use the connection button. This session has not registered a Google application.

## Publisher setup checklist

These are publisher tasks, never consumer setup steps.

- [ ] Create/select WPP's Google Cloud project, assign owners, and separate development configuration from release configuration.
- [ ] Enable Drive API and Google Picker API.
- [ ] Configure Google Auth Platform branding, support contact, audience and data access with only the required scopes.
- [ ] Publish the application home page, privacy policy and any required terms; verify configured domain ownership. Explain data access, retention/deletion, token handling and user control accurately.
- [ ] Create OAuth clients of the correct types for supported platforms, with appropriate exact redirects/origins. A public desktop client is not confidential even if downloaded configuration contains a `client_secret` field.
- [ ] Decide between OAuth **Testing** and a product beta with OAuth **In production** status; these are distinct concepts.
- [ ] In Testing, maintain the tester list and support seven-day reconnects. Google limits Testing to up to 100 listed users; Drive authorization and refresh tokens expire after seven days. The identity-only exception does not cover `drive.file`.
- [ ] For broader distribution, complete applicable brand/policy verification and publish approved branding. A non-sensitive scope reduces review burden; it does not waive all branding/domain/policy requirements or guarantee approval.
- [ ] Verify project quotas and monitoring against current documentation. The quota model changed for new projects from May 1, 2026. Do not assume old request limits or finalized future billing terms.

Sources: [project creation](https://developers.google.com/workspace/guides/create-project), [OAuth consent](https://developers.google.com/workspace/guides/configure-oauth-consent), [credentials](https://developers.google.com/workspace/guides/create-credentials), [brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), [Testing/audience](https://support.google.com/cloud/answer/15549945?hl=en), [limits](https://developers.google.com/workspace/drive/api/guides/limits), [user data policy](https://developers.google.com/terms/api-services-user-data-policy).


After configuration, implement and validate the [adapter requirements](../reference/google-drive.md).
