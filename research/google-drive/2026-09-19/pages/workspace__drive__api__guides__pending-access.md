# Manage pending access proposals Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/pending-access

Retrieved: 2026-09-19T16:29:49.115155+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

An *access proposal* is a proposal from a requester to an approver to grant a
recipient access to a Google Drive item.

An approver can review and act on all unresolved access proposals across
Drive files. This means you can speed up the approval process by
programmatically querying for access proposals and then resolving them. It also
allows proposals to be viewed in aggregate by an approver.

The Google Drive API provides the
[`accessproposals`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals) resource so you can view
and resolve pending access proposals. The methods of the `accessproposals`
resource work on files, folders, the files within a shared drive but *not* on
the shared drive.

The following terms are specific to access proposals:

* **Requester**: The user initiating the access proposal to a
  Drive item.
* **Recipient**: The user receiving the additional permissions on a file if
  the access proposal is granted. Many times the recipient is the same as the
  requester but not always.
* **Approver**: The user responsible for approving (or denying) the access
  proposal. This is typically because they're an owner on the document or they
  have the ability to share the document.

**Important:** Access proposals can't be created using the Drive API.
Users must request access using the Drive UI. For more
information, see [Get permission to open a file or
folder](https://support.google.com/docs/answer/6211862).

## Use the fields parameter

If you want to specify the fields to return in the response, you can set the
`fields` [system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions)
with any method of the `accessproposals` resource. If you omit the `fields`
parameter, the server returns a default set of fields specific to the method. To
return different fields, see [Return specific
fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

## Get a pending access proposal

To get an access proposal, use the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/get) method on the [`accessproposals`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals) resource with the `fileId` and `proposalId`
path parameters. If you don't know the proposal ID, you can [list pending access
proposals](https://developers.google.com/workspace/drive/api/guides/pending-access#list-access-proposals) using the `list` method.

## List pending access proposals

To list all pending access proposals on a Drive item, call the
[`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list) method on the
[`accessproposals`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals) resource and include the
`fileId` path parameter.

Only approvers on a file can list the pending proposals on a file. An approver
is a user with the `can_approve_access_proposals` capability on the file. If the
requester isn't an approver, an empty list is returned. For more information
about `capabilities`, see [Understand file
capabilities](https://developers.google.com/workspace/drive/api/guides/manage-sharing#capabilities).

The [response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list#response-body)
consists of an `accessproposals` object representing a list of unresolved access
proposals on the file.

The `accessproposals` object includes info about each proposal such as the
requester, the recipient, and the message that the requester added. It also
includes a [`RoleAndView`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals#roleandview)
object that groups the requester's proposed `role` with a `view`. Since `role`
is a repeated field, multiples could exist for each proposal. For example, a
proposal might have an `RoleAndView` object of `role=reader` and
`view=published`, plus an additional `RoleAndView` object with only the
`role=writer` value. For more information, see
[Views](https://developers.google.com/workspace/drive/api/guides/ref-roles#views).

Pass the following query parameters to customize pagination of, or filter,
access proposals:

* `pageToken`: A page token, received from a previous list call. Provide this
  token to retrieve the subsequent page.
* `pageSize`: The maximum number of access proposals to return per page.

## Resolve pending access proposals

To resolve all pending access proposals on a Drive
item, call the [`resolve`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve) method on
the [`accessproposals`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals) resource and include
the `fileId` and `proposalId` path parameters.

The `resolve` method includes an `action` query parameter that denotes the
action to take on the proposal. The
[`Action`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/resolve#action) object tracks the
state change of the proposal so we know if it's being accepted or denied.

The `resolve` method also includes the optional query parameters of `role` and
`view`. The only supported roles are `writer`, `commenter`, and `reader`. If the
role isn't specified, it defaults to `reader`. For more information, see [Roles
and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles). An additional optional query
parameter of `sendNotification` lets you send an email notification to the
requester when the proposal is accepted or denied.

Just as with the `list` method, users resolving the proposal must have the
`can_approve_access_proposals` capability on the file. For more information
about `capabilities`, see [Understand file
capabilities](https://developers.google.com/workspace/drive/api/guides/manage-sharing#capabilities).

Proposals are resolved using the same patterns listed under [Scenarios for
sharing Drive
resources](https://developers.google.com/workspace/drive/api/guides/manage-sharing#sharing-drive-resources). If there are
multiple proposals for the same user, but with different roles, the following
applies:

* If one proposal is accepted and one is denied, the accepted role applies to
  the Drive item.
* If both proposals are accepted at the same time, the proposal with the
  higher permission (for example, `role=writer` versus `role=reader`) is
  applied. The other access proposal is removed from the item.

After sending a proposal to the `resolve` method, the sharing action is
complete. The resolved access proposal is no longer returned through the `list`
method. Once the proposal is accepted, the user must use the [`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource to update permissions on a file or
folder. For more information, see [Update
permissions](https://developers.google.com/workspace/drive/api/guides/manage-sharing#update-permissions).

## Related topics

* [Share files, folders, and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
