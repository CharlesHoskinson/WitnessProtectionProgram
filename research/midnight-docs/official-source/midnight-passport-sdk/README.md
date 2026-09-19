# Midnight Passport SDK

The developer SDK for **Midnight Passport** — the user-facing identity and
wallet layer for the Midnight network. The SDK is the primary programmatic
surface for a user's **Account Custody Contract (ACC)**: onboarding,
authentication, scoped grants, recovery, storage, proving, and the dApp
connector all resolve to authorised interactions with that on-chain account.

> **Status:** planning / spec, with a reduced **beta (v1)** defined. This
> repository will host the SDK packages as they are built.

## Documentation

The design lives in [`docs/`](./docs):

- [`sdk-requirements.md`](./docs/sdk-requirements.md) — what the SDK must do, and why.
- [`architecture.md`](./docs/architecture.md) — how it's built: layered core, seams, adapters, worked examples.
- [`development-workflow.md`](./docs/development-workflow.md) — the `mn-passport-skills-*` skills that drive development, spec orchestration, and PR / issue traceability.
- [`beta-scope.md`](./docs/beta-scope.md) — the reduced first version.

Component (`[C…]`) and promise (`[P…]`) references in these docs point to the
Midnight Passport **planning workspace**
([midnightntwrk/passport → `docs/plans`](https://github.com/midnightntwrk/passport/tree/main/docs/plans)),
where the component canvases and promises are maintained.

## Packages (planned)

Published under the `@midnight-ntwrk/` scope:

- `mn-passport-core` — kernel, flows, and seam interfaces (wallet / agent side).
- `mn-passport-protocol` — shared C23 wire types (dApp ↔ wallet).
- `mn-passport-contract` — typed ACC bindings over the externally-owned contract artefact.
- `mn-passport-connect` — the thin dApp-side connector.
- `mn-passport-adapter-*` — platform (browser, node) and seam adapters (signer, prover, storage, …).

## Development

Development is spec-driven and harness-assisted — see
[`docs/development-workflow.md`](./docs/development-workflow.md). Every spec is
planned into small, reviewable PRs anchored to a GitHub issue; progress and
backlog are tracked in [`STATE.md`](./STATE.md).

The workflow ships as the **`mn-passport-skills` plugin** in [`mn-passport-skills/`](./mn-passport-skills):
ten skills (`/mn-passport-skills:spec-author`, `/mn-passport-skills:spec-driver`, the four review
lenses, `doc-sync`, `pr-open`, and the `deps` / `devenv` watchers), a PreToolUse
hook that stops
outward actions for human confirmation, and the scripts behind the CI gate
([`.github/workflows/pr-checks.yml`](./.github/workflows/pr-checks.yml)).
Claude Code auto-enables it when you trust the repo (via
`.claude/settings.json`); manual fallback:
`/plugin marketplace add .` then `/plugin install mn-passport-skills@midnight-passport-sdk`.

Prerequisite: the private residual-risk register repo cloned as a sibling at
`../mn-passport-sdk-debts` (checked by `/mn-passport-skills:devenv`).
