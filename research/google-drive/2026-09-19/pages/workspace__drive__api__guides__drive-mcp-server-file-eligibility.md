# Drive MCP file eligibility Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/drive-mcp-server-file-eligibility

Retrieved: 2026-09-19T16:31:49.340725+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

**Developer Preview:** Available as part of the
[Google Workspace Developer Preview Program](https://developers.google.com/workspace/preview),
which grants early access to certain features.

The Google Drive Model Context Protocol (MCP) server enforces access controls
and eligibility rules to determine which files and folders AI agents can
interact with.

When tools are invoked, the MCP server evaluates the requesting user and the
specific items to prevent unauthorized access and follow security policies.

## Eligibility requirements

For AI agents and applications using the Google Drive MCP server, files must
pass a series of security, policy, and capability checks. The MCP server
evaluates [Google Workspace Data Loss Prevention (DLP) rules](https://knowledge.workspace.google.com/admin/security/about-dlp), but
only policies that enforce
[Information Rights Management (IRM) controls](https://knowledge.workspace.google.com/admin/security/dlp-disable-download-print-copy) restrict eligibility.

To be eligible for interaction through the MCP server, a file or folder must
meet the following criteria:

* **Service availability**: The Google Drive service must be
  [enabled for the user's organization](https://knowledge.workspace.google.com/admin/users/advanced/turn-on-or-off-additional-google-services) in the
  Google Workspace Admin console.
* **ACL check**: The requesting user must have at least read permissions
  (`reader` access) on the file or folder.
* **Item-level constraints**:
  + **IRM (Information Rights Management)**: If the item has
    [IRM controls](https://knowledge.workspace.google.com/admin/security/dlp-disable-download-print-copy) preventing downloading, copy-pasting, or
    printing (including controls enforced by administrator-configured
    [DLP policies](https://knowledge.workspace.google.com/admin/security/about-dlp)), AI agents cannot access it.
  + **CAA (Context Aware Access)**: Evaluated using the file's
    [`capabilities.canDownload`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField_12)
    capability. If [CAA policies](https://knowledge.workspace.google.com/admin/security/about-context-aware-access) block access in the client's
    context (or if context data is missing during offline or background
    operations), the item is ineligible. If the client context satisfies the
    CAA requirements, the item remains eligible.
  + **Client-side encryption (CSE)**: Content encrypted with CSE cannot be
    parsed by AI agents and is ineligible.
* **Special item types**:
  + **Folders and shortcuts**: Folder and shortcut metadata are eligible.
    However, nested files within folders or target files referenced by
    shortcuts must independently satisfy all eligibility checks.
* **Undesirable item states**:
  + **Spam and malware**: Items marked as spam or malware are
    ineligible.
  + **Trash**: Items in the trash bin are ineligible.

## MCP server behavior for ineligible items

If an AI agent attempts to access an ineligible item, the server behavior
depends on the type of operation, as described in the following sections.

### Single-file operations

For operations targeting a single specific file or folder (such as reading
content, downloading, updating metadata, or retrieving permissions), the server
returns an error message similar to:

> Item metadata cannot be retrieved for item `<item id>` because it is
> ineligible to be used in generative AI contexts.

### Multi-file and list operations

For operations that retrieve lists or search for multiple files (such as
searching files or listing recent files), the server filters out ineligible
items from search results or file lists. This may cause discrepancies
where a user can view or edit a file in the Google Drive web interface,
but the AI agent cannot find or see the file.
