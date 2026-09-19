"""Draft 2020-12 grammar tests for the encrypted catalog catalog-v1 profile.

The suite loads the proposed schema and synthetic fixtures. It validates
structure only. It does not implement semantic checks such as cross-references,
selected-property uniqueness, JCS, raw duplicate keys, encoded byte ceilings,
publisher identity, readback digest equality, or conflict resolution.
"""

import copy
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = REPO_ROOT / "docs" / "reference" / "schemas" / "catalog-v1.schema.json"
FIXTURES_PATH = REPO_ROOT / "fixtures" / "catalog-v1-examples.json"

CATALOG_NAMES = (
    "baseline",
    "forkA",
    "forkB",
    "tombstoned",
    "rootUpdateOldEpoch",
    "rootUpdateNewEpoch",
)
ENTRY_KINDS = frozenset({"snapshot", "tombstone", "root-update-receipt"})
OUTCOME_STATUSES = frozenset(
    {
        "readback-authenticated",
        "digest-mismatch",
        "authentication-failed",
        "not-found",
        "access-denied",
        "unavailable",
    }
)
REQUIRED_DEFS = (
    "id16",
    "id32",
    "digest",
    "timestamp",
    "text",
    "labelText",
    "binding",
    "metadata",
    "locator",
)
SUCCESSOR_CATALOG_NAMES = (
    "forkA",
    "forkB",
    "tombstoned",
    "rootUpdateOldEpoch",
    "rootUpdateNewEpoch",
)

MAX_PARENTS = 16
MAX_ENTRIES = 1000
MAX_OBSERVATIONS = 4000
MAX_LOCATORS = 16
MAX_STATE_IDS = 256
MAX_LABEL = 256
MAX_PACKAGE_BYTES = 25165824
MAX_CODEC_VERSION = 2147483647
MAX_RETAINED_OLD_EPOCHS = 255
MAX_RECEIPT_PARENTS = 2
PLAINTEXT_CEILING_BYTES = 16 * 1024 * 1024
METADATA_BYTE_CEILING = 64 * 1024

DIGEST_A = "a" * 64
DIGEST_B = "b" * 64


def load_json(path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def make_digest(index):
    return format(index, "064x")


def make_id16(index):
    return format(index, "021x") + "A"


def make_id32(index):
    return format(index, "042x") + "A"


def first_entry(catalog, kind):
    for entry in catalog["entries"]:
        if entry.get("entryKind") == kind:
            return entry
    raise AssertionError("catalog has no %s entry" % kind)


def compact_canonical_utf8(value):
    """Return UTF-8 bytes of compact, key-sorted JSON.

    For the ASCII strings and integers this test generates, the byte
    length matches JCS (RFC 8785). Compact separators omit whitespace.
    sort_keys orders object members by Unicode code point. Integers
    serialize as base-10 without an exponent or a leading zero. The
    generated ASCII strings contain no characters that JCS would escape
    differently from json.dumps.

    This helper is not a general JCS implementation. Do not treat
    json.dumps as JCS for floats, non-ASCII strings, or other JSON
    values.
    """
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def walk_bindings(node):
    if isinstance(node, dict):
        if "scheme" in node and "value" in node:
            yield node
        for child in node.values():
            yield from walk_bindings(child)
    elif isinstance(node, list):
        for child in node:
            yield from walk_bindings(child)


class TestCatalogContractFiles(unittest.TestCase):
    def test_schema_file_exists(self):
        self.assertTrue(SCHEMA_PATH.is_file(), "missing %s" % SCHEMA_PATH)

    def test_fixtures_file_exists(self):
        self.assertTrue(FIXTURES_PATH.is_file(), "missing %s" % FIXTURES_PATH)


class CatalogSchemaTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = load_json(SCHEMA_PATH)
        Draft202012Validator.check_schema(cls.schema)
        format_checker = FormatChecker()
        if "date-time" not in format_checker.checkers:
            raise AssertionError(
                "FormatChecker has no date-time checker. Install "
                "jsonschema==4.19.2 and rfc3339-validator==0.1.4 from "
                "tests/requirements.txt and run this suite in that environment."
            )
        cls.validator = Draft202012Validator(
            cls.schema, format_checker=format_checker
        )
        cls.fixtures = load_json(FIXTURES_PATH)

    def catalog(self, name="baseline"):
        return copy.deepcopy(self.fixtures["catalogs"][name])

    def assert_valid(self, instance):
        errors = list(self.validator.iter_errors(instance))
        self.assertEqual(errors, [], "expected schema to accept instance")

    def assert_invalid(self, instance):
        errors = list(self.validator.iter_errors(instance))
        self.assertTrue(errors, "expected schema to reject instance")

    def mutate_snapshot(self, mutator, name="baseline"):
        catalog = self.catalog(name)
        mutator(first_entry(catalog, "snapshot"))
        return catalog

    def mutate_receipt(self, mutator, name="rootUpdateOldEpoch"):
        catalog = self.catalog(name)
        mutator(first_entry(catalog, "root-update-receipt"))
        return catalog

    def mutate_tombstone(self, mutator, name="tombstoned"):
        catalog = self.catalog(name)
        mutator(first_entry(catalog, "tombstone"))
        return catalog

    def mutate_observation(self, mutator, name="baseline"):
        catalog = self.catalog(name)
        if not catalog["observations"]:
            snapshot = first_entry(catalog, "snapshot")
            catalog["observations"] = [
                {
                    "observationId": snapshot["package"]["generationId"],
                    "packageSha256": snapshot["package"]["sha256"],
                    "locator": copy.deepcopy(snapshot["locators"][0]),
                    "observedAt": snapshot["metadata"]["capturedAt"],
                    "outcome": {"status": "unavailable", "reason": "network"},
                }
            ]
        mutator(catalog["observations"][0])
        return catalog

    def observation_template(self, catalog):
        snapshot = first_entry(catalog, "snapshot")
        if catalog["observations"]:
            return copy.deepcopy(catalog["observations"][0])
        return {
            "observationId": snapshot["package"]["generationId"],
            "packageSha256": snapshot["package"]["sha256"],
            "locator": copy.deepcopy(snapshot["locators"][0]),
            "observedAt": snapshot["metadata"]["capturedAt"],
            "outcome": {"status": "unavailable", "reason": "network"},
        }


class TestCatalogSchemaDocument(CatalogSchemaTestCase):
    def test_schema_declares_draft_2020_12(self):
        schema_uri = self.schema.get("$schema")
        self.assertEqual(
            schema_uri, "https://json-schema.org/draft/2020-12/schema"
        )

    def test_schema_is_self_contained(self):
        bad_refs = []

        def walk(node):
            if isinstance(node, dict):
                ref = node.get("$ref")
                if isinstance(ref, str) and not ref.startswith("#"):
                    bad_refs.append(ref)
                for child in node.values():
                    walk(child)
            elif isinstance(node, list):
                for child in node:
                    walk(child)

        walk(self.schema)
        self.assertEqual(bad_refs, [])

    def test_format_checker_registers_date_time(self):
        self.assertIsNotNone(self.validator.format_checker)
        self.assertIn("date-time", self.validator.format_checker.checkers)

    def test_schema_exposes_named_defs(self):
        defs = self.schema.get("$defs")
        self.assertIsInstance(defs, dict)
        for name in REQUIRED_DEFS:
            self.assertIn(name, defs)


class TestCatalogFixtures(CatalogSchemaTestCase):
    def test_notice_marks_public_synthetic_data(self):
        self.assertEqual(self.fixtures["notice"], "PUBLIC SYNTHETIC TEST DATA")

    def test_fixture_catalog_names(self):
        self.assertEqual(set(self.fixtures["catalogs"]), set(CATALOG_NAMES))

    def test_all_named_catalogs_validate(self):
        for name in CATALOG_NAMES:
            with self.subTest(catalog=name):
                self.assert_valid(self.catalog(name))

    def test_catalogs_collectively_include_all_entry_kinds(self):
        kinds = set()
        for name in CATALOG_NAMES:
            for entry in self.catalog(name)["entries"]:
                kinds.add(entry.get("entryKind"))
        self.assertEqual(kinds, ENTRY_KINDS)

    def test_catalogs_collectively_include_all_outcome_statuses(self):
        statuses = set()
        for name in CATALOG_NAMES:
            for observation in self.catalog(name)["observations"]:
                statuses.add(observation["outcome"]["status"])
        self.assertEqual(statuses, OUTCOME_STATUSES)

    def test_every_catalog_carries_snapshot_metadata(self):
        for name in CATALOG_NAMES:
            with self.subTest(catalog=name):
                snapshot = first_entry(self.catalog(name), "snapshot")
                self.assertIn("metadata", snapshot)
                self.assertIsInstance(snapshot["metadata"], dict)

    def test_fixture_bindings_use_synthetic_scheme(self):
        for name in CATALOG_NAMES:
            catalog = self.catalog(name)
            bindings = list(walk_bindings(catalog))
            self.assertTrue(bindings, "catalog %s has no bindings" % name)
            for binding in bindings:
                self.assertEqual(binding["scheme"], "synthetic-fixture")

    def test_baseline_contains_only_snapshot_entry(self):
        kinds = [
            entry["entryKind"] for entry in self.catalog("baseline")["entries"]
        ]
        self.assertEqual(kinds, ["snapshot"])

    def test_successors_retain_baseline_observations_unchanged(self):
        baseline_observations = self.catalog("baseline")["observations"]
        self.assertTrue(baseline_observations)
        for name in SUCCESSOR_CATALOG_NAMES:
            with self.subTest(catalog=name):
                successor_observations = self.catalog(name)["observations"]
                for observation in baseline_observations:
                    self.assertIn(observation, successor_observations)

    def test_forks_carry_baseline_snapshot_entry(self):
        baseline_entry = first_entry(self.catalog("baseline"), "snapshot")
        for name in ("forkA", "forkB"):
            with self.subTest(catalog=name):
                snapshots = [
                    entry
                    for entry in self.catalog(name)["entries"]
                    if entry.get("entryKind") == "snapshot"
                ]
                self.assertIn(baseline_entry, snapshots)

    def test_fork_heads_share_record_and_differ_in_generation(self):
        baseline = first_entry(self.catalog("baseline"), "snapshot")
        fork_a = first_entry(self.catalog("forkA"), "snapshot")
        fork_b = first_entry(self.catalog("forkB"), "snapshot")
        self.assertEqual(
            fork_a["package"]["scopeId"], fork_b["package"]["scopeId"]
        )
        self.assertEqual(
            fork_a["package"]["recordId"], fork_b["package"]["recordId"]
        )
        self.assertEqual(
            fork_a["package"]["scopeId"], baseline["package"]["scopeId"]
        )
        self.assertEqual(
            fork_a["package"]["recordId"], baseline["package"]["recordId"]
        )
        self.assertNotEqual(
            fork_a["package"]["generationId"],
            fork_b["package"]["generationId"],
        )
        self.assertNotEqual(
            fork_a["package"]["generationId"],
            baseline["package"]["generationId"],
        )
        self.assertNotEqual(
            fork_b["package"]["generationId"],
            baseline["package"]["generationId"],
        )
        self.assertNotEqual(fork_a["package"]["sha256"], fork_b["package"]["sha256"])
        self.assertNotEqual(
            fork_a["package"]["sha256"], baseline["package"]["sha256"]
        )
        self.assertNotEqual(
            fork_b["package"]["sha256"], baseline["package"]["sha256"]
        )

    def test_fork_heads_share_a_known_ancestor(self):
        baseline_digest = first_entry(self.catalog("baseline"), "snapshot")[
            "package"
        ]["sha256"]
        fork_a = self.catalog("forkA")
        fork_b = self.catalog("forkB")
        snapshot_a = first_entry(fork_a, "snapshot")
        snapshot_b = first_entry(fork_b, "snapshot")
        self.assertIn(baseline_digest, snapshot_a["metadata"]["parents"])
        self.assertIn(baseline_digest, snapshot_b["metadata"]["parents"])
        self.assertNotIn(
            baseline_digest,
            fork_a["parents"],
            "catalog parents are not snapshot-fork ancestry",
        )
        self.assertNotIn(
            baseline_digest,
            fork_b["parents"],
            "catalog parents are not snapshot-fork ancestry",
        )

    def test_tombstoned_has_snapshot_and_tombstone_only(self):
        kinds = [
            entry["entryKind"]
            for entry in self.catalog("tombstoned")["entries"]
        ]
        self.assertEqual(set(kinds), {"snapshot", "tombstone"})
        self.assertEqual(kinds.count("snapshot"), 1)
        self.assertEqual(kinds.count("tombstone"), 1)

    def test_root_update_catalogs_have_snapshot_and_receipt_only(self):
        for name in ("rootUpdateOldEpoch", "rootUpdateNewEpoch"):
            with self.subTest(catalog=name):
                kinds = [
                    entry["entryKind"]
                    for entry in self.catalog(name)["entries"]
                ]
                self.assertEqual(set(kinds), {"snapshot", "root-update-receipt"})
                self.assertEqual(kinds.count("snapshot"), 1)
                self.assertEqual(kinds.count("root-update-receipt"), 1)

    def test_tombstone_targets_baseline_snapshot(self):
        baseline_digest = first_entry(self.catalog("baseline"), "snapshot")[
            "package"
        ]["sha256"]
        tombstone = first_entry(self.catalog("tombstoned"), "tombstone")
        self.assertEqual(tombstone["targetPackageSha256"], baseline_digest)

    def test_root_update_receipts_have_identical_bodies(self):
        old_receipt = first_entry(
            self.catalog("rootUpdateOldEpoch"), "root-update-receipt"
        )
        new_receipt = first_entry(
            self.catalog("rootUpdateNewEpoch"), "root-update-receipt"
        )
        self.assertEqual(old_receipt, new_receipt)


class TestRootObjectMutations(CatalogSchemaTestCase):
    def test_payload_version_must_be_one(self):
        catalog = self.catalog()
        catalog["payloadVersion"] = 2
        self.assert_invalid(catalog)

    def test_payload_version_rejects_string(self):
        catalog = self.catalog()
        catalog["payloadVersion"] = "1"
        self.assert_invalid(catalog)

    def test_missing_required_root_key(self):
        for key in ("payloadVersion", "parents", "entries", "observations"):
            with self.subTest(key=key):
                catalog = self.catalog()
                del catalog[key]
                self.assert_invalid(catalog)

    def test_unknown_key_at_root(self):
        catalog = self.catalog()
        catalog["note"] = "extra"
        self.assert_invalid(catalog)

    def test_forbidden_root_secret(self):
        catalog = self.catalog()
        catalog["secret"] = "not-allowed"
        self.assert_invalid(catalog)

    def test_forbidden_root_url(self):
        catalog = self.catalog()
        catalog["url"] = "https://example.invalid/catalog"
        self.assert_invalid(catalog)

    def test_empty_parents_are_valid(self):
        catalog = self.catalog()
        catalog["parents"] = []
        self.assert_valid(catalog)

    def test_empty_observations_are_valid(self):
        catalog = self.catalog()
        catalog["observations"] = []
        self.assert_valid(catalog)

    def test_empty_entries_are_valid(self):
        catalog = self.catalog()
        catalog["entries"] = []
        self.assert_valid(catalog)


class TestUnknownAndMissingKeys(CatalogSchemaTestCase):
    def test_unknown_key_on_snapshot(self):
        self.assert_invalid(
            self.mutate_snapshot(lambda entry: entry.__setitem__("extra", True))
        )

    def test_unknown_key_on_package(self):
        self.assert_invalid(
            self.mutate_snapshot(
                lambda entry: entry["package"].__setitem__("vaultId", "no")
            )
        )

    def test_unknown_key_on_metadata(self):
        self.assert_invalid(
            self.mutate_snapshot(
                lambda entry: entry["metadata"].__setitem__("comment", "no")
            )
        )

    def test_unknown_key_on_locator(self):
        def mutate(entry):
            entry["locators"][0]["filename"] = "package.bin"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_forbidden_locator_url(self):
        def mutate(entry):
            entry["locators"][0]["url"] = "https://drive.google.com/file/d/x"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_forbidden_locator_token(self):
        def mutate(entry):
            entry["locators"][0]["token"] = "not-a-credential"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_forbidden_locator_folder(self):
        def mutate(entry):
            entry["locators"][0]["folder"] = "objects"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_unknown_key_on_binding(self):
        def mutate(entry):
            entry["metadata"]["accountBinding"]["region"] = "none"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_unknown_key_on_network(self):
        def mutate(entry):
            entry["metadata"]["network"]["alias"] = "x"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_unknown_key_on_codec(self):
        def mutate(entry):
            entry["metadata"]["codec"]["flags"] = 1

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_unknown_key_on_lifecycle(self):
        def mutate(entry):
            entry["metadata"]["lifecycle"]["settled"] = True

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_unknown_key_on_contract(self):
        def mutate(entry):
            entry["metadata"]["contract"]["chainId"] = "1"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_unknown_key_on_tombstone(self):
        def mutate(entry):
            entry["wildcard"] = "*"

        self.assert_invalid(self.mutate_tombstone(mutate))

    def test_unknown_key_on_receipt(self):
        def mutate(entry):
            entry["secretRoot"] = "not-allowed"

        self.assert_invalid(self.mutate_receipt(mutate))

    def test_snapshot_metadata_rejects_label_field(self):
        def mutate(entry):
            entry["metadata"]["label"] = "not-in-snapshot-metadata"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_snapshot_metadata_rejects_extension_field(self):
        def mutate(entry):
            entry["metadata"]["x-codec"] = {"note": "no-extensions"}

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_unknown_key_on_observation(self):
        def mutate(observation):
            observation["retryCount"] = 1

        self.assert_invalid(self.mutate_observation(mutate))

    def test_unknown_key_on_outcome(self):
        def mutate(observation):
            observation["outcome"]["providerError"] = "raw body"

        self.assert_invalid(self.mutate_observation(mutate))

    def test_forbidden_provider_error_field(self):
        def mutate(observation):
            observation["providerError"] = {"code": 500, "body": "raw"}

        self.assert_invalid(self.mutate_observation(mutate))

    def test_missing_nullable_snapshot_label(self):
        def mutate(entry):
            del entry["label"]

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_missing_nullable_revision_id(self):
        def mutate(entry):
            del entry["locators"][0]["revisionId"]

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_missing_nullable_genesis_hash(self):
        def mutate(entry):
            del entry["metadata"]["network"]["genesisHash"]

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_missing_nullable_code_hash(self):
        def mutate(entry):
            del entry["metadata"]["contract"]["codeHash"]

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_missing_nullable_transaction_id(self):
        def mutate(entry):
            del entry["metadata"]["lifecycle"]["transactionId"]

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_missing_nullable_block_hash(self):
        def mutate(entry):
            del entry["metadata"]["lifecycle"]["blockHash"]

        self.assert_invalid(self.mutate_snapshot(mutate))


class TestIdentifierAndTimestampMutations(CatalogSchemaTestCase):
    def test_malformed_digest_uppercase(self):
        catalog = self.catalog()
        catalog["parents"] = ["A" * 64]
        self.assert_invalid(catalog)

    def test_malformed_digest_length(self):
        catalog = self.catalog()
        catalog["parents"] = ["a" * 63]
        self.assert_invalid(catalog)

    def test_malformed_digest_non_hex(self):
        catalog = self.catalog()
        catalog["parents"] = ["g" * 64]
        self.assert_invalid(catalog)

    def test_id16_rejects_noncanonical_pad_bits(self):
        def mutate(entry):
            root_epoch = entry["package"]["rootEpoch"]
            entry["package"]["rootEpoch"] = root_epoch[:-1] + "B"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_id32_rejects_noncanonical_pad_bits(self):
        def mutate(entry):
            scope_id = entry["package"]["scopeId"]
            entry["package"]["scopeId"] = scope_id[:-1] + "B"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_id16_rejects_padding_character(self):
        def mutate(entry):
            entry["package"]["rootEpoch"] = entry["package"]["rootEpoch"][:-1] + "="

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_id32_rejects_standard_base64_alphabet(self):
        def mutate(entry):
            entry["package"]["scopeId"] = entry["package"]["scopeId"][:-1] + "+"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_id16_rejects_wrong_length(self):
        def mutate(entry):
            entry["package"]["rootEpoch"] = entry["package"]["rootEpoch"][:-1]

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_timestamp_rejects_invalid_calendar_day(self):
        def mutate(entry):
            entry["metadata"]["capturedAt"] = "2026-02-30T00:00:00Z"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_timestamp_rejects_offset(self):
        def mutate(entry):
            entry["metadata"]["capturedAt"] = "2026-09-19T12:00:00+00:00"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_timestamp_rejects_numeric_offset(self):
        def mutate(entry):
            entry["metadata"]["capturedAt"] = "2026-09-19T12:00:00+01:00"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_timestamp_rejects_four_fractional_digits(self):
        def mutate(entry):
            entry["metadata"]["capturedAt"] = "2026-09-19T12:00:00.1234Z"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_timestamp_accepts_seconds_only(self):
        def mutate(entry):
            entry["metadata"]["capturedAt"] = "2026-09-19T12:00:00Z"

        self.assert_valid(self.mutate_snapshot(mutate))

    def test_timestamp_accepts_one_to_three_fractional_digits(self):
        for stamp in (
            "2026-09-19T12:00:00.1Z",
            "2026-09-19T12:00:00.12Z",
            "2026-09-19T12:00:00.123Z",
        ):
            with self.subTest(stamp=stamp):
                def mutate(entry, value=stamp):
                    entry["metadata"]["capturedAt"] = value

                self.assert_valid(self.mutate_snapshot(mutate))


class TestTextAndBindingMutations(CatalogSchemaTestCase):
    def test_text_rejects_c0_controls(self):
        def mutate(entry):
            entry["metadata"]["applicationId"] = "app\nname"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_text_rejects_del(self):
        def mutate(entry):
            entry["metadata"]["applicationId"] = "app\x7fname"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_text_rejects_empty_application_id(self):
        def mutate(entry):
            entry["metadata"]["applicationId"] = ""

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_text_accepts_unicode(self):
        def mutate(entry):
            entry["metadata"]["network"]["id"] = "网络-σύνθετο"

        self.assert_valid(self.mutate_snapshot(mutate))

    def test_network_id_maxlength_counts_unicode_characters(self):
        catalog = self.mutate_snapshot(
            lambda entry: entry["metadata"]["network"].__setitem__("id", "網" * 128)
        )
        self.assert_valid(catalog)
        catalog = self.mutate_snapshot(
            lambda entry: entry["metadata"]["network"].__setitem__("id", "網" * 129)
        )
        self.assert_invalid(catalog)

    def test_label_null_is_valid(self):
        self.assert_valid(
            self.mutate_snapshot(lambda entry: entry.__setitem__("label", None))
        )

    def test_label_empty_string_is_valid(self):
        self.assert_valid(
            self.mutate_snapshot(lambda entry: entry.__setitem__("label", ""))
        )

    def test_label_256_is_valid(self):
        self.assert_valid(
            self.mutate_snapshot(
                lambda entry: entry.__setitem__("label", "x" * MAX_LABEL)
            )
        )

    def test_label_257_is_invalid(self):
        self.assert_invalid(
            self.mutate_snapshot(
                lambda entry: entry.__setitem__("label", "x" * (MAX_LABEL + 1))
            )
        )

    def test_binding_scheme_rejects_uppercase(self):
        def mutate(entry):
            entry["metadata"]["accountBinding"]["scheme"] = "Synthetic-Fixture"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_binding_scheme_rejects_leading_digit(self):
        def mutate(entry):
            entry["metadata"]["accountBinding"]["scheme"] = "1synthetic"

        self.assert_invalid(self.mutate_snapshot(mutate))


class TestAbsoluteStringEnd(CatalogSchemaTestCase):
    TRAILING_CASES = (
        (
            "applicationId",
            lambda entry, value: entry["metadata"].__setitem__(
                "applicationId", value
            ),
            "wpp-vector-fixture",
        ),
        (
            "label",
            lambda entry, value: entry.__setitem__("label", value),
            "synthetic-baseline",
        ),
        (
            "binding.scheme",
            lambda entry, value: entry["metadata"]["accountBinding"].__setitem__(
                "scheme", value
            ),
            "synthetic-fixture",
        ),
        (
            "locator.objectId",
            lambda entry, value: entry["locators"][0].__setitem__(
                "objectId", value
            ),
            "synFixtureObjectBaseline",
        ),
        (
            "sourceCommit40",
            lambda entry, value: entry["metadata"]["codec"].__setitem__(
                "sourceCommit", value
            ),
            "a" * 40,
        ),
    )
    NEWLINES = (
        ("LF", "\n"),
        ("CR", "\r"),
        ("CRLF", "\r\n"),
    )

    def test_trailing_newlines_are_rejected(self):
        for field, setter, base in self.TRAILING_CASES:
            for suffix_name, suffix in self.NEWLINES:
                with self.subTest(field=field, suffix=suffix_name):
                    def mutate(entry, assign=setter, value=base + suffix):
                        assign(entry, value)

                    self.assert_invalid(self.mutate_snapshot(mutate))

    def test_values_without_trailing_newline_remain_valid(self):
        for field, setter, base in self.TRAILING_CASES:
            with self.subTest(field=field):
                def mutate(entry, assign=setter, value=base):
                    assign(entry, value)

                self.assert_valid(self.mutate_snapshot(mutate))

    def test_controls_free_unicode_still_passes(self):
        def mutate(entry):
            entry["metadata"]["applicationId"] = "应用-σύνθετο-アプリ"
            entry["label"] = "标签-ετικέτα"

        self.assert_valid(self.mutate_snapshot(mutate))


class TestBoundAndCountMutations(CatalogSchemaTestCase):
    def test_excessive_parents(self):
        catalog = self.catalog()
        catalog["parents"] = [make_digest(index) for index in range(MAX_PARENTS + 1)]
        self.assert_invalid(catalog)

    def test_excessive_entries(self):
        catalog = self.catalog()
        template = first_entry(catalog, "snapshot")
        catalog["entries"] = []
        for index in range(MAX_ENTRIES + 1):
            entry = copy.deepcopy(template)
            entry["label"] = "n%d" % index
            catalog["entries"].append(entry)
        self.assert_invalid(catalog)

    def test_excessive_observations(self):
        catalog = self.catalog()
        template = self.observation_template(catalog)
        catalog["observations"] = []
        for index in range(MAX_OBSERVATIONS + 1):
            observation = copy.deepcopy(template)
            observation["locator"] = copy.deepcopy(template["locator"])
            observation["locator"]["objectId"] = "obs%d" % index
            catalog["observations"].append(observation)
        self.assert_invalid(catalog)

    def test_excessive_locators(self):
        def mutate(entry):
            template = entry["locators"][0]
            locators = []
            for index in range(MAX_LOCATORS + 1):
                locator = copy.deepcopy(template)
                locator["objectId"] = "loc%d" % index
                locators.append(locator)
            entry["locators"] = locators

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_empty_locators_are_invalid(self):
        def mutate(entry):
            entry["locators"] = []

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_excessive_private_state_ids(self):
        def mutate(entry):
            entry["metadata"]["privateStateIds"] = [
                "state-%d" % index for index in range(MAX_STATE_IDS + 1)
            ]

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_empty_private_state_ids_are_invalid(self):
        def mutate(entry):
            entry["metadata"]["privateStateIds"] = []

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_byte_length_zero_is_invalid(self):
        def mutate(entry):
            entry["package"]["byteLength"] = 0

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_byte_length_above_max_is_invalid(self):
        def mutate(entry):
            entry["package"]["byteLength"] = MAX_PACKAGE_BYTES + 1

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_codec_version_zero_is_invalid(self):
        def mutate(entry):
            entry["metadata"]["codec"]["version"] = 0

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_codec_version_above_max_is_invalid(self):
        def mutate(entry):
            entry["metadata"]["codec"]["version"] = MAX_CODEC_VERSION + 1

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_source_commit_rejects_wrong_length(self):
        def mutate(entry):
            entry["metadata"]["codec"]["sourceCommit"] = "a" * 41

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_source_commit_rejects_uppercase(self):
        def mutate(entry):
            entry["metadata"]["codec"]["sourceCommit"] = "A" * 40

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_excessive_receipt_parents(self):
        def mutate(entry):
            entry["parentRootRecordSha256"] = [
                make_digest(index) for index in range(MAX_RECEIPT_PARENTS + 1)
            ]

        self.assert_invalid(self.mutate_receipt(mutate))

    def test_empty_receipt_parents_are_invalid(self):
        def mutate(entry):
            entry["parentRootRecordSha256"] = []

        self.assert_invalid(self.mutate_receipt(mutate))

    def test_excessive_retained_old_epochs(self):
        def mutate(entry):
            entry["retainedOldEpochs"] = [
                make_id16(index) for index in range(MAX_RETAINED_OLD_EPOCHS + 1)
            ]

        self.assert_invalid(self.mutate_receipt(mutate))


class TestDiscriminatorAndProviderMutations(CatalogSchemaTestCase):
    def test_wrong_entry_kind_discriminator(self):
        def mutate(entry):
            entry["entryKind"] = "delta"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_snapshot_shape_with_tombstone_kind_is_invalid(self):
        def mutate(entry):
            entry["entryKind"] = "tombstone"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_wrong_outcome_status(self):
        def mutate(observation):
            observation["outcome"] = {"status": "ok"}

        self.assert_invalid(self.mutate_observation(mutate))

    def test_readback_authenticated_requires_byte_length(self):
        catalog = self.catalog()
        digest = first_entry(catalog, "snapshot")["package"]["sha256"]

        def mutate(observation):
            observation["outcome"] = {
                "status": "readback-authenticated",
                "observedSha256": digest,
            }

        self.assert_invalid(self.mutate_observation(mutate))

    def test_authentication_failed_reason_must_be_aead_rejected(self):
        def mutate(observation):
            observation["outcome"] = {
                "status": "authentication-failed",
                "reason": "mac-failed",
            }

        self.assert_invalid(self.mutate_observation(mutate))

    def test_not_found_reason_must_be_object_not_found(self):
        def mutate(observation):
            observation["outcome"] = {
                "status": "not-found",
                "reason": "missing",
            }

        self.assert_invalid(self.mutate_observation(mutate))

    def test_access_denied_reason_must_be_permission_denied(self):
        def mutate(observation):
            observation["outcome"] = {
                "status": "access-denied",
                "reason": "forbidden",
            }

        self.assert_invalid(self.mutate_observation(mutate))

    def test_unavailable_reason_rejects_unknown_value(self):
        def mutate(observation):
            observation["outcome"] = {
                "status": "unavailable",
                "reason": "timeout",
            }

        self.assert_invalid(self.mutate_observation(mutate))

    def test_unsupported_provider(self):
        def mutate(entry):
            entry["locators"][0]["provider"] = "amazon-s3"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_url_object_id_is_invalid(self):
        def mutate(entry):
            entry["locators"][0]["objectId"] = (
                "https://drive.google.com/file/d/synthetic"
            )

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_object_id_rejects_empty_string(self):
        def mutate(entry):
            entry["locators"][0]["objectId"] = ""

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_revision_id_rejects_url(self):
        def mutate(entry):
            entry["locators"][0]["revisionId"] = (
                "https://drive.google.com/revision/synthetic"
            )

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_object_id_1024_is_valid_and_1025_is_invalid(self):
        catalog = self.mutate_snapshot(
            lambda entry: entry["locators"][0].__setitem__("objectId", "A" * 1024)
        )
        self.assert_valid(catalog)
        catalog = self.mutate_snapshot(
            lambda entry: entry["locators"][0].__setitem__("objectId", "A" * 1025)
        )
        self.assert_invalid(catalog)

    def test_wrong_tombstone_reason(self):
        def mutate(entry):
            entry["reason"] = "deleted"

        self.assert_invalid(self.mutate_tombstone(mutate))

    def test_wrong_lifecycle_status(self):
        def mutate(entry):
            entry["metadata"]["lifecycle"]["status"] = "settled"

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_wrong_retention_class(self):
        def mutate(entry):
            entry["metadata"]["retentionClass"] = "temporary"

        self.assert_invalid(self.mutate_snapshot(mutate))


class TestUniqueItemsMutations(CatalogSchemaTestCase):
    def test_duplicate_parents_are_invalid(self):
        catalog = self.catalog()
        digest = first_entry(catalog, "snapshot")["package"]["sha256"]
        catalog["parents"] = [digest, digest]
        self.assert_invalid(catalog)

    def test_duplicate_metadata_parents_are_invalid(self):
        def mutate(entry):
            digest = first_entry(self.catalog(), "snapshot")["package"]["sha256"]
            entry["metadata"]["parents"] = [digest, digest]

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_excessive_metadata_parents(self):
        def mutate(entry):
            entry["metadata"]["parents"] = [
                make_digest(index) for index in range(MAX_PARENTS + 1)
            ]

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_duplicate_locators_are_invalid(self):
        def mutate(entry):
            locator = copy.deepcopy(entry["locators"][0])
            entry["locators"].append(locator)

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_duplicate_private_state_ids_are_invalid(self):
        def mutate(entry):
            state_id = entry["metadata"]["privateStateIds"][0]
            entry["metadata"]["privateStateIds"].append(state_id)

        self.assert_invalid(self.mutate_snapshot(mutate))

    def test_duplicate_observations_are_invalid(self):
        catalog = self.catalog()
        template = self.observation_template(catalog)
        catalog["observations"] = [template, copy.deepcopy(template)]
        self.assert_invalid(catalog)

    def test_duplicate_receipt_parents_are_invalid(self):
        def mutate(entry):
            digest = entry["parentRootRecordSha256"][0]
            entry["parentRootRecordSha256"] = [digest, digest]

        self.assert_invalid(self.mutate_receipt(mutate))

    def test_duplicate_retained_old_epochs_are_invalid(self):
        def mutate(entry):
            epoch = entry["retainedOldEpochs"][0]
            entry["retainedOldEpochs"] = [epoch, epoch]

        self.assert_invalid(self.mutate_receipt(mutate))


class TestValidBoundaries(CatalogSchemaTestCase):
    def test_max_parents_are_valid(self):
        catalog = self.catalog()
        catalog["parents"] = [make_digest(index) for index in range(MAX_PARENTS)]
        self.assert_valid(catalog)

    def test_max_locators_are_valid(self):
        def mutate(entry):
            template = entry["locators"][0]
            locators = []
            for index in range(MAX_LOCATORS):
                locator = copy.deepcopy(template)
                locator["objectId"] = "loc%d" % index
                locators.append(locator)
            entry["locators"] = locators

        self.assert_valid(self.mutate_snapshot(mutate))

    def test_max_private_state_ids_are_valid(self):
        def mutate(entry):
            entry["metadata"]["privateStateIds"] = [
                "state-%d" % index for index in range(MAX_STATE_IDS)
            ]

        self.assert_valid(self.mutate_snapshot(mutate))

    def test_min_and_max_byte_length_are_valid(self):
        catalog = self.mutate_snapshot(
            lambda entry: entry["package"].__setitem__("byteLength", 1)
        )
        self.assert_valid(catalog)
        catalog = self.mutate_snapshot(
            lambda entry: entry["package"].__setitem__(
                "byteLength", MAX_PACKAGE_BYTES
            )
        )
        self.assert_valid(catalog)

    def test_min_and_max_codec_version_are_valid(self):
        catalog = self.mutate_snapshot(
            lambda entry: entry["metadata"]["codec"].__setitem__("version", 1)
        )
        self.assert_valid(catalog)
        catalog = self.mutate_snapshot(
            lambda entry: entry["metadata"]["codec"].__setitem__(
                "version", MAX_CODEC_VERSION
            )
        )
        self.assert_valid(catalog)

    def test_source_commit_accepts_forty_and_sixty_four_hex(self):
        catalog = self.mutate_snapshot(
            lambda entry: entry["metadata"]["codec"].__setitem__(
                "sourceCommit", "a" * 40
            )
        )
        self.assert_valid(catalog)
        catalog = self.mutate_snapshot(
            lambda entry: entry["metadata"]["codec"].__setitem__(
                "sourceCommit", "b" * 64
            )
        )
        self.assert_valid(catalog)

    def test_nullable_revision_id_null_is_valid(self):
        def mutate(entry):
            entry["locators"][0]["revisionId"] = None

        self.assert_valid(self.mutate_snapshot(mutate))

    def test_max_retained_old_epochs_are_valid(self):
        def mutate(entry):
            entry["retainedOldEpochs"] = [
                make_id16(index) for index in range(MAX_RETAINED_OLD_EPOCHS)
            ]

        self.assert_valid(self.mutate_receipt(mutate))

    def test_receipt_allows_one_or_two_parents(self):
        catalog = self.mutate_receipt(
            lambda entry: entry.__setitem__(
                "parentRootRecordSha256", [make_digest(1)]
            )
        )
        self.assert_valid(catalog)
        catalog = self.mutate_receipt(
            lambda entry: entry.__setitem__(
                "parentRootRecordSha256", [make_digest(1), make_digest(2)]
            )
        )
        self.assert_valid(catalog)

    def test_valid_observation_outcomes_from_snapshot_locator(self):
        catalog = self.catalog()
        snapshot = first_entry(catalog, "snapshot")
        digest = snapshot["package"]["sha256"]
        locator = copy.deepcopy(snapshot["locators"][0])
        observed_at = snapshot["metadata"]["capturedAt"]
        outcomes = (
            {
                "status": "readback-authenticated",
                "observedSha256": digest,
                "byteLength": snapshot["package"]["byteLength"],
            },
            {"status": "digest-mismatch", "observedSha256": DIGEST_B},
            {"status": "authentication-failed", "reason": "aead-rejected"},
            {"status": "not-found", "reason": "object-not-found"},
            {"status": "access-denied", "reason": "permission-denied"},
            {"status": "unavailable", "reason": "rate-limit"},
        )
        for index, outcome in enumerate(outcomes):
            with self.subTest(status=outcome["status"]):
                candidate = self.catalog()
                candidate["observations"] = [
                    {
                        "observationId": make_id32(index + 1),
                        "packageSha256": digest,
                        "locator": copy.deepcopy(locator),
                        "observedAt": observed_at,
                        "outcome": outcome,
                    }
                ]
                self.assert_valid(candidate)


class TestSchemaOnlyLimits(CatalogSchemaTestCase):
    def test_parsed_duplicate_keys_are_not_visible_to_schema(self):
        catalog = self.catalog("baseline")
        serialized = json.dumps(catalog, ensure_ascii=False)
        marker = '"payloadVersion": 1'
        self.assertIn(marker, serialized)
        duplicate_raw = serialized.replace(
            marker, '"payloadVersion": 2, "payloadVersion": 1', 1
        )
        two_at = duplicate_raw.find('"payloadVersion": 2')
        one_at = duplicate_raw.find('"payloadVersion": 1')
        self.assertNotEqual(two_at, -1)
        self.assertNotEqual(one_at, -1)
        self.assertLess(two_at, one_at)
        self.assertGreaterEqual(duplicate_raw.count('"payloadVersion"'), 2)
        parsed = json.loads(duplicate_raw)
        self.assertEqual(parsed["payloadVersion"], 1)
        self.assert_valid(parsed)

    def test_readback_digest_equality_is_not_schema_checked(self):
        catalog = self.catalog()
        snapshot = first_entry(catalog, "snapshot")
        referenced = snapshot["package"]["sha256"]
        observed = DIGEST_B if referenced != DIGEST_B else DIGEST_A
        catalog["observations"] = [
            {
                "observationId": snapshot["package"]["generationId"],
                "packageSha256": referenced,
                "locator": copy.deepcopy(snapshot["locators"][0]),
                "observedAt": snapshot["metadata"]["capturedAt"],
                "outcome": {
                    "status": "readback-authenticated",
                    "observedSha256": observed,
                    "byteLength": snapshot["package"]["byteLength"],
                },
            }
        ]
        self.assert_valid(catalog)

    def test_conflicting_snapshot_claims_are_not_schema_checked(self):
        catalog = self.catalog()
        snapshot = first_entry(catalog, "snapshot")
        conflict = copy.deepcopy(snapshot)
        if conflict.get("label") == "other-label":
            conflict["label"] = "alt-label"
        else:
            conflict["label"] = "other-label"
        catalog["entries"].append(conflict)
        self.assert_valid(catalog)

    def test_new_active_epoch_may_equal_retained_old_epoch_in_schema(self):
        def mutate(entry):
            entry["newActiveEpoch"] = entry["retainedOldEpochs"][0]

        self.assert_valid(self.mutate_receipt(mutate))

    def test_observation_may_name_unknown_package_in_schema(self):
        catalog = self.catalog()
        snapshot = first_entry(catalog, "snapshot")
        catalog["observations"] = [
            {
                "observationId": snapshot["package"]["generationId"],
                "packageSha256": DIGEST_A,
                "locator": copy.deepcopy(snapshot["locators"][0]),
                "observedAt": snapshot["metadata"]["capturedAt"],
                "outcome": {"status": "unavailable", "reason": "network"},
            }
        ]
        self.assert_valid(catalog)

    def test_schema_does_not_enforce_encoded_plaintext_ceiling(self):
        catalog = self.catalog("baseline")
        template = copy.deepcopy(first_entry(catalog, "snapshot"))
        state_ids = ["id%03d-%s" % (index, "p" * 180) for index in range(200)]
        sample = copy.deepcopy(template)
        sample["package"]["sha256"] = make_digest(0)
        sample["package"]["generationId"] = make_id32(0)
        sample["label"] = "n0"
        sample["metadata"]["privateStateIds"] = list(state_ids)
        metadata_size = len(compact_canonical_utf8(sample["metadata"]))
        self.assertLessEqual(metadata_size, METADATA_BYTE_CEILING)
        sample_size = len(compact_canonical_utf8(sample))
        self.assertGreater(sample_size, 0)
        count = min(MAX_ENTRIES, (PLAINTEXT_CEILING_BYTES // sample_size) + 2)
        entries = []
        for index in range(count):
            entry = copy.deepcopy(template)
            entry["package"]["sha256"] = make_digest(index)
            entry["package"]["generationId"] = make_id32(index)
            entry["label"] = "n%d" % index
            entry["metadata"]["privateStateIds"] = list(state_ids)
            entries.append(entry)
        catalog["entries"] = entries
        catalog["observations"] = []
        encoded = compact_canonical_utf8(catalog)
        self.assertGreater(len(encoded), PLAINTEXT_CEILING_BYTES)
        self.assertLessEqual(len(entries), MAX_ENTRIES)
        max_metadata = max(
            len(compact_canonical_utf8(entry["metadata"])) for entry in entries
        )
        self.assertLessEqual(max_metadata, METADATA_BYTE_CEILING)
        self.assert_valid(catalog)


if __name__ == "__main__":
    unittest.main()
