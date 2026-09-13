# Terra design review

Reviewer model: `gpt-5.6-terra`. Date: 2026-09-13.

- [Initial findings, original review text](terra-initial.txt)
- [Follow-up, original review text and inspected file hashes](terra-followup.txt)

The original review text retains the local relative references used by the reviewer. Permanent upstream file links are in [the source lock](../design-source-lock.json); the maintained design is [here](../../docs/superpowers/specs/2026-09-13-witness-protection-program-design.md).

Five findings were resolved in the follow-up: native export field/value preservation, a released-API prerequisite for Passport, selected Bitwarden item/session containment, bounded root parsing and rollback handling, and native capture validation using available interfaces. The capture resolution uses wrapper-owned scope and a staging import; no native contract-scope getter or cleartext export count was invented.

This is a source/design consistency review. It is not cryptographic certification or evidence of an implemented wallet, live login, cloud backup, or Passport integration. The original follow-up hashes identify the exact design revision inspected; later edits must be evaluated separately.
