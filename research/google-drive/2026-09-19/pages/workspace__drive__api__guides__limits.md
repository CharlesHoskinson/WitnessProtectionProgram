# Usage limits Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/limits

Retrieved: 2026-09-19T16:31:48.571625+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

As of **May 1, 2026**, the usage limits for this API were updated. Google Cloud projects that made
any use of this API between November 2025 and April 2026 will continue with their previously set usage
quotas. Cloud projects created on or after May 1, 2026 are subject to the new API quotas.

For more information, including timelines, see [Google Workspace standardized model for agent tools and APIs](https://developers.google.com/workspace/tools-safety).

For the full announcement, see [Agent tools and security updates for Google Workspace developers](http://workspaceupdates.googleblog.com/2026/05/agent-tools-and-security-updates-for-workspace-developers.html).

As the Google Drive API is a shared service, we apply quotas and limitations to
make sure it's used fairly by all users and to protect the overall performance
of the Google Workspace system.

Limits are defined in terms of [quota units](https://developers.google.com/workspace/drive/api/guides/limits#per-method-quota), an abstract
unit of measurement representing Google Drive resource usage.

## Drive API quotas

Three types of quotas are enforced:

* **Per minute per project:** This is the number of quota units your
  Google Cloud project can use in one minute.
* **Per minute per user per project:** This is the number of quota units any
  one particular user can use in your Cloud project. This limit aims
  at helping you ensure a fair distribution of usage among your users.
* **Per day per project**: This defines the maximum number of bytes your
  Google Cloud project can egress within a 24-hour period before charges apply.

The following table details these limits:

| Usage limit type | Limit |
| --- | --- |
| Per minute per project | 1,000,000 quota units |
| Per minute per user per project | 325,000 quota units |
| Per day per project | 1 TB |

If you exceed a quota, you'll receive a [`403: User rate limit
exceeded`](https://developers.google.com/workspace/drive/api/guides/handle-errors#user-rate-limit) HTTP
status code response. Additional rate limit checks on the Drive
backend might also generate a [`429: Rate limit
exceeded`](https://developers.google.com/workspace/drive/api/guides/handle-errors#rate-limit-exceeded)
response. If this happens, you should use an [exponential backoff
algorithm](https://developers.google.com/workspace/drive/api/guides/limits#exponential) and try again later.

## Daily billing threshold

This **per day per project** limit defines the maximum number of quota units
your Google Cloud project can use within a 24-hour period before charges apply.

Usage under this threshold doesn't incur extra charges and your Google Cloud
account isn't billed. Full billing details will be shared later in 2026 with at
least 90 days' notice before any changes take effect.

You cannot request an increase on this daily threshold limit.

The following table details the limit:

| Threshold limit type | Limit |
| --- | --- |
| Per day per project | 400,000,000 quota units |

For more information, see [Google Workspace standardized model for agent tools
and APIs](https://developers.google.com/workspace/tools-safety).

## Per-method quota usage

The number of quota units consumed per request varies depending on the method
called. The following table outlines the per-method quota unit usage:

| Action | Quota units |
| --- | --- |
| Read items, such as `files.get` | 5 |
| List items, such as `files.list` | 100 |
| Download items, such as `files.download` | 200 |
| Edit items, such as `files.update` | 50 |
| Other actions, such as `files.generateIds` | 5 |

## Additional constraints

The following constraints are enforced when working with Drive API:

* Google Workspace users can only upload 750 GB per day between My
  Drive and all shared drives; this limit also applies to
  copies.
* Users who reach the 750 GB limit or upload a file larger than 750 GB can't
  upload or copy additional files until 24 hours have passed.
* The maximum file size that users can upload is 5 TB; only the first file
  that breaks the limit completes uploading. The maximum file size that users
  can copy is 750 GB.
* [Notifications](https://developers.google.com/workspace/drive/api/guides/push) delivered to the address
  specified when opening a notification channel don't count against your quota
  limits. However, calls to the
  [`changes.watch`](https://developers.google.com/workspace/drive/api/v3/reference/changes/watch),
  [`channels.stop`](https://developers.google.com/workspace/drive/api/v3/reference/channels/stop), and
  [`files.watch`](https://developers.google.com/workspace/drive/api/v3/reference/files/watch) methods do
  count against your quota.
* Provided you stay within the per-minute quotas, there's no limit to the
  number of requests you can make per day.
* Depending on your type of Google Workspace account, there are additional
  [Drive storage limits](https://knowledge.workspace.google.com/admin/drive/storage-and-upload-limits-for-google-workspace).

## Resolve time-based quota errors

For all time-based errors (maximum of N requests per X minutes), we recommend
your code catches the exception and uses a *truncated exponential backoff* to make sure your
devices don't generate excessive load.

Exponential backoff is a standard error handling strategy for network applications. An
exponential backoff algorithm retries requests using exponentially increasing wait times
between requests, up to a maximum backoff time. If requests are still unsuccessful, it's
important that the delays between requests increase over time until the request is successful.

### Example algorithm

An exponential backoff algorithm retries requests exponentially, increasing the wait time
between retries up to a maximum backoff time. For example:

1. Make a request to Google Drive API.
2. If the request fails, wait 1 + `random_number_milliseconds` and retry
   the request.
3. If the request fails, wait 2 + `random_number_milliseconds` and retry
   the request.
4. If the request fails, wait 4 + `random_number_milliseconds` and retry
   the request.
5. And so on, up to a `maximum_backoff` time.
6. Continue waiting and retrying up to some maximum number of retries, but don't increase the wait
   period between retries.

where:

* The wait time is `min(((2^n)+random_number_milliseconds), maximum_backoff)`,
  with `n` incremented by 1 for each iteration (request).
* `random_number_milliseconds` is a random number of milliseconds less than or
  equal to 1,000. This helps to avoid cases in which many clients are synchronized by
  some situation and all retry at once, sending requests in synchronized
  waves. The value of `random_number_milliseconds` is recalculated after each
  retry request.
* `maximum_backoff` is typically 32 or 64 seconds. The appropriate value
  depends on the use case.

The client can continue retrying after it has reached the `maximum_backoff` time.
Retries after this point don't need to continue increasing backoff time. For
example, if a client uses a `maximum_backoff` time of 64 seconds, then after reaching
this value, the client can retry every 64 seconds. At some point,
clients should be prevented from retrying indefinitely.

The wait time between retries and the number of retries depend on your use case
and network conditions.

## Pricing

All standard use of the Google Drive API is available at no additional cost. Exceeding the quota
request limits is planned to incur charges to your Google Cloud billing account later in 2026.
For more information, see [Google Workspace standardized model
for agent tools and APIs](https://developers.google.com/workspace/tools-safety).

## Request a quota increase

Depending on your project's resource usage, you might want to request a quota
adjustment. API calls by a service account are considered to be using a
single account. Applying for an adjusted quota doesn't guarantee approval. Quota adjustment
requests that would significantly increase the quota value can take longer to be approved.

Not all projects have the same quotas. As you increasingly use Google Cloud over
time, your quota values might need to increase. If you expect a notable upcoming
increase in usage, you can proactively
[request quota adjustments](https://docs.cloud.google.com/docs/quotas/view-manage#requesting_higher_quota)
from the [Quotas & System Limits](https://console.cloud.google.com/iam-admin/quotas) page in the Google Cloud console.

To learn more, see the following resources:

* [About quota adjustments](https://docs.cloud.google.com/docs/quotas/overview#about_increase_requests)
* [View your quota usage and limits](https://docs.cloud.google.com/docs/quotas/view-manage#viewing_your_quota_console)
* [Request a higher quota limit](https://docs.cloud.google.com/docs/quotas/view-manage#requesting_higher_quota)

## Drive MCP server quotas

The Drive MCP server uses a query cost allocation metric. The
following tables detail the query cost for each Drive MCP server
method by section:

### Drive MCP quotas

Two types of quotas are enforced:

* **Per minute per project:** This is the query cost to your Google Cloud project
  for one minute.
* **Per minute per user per project:** This is the query cost to your
  Google Cloud project for one minute that any one particular user can use.

The following table details these quotas:

| Usage limit type | Limit |
| --- | --- |
| Per minute per project | 325,000 |
| Per minute per user per project | 1,000,000 |

### Drive MCP toolset quotas

The following table details the query cost for each `drivemcp.googleapis.com`
toolset:

| Endpoint | Tool | Query cost |
| --- | --- | --- |
| **/mcp/v1** | `copy_file` | 50 |
| `create_file` | 50 |
| `download_file_content` | 200 |
| `get_file_metadata` | 5 |
| `get_file_permissions` | 5 |
| `list_recent_files` | 100 |
| `read_file_content` | 200 |
| `search_files` | 100 |

For more information, see the [Drive MCP API
Reference](https://developers.google.com/workspace/drive/api/reference/mcp).

## Related topics

* [Improve performance](https://developers.google.com/workspace/drive/api/guides/performance)
* [File and folder limits](https://developers.google.com/workspace/drive/api/guides/folder#folder-limits)
* [File and folder limits in shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#folder-limits)
