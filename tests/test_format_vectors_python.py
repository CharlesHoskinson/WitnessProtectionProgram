"""Independent Python checks for the public synthetic draft-v1 vector.

The computation under test must not call Node and must not read the Node
fixture. Fixture comparison is a separate verification step.
"""

import hashlib
import hmac
import importlib.metadata
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "scripts" / "format-vectors-python.py"
FIXTURE_PATH = REPO_ROOT / "fixtures" / "wpp-v1-vectors.json"
MAX_SAFE_INTEGER = 9007199254740991
B64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
HEADER_KEYS = (
    "format",
    "generationId",
    "kind",
    "nonce",
    "recordId",
    "rootEpoch",
    "scopeId",
    "suite",
    "vaultId",
    "vaultSalt",
    "version",
)
WIRE_KEYS = ("ciphertext", "header", "tag")
RFC5869_PRK = bytes.fromhex(
    "077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5"
)
RFC5869_INFO = bytes.fromhex("f0f1f2f3f4f5f6f7f8f9")
RFC5869_OKM32 = "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf"


def load_module():
    spec = importlib.util.spec_from_file_location("format_vectors_python", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def independent_b64url(data):
    import base64

    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def independent_b64url_decode(text):
    import base64

    pad = "=" * ((4 - len(text) % 4) % 4)
    return base64.urlsafe_b64decode(text + pad)


def independent_expand32(parent, info):
    return hmac.new(parent, info + b"\x01", hashlib.sha256).digest()


def load_vector_module():
    return load_module()


class FormatVectorPythonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_vector_module()

    def test_cryptography_pin_is_exact(self):
        self.assertEqual(importlib.metadata.version("cryptography"), "46.0.5")

    def test_canonical_fixture_sorts_keys_and_keeps_array_order(self):
        nested = {
            "z": 1,
            "a": {"d": True, "b": [{"y": 2, "x": 1}, "ok"], "c": None},
            "m": False,
        }
        self.assertEqual(
            self.mod.canonical_fixture(nested),
            '{"a":{"b":[{"x":1,"y":2},"ok"],"c":null,"d":true},"m":false,"z":1}',
        )
        self.assertEqual(self.mod.canonical_fixture([2, {"b": 1, "a": 0}, 1]), '[2,{"a":0,"b":1},1]')
        self.assertEqual(self.mod.canonical_fixture({"b": [2, 1], "a": 0}), '{"a":0,"b":[2,1]}')
        self.assertEqual(self.mod.canonical_fixture({}), "{}")
        self.assertEqual(self.mod.canonical_fixture([]), "[]")
        self.assertEqual(
            self.mod.canonical_fixture({"2": "two", "10": "ten"}),
            '{"10":"ten","2":"two"}',
        )
        self.assertEqual(
            self.mod.canonical_fixture({"__proto__": {"a": 1}, "z": 2}),
            '{"__proto__":{"a":1},"z":2}',
        )

    def test_canonical_fixture_accepts_printable_ascii_and_safe_integers(self):
        sample = "ASCII 0-9 A-Z a-z space and punctuation: ~!@#"
        self.assertEqual(self.mod.canonical_fixture(sample), json.dumps(sample))
        self.assertEqual(self.mod.canonical_fixture(""), '""')
        self.assertEqual(self.mod.canonical_fixture(None), "null")
        self.assertEqual(self.mod.canonical_fixture(True), "true")
        self.assertEqual(self.mod.canonical_fixture(False), "false")
        self.assertEqual(self.mod.canonical_fixture(0), "0")
        self.assertEqual(self.mod.canonical_fixture(1), "1")
        self.assertEqual(self.mod.canonical_fixture(-1), "-1")
        self.assertEqual(self.mod.canonical_fixture(MAX_SAFE_INTEGER), str(MAX_SAFE_INTEGER))
        self.assertEqual(self.mod.canonical_fixture(-MAX_SAFE_INTEGER), str(-MAX_SAFE_INTEGER))
        chars = "".join(chr(code) for code in range(0x20, 0x7F))
        encoded = self.mod.canonical_fixture(chars)
        self.assertEqual(encoded, json.dumps(chars, ensure_ascii=True))
        self.assertEqual(json.loads(encoded), chars)
        self.assertEqual(self.mod.canonical_fixture("a/b"), '"a/b"')
        self.assertEqual(self.mod.canonical_fixture("\\"), json.dumps("\\"))
        self.assertEqual(self.mod.canonical_fixture('a"b'), json.dumps('a"b'))

    def test_canonical_fixture_rejects_values_outside_the_fixture_domain(self):
        rejected = [
            "café",
            "hello\u00a0",
            "line\nbreak",
            "tab\tchar",
            chr(0x7F),
            1.5,
            1.0,
            -0.0,
            float("nan"),
            float("inf"),
            float("-inf"),
            MAX_SAFE_INTEGER + 1,
            -(MAX_SAFE_INTEGER + 1),
            b"x",
            bytearray(b"x"),
            (1, 2),
            {1, 2},
            object(),
        ]
        for value in rejected:
            with self.subTest(value=type(value).__name__):
                with self.assertRaises(self.mod.FormatVectorError) as caught:
                    self.mod.canonical_fixture(value)
                self.assertEqual(str(caught.exception), "canonical encoding rejected")
        for code in range(0x00, 0x20):
            with self.subTest(control=code):
                with self.assertRaises(self.mod.FormatVectorError):
                    self.mod.canonical_fixture(chr(code))
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.canonical_fixture({"café": 1})
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.canonical_fixture({"\n": 1})
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.canonical_fixture({1: "x"})
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.canonical_fixture({True: "x"})

        class DictSub(dict):
            pass

        class ListSub(list):
            pass

        class StrSub(str):
            pass

        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.canonical_fixture(DictSub(a=1))
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.canonical_fixture(ListSub([1]))
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.canonical_fixture(StrSub("ok"))

        cycled = {}
        cycled["a"] = cycled
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.canonical_fixture(cycled)

        nested = None
        for _ in range(32):
            nested = [nested]
        self.assertTrue(self.mod.canonical_fixture(nested).startswith("["))
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.canonical_fixture([nested])

    def test_hkdf_expand32_matches_rfc5869_case_1_and_rejects_other_lengths(self):
        okm = self.mod.hkdf_expand32(RFC5869_PRK, RFC5869_INFO)
        self.assertEqual(okm, bytes.fromhex(RFC5869_OKM32))
        self.assertEqual(len(okm), 32)
        info = b"info"
        for parent in (b"", b"\x00" * 31, b"\x00" * 33):
            with self.assertRaises(self.mod.FormatVectorError) as caught:
                self.mod.hkdf_expand32(parent, info)
            self.assertEqual(str(caught.exception), "hkdf expand rejected")
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.hkdf_expand32(bytearray(b"\x00" * 32), info)
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod.hkdf_expand32(b"\x00" * 32, "info")

    def test_build_vector_uses_documented_inputs_and_does_not_read_files(self):
        opened = []
        real_open = open

        def guard_open(*args, **kwargs):
            opened.append(args[0] if args else kwargs.get("file"))
            raise AssertionError("build_vector opened a file")

        import builtins

        builtins.open = guard_open
        try:
            first = self.mod.build_vector()
            second = self.mod.build_vector()
        finally:
            builtins.open = real_open
        self.assertEqual(opened, [])
        self.assertEqual(first, second)
        self.assertEqual(first["profile"], "wpp-draft-v1-synthetic-vector")
        self.assertIn("synthetic", first["profile"])

        secret = bytes(range(0, 32))
        self.assertEqual(first["inputs"]["secretRootHex"], secret.hex())
        header = first["inputs"]["header"]
        self.assertEqual(tuple(sorted(header)), HEADER_KEYS)
        expected_fields = {
            "vaultSalt": bytes(range(32, 64)),
            "vaultId": bytes(range(64, 80)),
            "rootEpoch": bytes(range(80, 96)),
            "scopeId": bytes(range(96, 128)),
            "recordId": bytes(range(128, 160)),
            "generationId": bytes(range(160, 192)),
            "nonce": bytes(range(192, 204)),
        }
        for name, raw in expected_fields.items():
            self.assertEqual(independent_b64url_decode(header[name]), raw)
            self.assertEqual(header[name], independent_b64url(raw))
            self.assertNotIn("=", header[name])
        self.assertEqual(header["format"], "wpp-witness-package")
        self.assertIs(type(header["version"]), int)
        self.assertEqual(header["version"], 1)
        self.assertEqual(header["suite"], "HKDF-SHA256+A256GCM")
        self.assertEqual(header["kind"], "snapshot")
        self.assertEqual(len(independent_b64url_decode(header["nonce"])), 12)

        payload = first["inputs"]["payload"]
        self.assertEqual(payload["payloadVersion"], 1)
        self.assertEqual(payload["content"]["message"], "PUBLIC SYNTHETIC TEST DATA")
        self.assertEqual(payload["content"]["counter"], "12345678901234567890")
        self.assertEqual(payload["metadata"]["codec"]["id"], "wpp.synthetic-vector")
        self.assertEqual(payload["metadata"]["parents"], [])
        self.assertIsNone(payload["metadata"]["network"]["genesisHash"])

    def test_build_vector_recomputes_hkdf_and_aes_gcm_independently(self):
        vector = self.mod.build_vector()
        header = vector["inputs"]["header"]
        expected = vector["expected"]
        secret = bytes.fromhex(vector["inputs"]["secretRootHex"])
        salt = independent_b64url_decode(header["vaultSalt"])
        prk = hmac.new(salt, secret, hashlib.sha256).digest()
        scope_info = json.dumps(
            ["WPP", "1", "scope", header["vaultId"], header["rootEpoch"], header["scopeId"]],
            separators=(",", ":"),
        ).encode("utf-8")
        object_info = json.dumps(
            ["WPP", "1", "object", header["kind"], header["recordId"], header["generationId"]],
            separators=(",", ":"),
        ).encode("utf-8")
        native_info = json.dumps(
            ["WPP", "1", "native-export-password", header["recordId"], header["generationId"]],
            separators=(",", ":"),
        ).encode("utf-8")
        scope_key = independent_expand32(prk, scope_info)
        object_key = independent_expand32(scope_key, object_info)
        native_key = independent_expand32(scope_key, native_info)

        self.assertEqual(prk.hex(), expected["prkHex"])
        self.assertEqual(scope_key.hex(), expected["scopeKeyHex"])
        self.assertEqual(object_key.hex(), expected["objectKeyHex"])
        self.assertEqual(native_key.hex(), expected["nativeKeyHex"])
        self.assertEqual(len({expected["prkHex"], expected["scopeKeyHex"], expected["objectKeyHex"], expected["nativeKeyHex"]}), 4)
        self.assertEqual(expected["nativeExportPassword"], independent_b64url(native_key))
        self.assertEqual(expected["headerUtf8"], self.mod.canonical_fixture(header))
        self.assertEqual(expected["payloadUtf8"], self.mod.canonical_fixture(vector["inputs"]["payload"]))
        self.assertEqual(expected["headerHex"], expected["headerUtf8"].encode("utf-8").hex())
        self.assertEqual(expected["payloadHex"], expected["payloadUtf8"].encode("utf-8").hex())

        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        sealed = AESGCM(object_key).encrypt(
            independent_b64url_decode(header["nonce"]),
            expected["payloadUtf8"].encode("utf-8"),
            expected["headerUtf8"].encode("utf-8"),
        )
        self.assertEqual(sealed[:-16].hex(), expected["ciphertextHex"])
        self.assertEqual(sealed[-16:].hex(), expected["tagHex"])
        self.assertEqual(len(sealed[-16:]), 16)
        wire = json.loads(expected["wireUtf8"])
        self.assertEqual(tuple(sorted(wire)), WIRE_KEYS)
        self.assertEqual(wire["header"], header)
        self.assertEqual(independent_b64url_decode(wire["ciphertext"]).hex(), expected["ciphertextHex"])
        self.assertEqual(independent_b64url_decode(wire["tag"]).hex(), expected["tagHex"])
        self.assertEqual(expected["wireUtf8"], self.mod.canonical_fixture(wire))
        self.assertEqual(hashlib.sha256(expected["wireUtf8"].encode("utf-8")).hexdigest(), expected["wireSha256"])

    def _root_and_wire(self):
        vector = self.mod.build_vector()
        root = bytes.fromhex(vector["inputs"]["secretRootHex"])
        wire = vector["expected"]["wireUtf8"].encode("utf-8")
        return vector, root, wire

    def test_decode_wire_returns_plaintext_only_after_authentication(self):
        vector, root, wire = self._root_and_wire()
        plaintext = self.mod.decode_wire(root, wire)
        self.assertEqual(plaintext, vector["expected"]["payloadUtf8"].encode("utf-8"))
        self.assertEqual(json.loads(plaintext.decode("utf-8")), vector["inputs"]["payload"])

    def test_decode_wire_rejects_wrong_root_and_mutations(self):
        vector, root, wire = self._root_and_wire()
        wrong = bytearray(root)
        wrong[-1] ^= 0xFF
        self._assert_auth_failure(bytes(wrong), wire, wrong.hex())

        parsed = json.loads(wire.decode("utf-8"))
        vault_id = bytearray(independent_b64url_decode(parsed["header"]["vaultId"]))
        vault_id[0] ^= 0xFF
        parsed["header"]["vaultId"] = independent_b64url(bytes(vault_id))
        mutated_header = self.mod.canonical_fixture(parsed).encode("utf-8")
        self._assert_auth_failure(root, mutated_header, vector["inputs"]["secretRootHex"])

        parsed = json.loads(wire.decode("utf-8"))
        parsed["header"]["kind"] = "catalog"
        self._assert_auth_failure(root, self.mod.canonical_fixture(parsed).encode("utf-8"), "")

        ciphertext = bytearray(bytes.fromhex(vector["expected"]["ciphertextHex"]))
        ciphertext[0] ^= 0xFF
        parsed = json.loads(wire.decode("utf-8"))
        parsed["ciphertext"] = independent_b64url(bytes(ciphertext))
        self._assert_auth_failure(root, self.mod.canonical_fixture(parsed).encode("utf-8"), "")

        tag = bytearray(bytes.fromhex(vector["expected"]["tagHex"]))
        tag[0] ^= 0xFF
        parsed = json.loads(wire.decode("utf-8"))
        parsed["tag"] = independent_b64url(bytes(tag))
        self._assert_auth_failure(root, self.mod.canonical_fixture(parsed).encode("utf-8"), "")

    def _assert_auth_failure(self, root, wire, forbidden):
        with self.assertRaises(self.mod.FormatVectorError) as caught:
            self.mod.decode_wire(root, wire)
        self.assertEqual(str(caught.exception), "authentication failed")
        self.assertIsNone(caught.exception.__cause__)
        text = str(caught.exception)
        self.assertNotIn("PUBLIC SYNTHETIC TEST DATA", text)
        if forbidden:
            self.assertNotIn(forbidden, text)

    def _authenticated_wire(self, plaintext):
        vector = self.mod.build_vector()
        header = vector["inputs"]["header"]
        root = bytes.fromhex(vector["inputs"]["secretRootHex"])
        scope_key = independent_expand32(
            hmac.new(independent_b64url_decode(header["vaultSalt"]), root, hashlib.sha256).digest(),
            json.dumps(
                ["WPP", "1", "scope", header["vaultId"], header["rootEpoch"], header["scopeId"]],
                separators=(",", ":"),
            ).encode("utf-8"),
        )
        object_key = independent_expand32(
            scope_key,
            json.dumps(
                ["WPP", "1", "object", header["kind"], header["recordId"], header["generationId"]],
                separators=(",", ":"),
            ).encode("utf-8"),
        )
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        sealed = AESGCM(object_key).encrypt(
            independent_b64url_decode(header["nonce"]),
            plaintext,
            self.mod.canonical_fixture(header).encode("utf-8"),
        )
        raw = self.mod.canonical_fixture(
            {
                "ciphertext": independent_b64url(sealed[:-16]),
                "header": header,
                "tag": independent_b64url(sealed[-16:]),
            }
        ).encode("utf-8")
        self.assertLessEqual(len(raw), 24 * 1024 * 1024)
        return root, raw

    def _assert_decode_equals(self, root, raw, plaintext):
        try:
            opened = self.mod.decode_wire(root, raw)
        except self.mod.FormatVectorError as exc:
            self.fail(f"decode rejected accepted outer JSON: {exc}")
        self.assertEqual(opened, plaintext)

    def test_decode_wire_accepts_outer_whitespace_reorder_and_trailing_newline(self):
        vector, root, wire = self._root_and_wire()
        plaintext = vector["expected"]["payloadUtf8"].encode("utf-8")
        parsed = json.loads(wire.decode("utf-8"))
        self.assertEqual(hashlib.sha256(wire).hexdigest(), vector["expected"]["wireSha256"])

        padded = b"  " + wire + b"\n"
        self.assertNotEqual(padded, wire)
        self._assert_decode_equals(root, padded, plaintext)
        self.assertNotEqual(hashlib.sha256(padded).hexdigest(), vector["expected"]["wireSha256"])

        spaced = wire.replace(b":", b": ", 1)
        self.assertNotEqual(spaced, wire)
        self._assert_decode_equals(root, spaced, plaintext)

        reordered = json.dumps(
            {
                "tag": parsed["tag"],
                "header": parsed["header"],
                "ciphertext": parsed["ciphertext"],
            },
            separators=(",", ":"),
        ).encode("utf-8")
        self.assertTrue(reordered.startswith(b'{"tag":'))
        self.assertNotEqual(reordered, wire)
        self._assert_decode_equals(root, reordered, plaintext)

        rotated_header = {key: parsed["header"][key] for key in reversed(tuple(parsed["header"]))}
        rotated = json.dumps(
            {
                "ciphertext": parsed["ciphertext"],
                "header": rotated_header,
                "tag": parsed["tag"],
            },
            separators=(",", ":"),
        )
        canonical_header = self.mod.canonical_fixture(parsed["header"])
        self.assertNotIn(canonical_header, rotated)
        self._assert_decode_equals(root, rotated.encode("utf-8"), plaintext)

        combined = (
            "\n{\n"
            + '"tag" : '
            + json.dumps(parsed["tag"])
            + ',\n"ciphertext" : '
            + json.dumps(parsed["ciphertext"])
            + ',\n"header" : '
            + json.dumps(rotated_header)
            + "\n}\n"
        ).encode("utf-8")
        self.assertNotEqual(combined, wire)
        self._assert_decode_equals(root, combined, plaintext)

    def _with_version_token(self, wire, token):
        needle = b'"version":1'
        self.assertEqual(wire.count(needle), 1)
        return wire.replace(needle, f'"version":{token}'.encode("ascii"), 1)

    def test_decode_wire_accepts_integral_version_spellings_under_canonical_aad(self):
        vector, root, wire = self._root_and_wire()
        plaintext = vector["expected"]["payloadUtf8"].encode("utf-8")
        header_utf8 = vector["expected"]["headerUtf8"]
        self.assertIn('"version":1}', header_utf8)
        self.assertNotIn('"version":1.0', header_utf8)
        self.assertNotIn('"version":1e0', header_utf8)
        self.assertNotIn('"version":10e-1', header_utf8)
        self.assertIs(type(vector["inputs"]["header"]["version"]), int)
        for token in ("1", "1.0", "1e0", "10e-1"):
            opened = self.mod.decode_wire(root, self._with_version_token(wire, token))
            self.assertEqual(opened, plaintext, token)

    def test_decode_wire_rejects_fractional_nonfinite_unsafe_and_boolean_versions(self):
        vector, root, wire = self._root_and_wire()
        calls = {"aes": 0}
        original = self.mod.AESGCM

        class FailAES:
            def __init__(self, _key):
                calls["aes"] += 1

            def decrypt(self, *_args, **_kwargs):
                calls["aes"] += 1
                raise AssertionError("AES-GCM ran")

        self.mod.AESGCM = FailAES
        try:
            for token in (
                "1.5",
                "1.0000000000000001",
                "9007199254740991.2",
                "2.0",
                "Infinity",
                "NaN",
                "-Infinity",
                "1e309",
                "1e20",
                "9007199254740993",
                "9007199254740992.0",
                "true",
            ):
                raw = self._with_version_token(wire, token)
                with self.assertRaises(self.mod.FormatVectorError, msg=token) as caught:
                    self.mod.decode_wire(root, raw)
                self.assertEqual(str(caught.exception), "malformed wire", token)
                self.assertIsNone(caught.exception.__cause__, token)
                self.assertNotIn(vector["inputs"]["secretRootHex"], str(caught.exception))
                self.assertNotIn("PUBLIC SYNTHETIC TEST DATA", str(caught.exception))
        finally:
            self.mod.AESGCM = original
        self.assertEqual(calls["aes"], 0)

    def test_shared_wire_corpus_accept_and_reject(self):
        corpus_path = REPO_ROOT / "fixtures" / "wpp-v1-wire-corpus.json"
        raw = corpus_path.read_bytes()
        corpus = json.loads(raw.decode("utf-8"))
        self.assertEqual(corpus["profile"], "wpp-draft-v1-synthetic-wire-corpus")
        self.assertEqual(corpus["comparison"], "accept-or-reject-only")
        self.assertIn("Error code classes can differ", corpus["errorClassNote"])
        fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        self.assertNotIn(fixture["inputs"]["secretRootHex"], raw.decode("utf-8"))
        root = bytes.fromhex(fixture["inputs"]["secretRootHex"])
        plaintext = fixture["expected"]["payloadUtf8"].encode("utf-8")
        seen = set()
        for case in corpus["cases"]:
            self.assertNotIn(case["id"], seen)
            seen.add(case["id"])
            wire = case["wireUtf8"].encode("utf-8")
            if case["outcome"] == "accept":
                self.assertEqual(self.mod.decode_wire(root, wire), plaintext, case["id"])
                continue
            self.assertEqual(case["outcome"], "reject", case["id"])
            with self.assertRaises(self.mod.FormatVectorError, msg=case["id"]) as caught:
                self.mod.decode_wire(root, wire)
            self.assertIn(str(caught.exception), {"malformed wire", "authentication failed"}, case["id"])
            self.assertIsNone(caught.exception.__cause__, case["id"])
            self.assertNotIn(fixture["inputs"]["secretRootHex"], str(caught.exception))
        self.assertEqual(len(seen), 25)

    def test_long_numeric_token_rejects_before_decimal(self):
        cap = self.mod.MAX_NUMBER_TOKEN_CHARS
        self.assertEqual(cap, 64)
        bounded = "1." + ("0" * (cap - 2))
        self.assertEqual(len(bounded), cap)
        self.assertEqual(self.mod._parse_exact_safe_integer(bounded), 1)
        self.assertEqual(self.mod._parse_exact_safe_integer("1.0"), 1)
        self.assertEqual(self.mod._parse_exact_safe_integer("10e-1"), 1)
        self.assertIs(type(self.mod._parse_exact_safe_integer("2.0")), int)
        self.assertEqual(self.mod._parse_exact_safe_integer("2.0"), 2)
        self.assertEqual(self.mod._parse_int(str(MAX_SAFE_INTEGER)), MAX_SAFE_INTEGER)
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod._parse_exact_safe_integer("1.0000000000000001")
        with self.assertRaises(self.mod.FormatVectorError):
            self.mod._parse_exact_safe_integer("0.99999999999999999")

        float_token = "1." + ("0" * (self.mod.MAX_WIRE_BYTES - 130))
        integer_token = "9" * (self.mod.MAX_WIRE_BYTES - 128)
        self.assertGreater(len(float_token), 20 * 1024 * 1024)
        self.assertLess(len(float_token.encode("ascii")), self.mod.MAX_WIRE_BYTES)
        self.assertGreater(len(integer_token), cap)
        calls = {"decimal": 0, "integer": 0}

        def decimal_fail(_text):
            calls["decimal"] += 1
            raise AssertionError("Decimal")

        def integer_fail(_text):
            calls["integer"] += 1
            raise AssertionError("int")

        original_decimal = self.mod._decimal_value
        original_integer = self.mod._integer_token
        self.mod._decimal_value = decimal_fail
        self.mod._integer_token = integer_fail
        try:
            import tracemalloc

            tracemalloc.start()
            tracemalloc.reset_peak()
            with self.assertRaises(self.mod.FormatVectorError) as float_caught:
                self.mod._parse_exact_safe_integer(float_token)
            self.assertEqual(str(float_caught.exception), "malformed wire")
            self.assertIsNone(float_caught.exception.__cause__)
            with self.assertRaises(self.mod.FormatVectorError) as int_caught:
                self.mod._parse_int(integer_token)
            self.assertEqual(str(int_caught.exception), "malformed wire")
            self.assertIsNone(int_caught.exception.__cause__)
            _current, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()
        finally:
            self.mod._decimal_value = original_decimal
            self.mod._integer_token = original_integer
        self.assertEqual(calls, {"decimal": 0, "integer": 0})
        self.assertLess(peak, 1024 * 1024)

    def test_decode_wire_rejects_long_version_token_before_decimal(self):
        vector, root, wire = self._root_and_wire()
        cap = self.mod.MAX_NUMBER_TOKEN_CHARS
        short = "1." + ("0" * (cap - 1))
        self.assertEqual(len(short), cap + 1)
        huge = "1." + ("0" * (self.mod.MAX_WIRE_BYTES - len(wire) - 64))
        raw_huge = self._with_version_token(wire, huge)
        self.assertGreater(len(huge), cap)
        self.assertLess(len(raw_huge), self.mod.MAX_WIRE_BYTES)
        calls = {"decimal": 0, "aes": 0}
        original_decimal = self.mod._decimal_value
        original_aes = self.mod.AESGCM

        def decimal_fail(_text):
            calls["decimal"] += 1
            raise AssertionError("Decimal")

        class FailAES:
            def __init__(self, _key):
                calls["aes"] += 1

            def decrypt(self, *_args, **_kwargs):
                calls["aes"] += 1
                raise AssertionError("AES-GCM ran")

        self.mod._decimal_value = decimal_fail
        self.mod.AESGCM = FailAES
        try:
            for token in (short, huge):
                raw = self._with_version_token(wire, token)
                with self.assertRaises(self.mod.FormatVectorError) as caught:
                    self.mod.decode_wire(root, raw)
                self.assertEqual(str(caught.exception), "malformed wire")
                self.assertIsNone(caught.exception.__cause__)
                self.assertNotIn(vector["inputs"]["secretRootHex"], str(caught.exception))
        finally:
            self.mod._decimal_value = original_decimal
            self.mod.AESGCM = original_aes
        self.assertEqual(calls, {"decimal": 0, "aes": 0})

    def test_decode_wire_accepts_authenticated_plaintext_at_16_mib(self):
        plaintext = b"P" * (16 * 1024 * 1024)
        root, raw = self._authenticated_wire(plaintext)
        parsed = json.loads(raw.decode("ascii"))
        self.assertEqual(len(parsed["ciphertext"]), 22369622)
        self.assertEqual(
            len(independent_b64url_decode(parsed["ciphertext"])),
            16 * 1024 * 1024,
        )
        opened = self.mod.decode_wire(root, raw)
        self.assertEqual(len(opened), len(plaintext))
        self.assertEqual(hashlib.sha256(opened).digest(), hashlib.sha256(plaintext).digest())

    def test_decode_wire_rejects_ciphertext_over_encoded_16_mib_before_base64_or_aes(self):
        plaintext = b"Q" * (16 * 1024 * 1024 + 1)
        root, raw = self._authenticated_wire(plaintext)
        self.assertLessEqual(len(raw), 24 * 1024 * 1024)
        parsed = json.loads(raw.decode("ascii"))
        self.assertEqual(len(parsed["ciphertext"]), 22369623)
        bad_tag = bytearray(independent_b64url_decode(parsed["tag"]))
        bad_tag[0] ^= 0xFF
        parsed["tag"] = independent_b64url(bytes(bad_tag))
        bad_wire = self.mod.canonical_fixture(parsed).encode("utf-8")
        self.assertLessEqual(len(bad_wire), 24 * 1024 * 1024)
        self.assertGreater(len(bad_wire), len(parsed["ciphertext"]))
        calls = {"b64": 0, "aes": 0}
        original_b64 = self.mod._b64url_decode
        original_aes = self.mod.AESGCM

        def fail_b64(*_args, **_kwargs):
            calls["b64"] += 1
            raise AssertionError("base64url decode ran")

        class FailAES:
            def __init__(self, _key):
                calls["aes"] += 1

            def decrypt(self, *_args, **_kwargs):
                calls["aes"] += 1
                raise AssertionError("AES-GCM ran")

        self.mod._b64url_decode = fail_b64
        self.mod.AESGCM = FailAES
        try:
            for candidate in (bad_wire, raw):
                with self.assertRaises(self.mod.FormatVectorError) as caught:
                    self.mod.decode_wire(root, candidate)
                self.assertEqual(str(caught.exception), "malformed wire")
                self.assertIsNone(caught.exception.__cause__)
                self.assertNotIn("Q" * 32, str(caught.exception))
                self.assertNotIn("PUBLIC SYNTHETIC TEST DATA", str(caught.exception))
        finally:
            self.mod._b64url_decode = original_b64
            self.mod.AESGCM = original_aes
        self.assertEqual(calls, {"b64": 0, "aes": 0})

    def test_decode_wire_rejects_decoded_ciphertext_over_16_mib_before_aes(self):
        vector, root, wire = self._root_and_wire()
        parsed = json.loads(wire.decode("utf-8"))
        decoded_len = len(independent_b64url_decode(parsed["ciphertext"]))
        self.assertLess(len(parsed["ciphertext"]), 22369622)
        self.assertGreater(decoded_len, 0)
        original_limit = self.mod.MAX_PLAINTEXT_BYTES
        original_aes = self.mod.AESGCM
        self.mod.MAX_PLAINTEXT_BYTES = decoded_len - 1
        calls = {"aes": 0}

        class FailAES:
            def __init__(self, _key):
                calls["aes"] += 1

            def decrypt(self, *_args, **_kwargs):
                calls["aes"] += 1
                raise AssertionError("AES-GCM ran")

        self.mod.AESGCM = FailAES
        try:
            with self.assertRaises(self.mod.FormatVectorError) as caught:
                self.mod.decode_wire(root, wire)
            self.assertEqual(str(caught.exception), "malformed wire")
            self.assertIsNone(caught.exception.__cause__)
            self.assertNotIn(vector["inputs"]["secretRootHex"], str(caught.exception))
        finally:
            self.mod.AESGCM = original_aes
            self.mod.MAX_PLAINTEXT_BYTES = original_limit
        self.assertEqual(calls["aes"], 0)

    def test_decode_wire_rejects_plaintext_over_16_mib_after_authentication(self):
        _vector, root, wire = self._root_and_wire()
        original = self.mod.AESGCM
        limit = self.mod.MAX_PLAINTEXT_BYTES

        class Overlong:
            def __len__(self):
                return limit + 1

        class LongPlaintext:
            def __init__(self, _key):
                pass

            def decrypt(self, _nonce, _data, _aad):
                return Overlong()

        self.mod.AESGCM = LongPlaintext
        try:
            with self.assertRaises(self.mod.FormatVectorError) as caught:
                self.mod.decode_wire(root, wire)
            self.assertEqual(str(caught.exception), "plaintext ceiling exceeded")
            self.assertNotIn("PUBLIC SYNTHETIC TEST DATA", str(caught.exception))
        finally:
            self.mod.AESGCM = original

    def test_decode_wire_accepts_exact_24_mib_and_rejects_one_extra_byte_before_parsing(self):
        vector, root, wire = self._root_and_wire()
        plaintext = vector["expected"]["payloadUtf8"].encode("utf-8")
        limit = 24 * 1024 * 1024
        self.assertEqual(limit, 25165824)
        self.assertEqual(self.mod.MAX_WIRE_BYTES, limit)
        self.assertLess(len(wire), limit)
        exact = bytearray(b"\x20" * limit)
        exact[: len(wire)] = wire
        exact = bytes(exact)
        self.assertEqual(len(exact), limit)
        self.assertTrue(exact.endswith(b" "))
        self.assertEqual(self.mod.decode_wire(root, exact), plaintext)
        extra = exact + b" "
        self.assertEqual(len(extra), limit + 1)
        original_loads = self.mod.json.loads

        def fail_loads(*_args, **_kwargs):
            raise AssertionError("JSON parser ran before the raw wire ceiling")

        self.mod.json.loads = fail_loads
        try:
            with self.assertRaises(self.mod.FormatVectorError) as caught:
                self.mod.decode_wire(root, extra)
            self.assertEqual(str(caught.exception), "malformed wire")
            self.assertIsNone(caught.exception.__cause__)
        finally:
            self.mod.json.loads = original_loads

    def test_decode_wire_enforces_raw_wire_ceiling_before_parsing(self):
        _vector, root, wire = self._root_and_wire()
        original_limit = self.mod.MAX_WIRE_BYTES
        original_loads = self.mod.json.loads
        self.mod.MAX_WIRE_BYTES = len(wire) - 1

        def fail_loads(*_args, **_kwargs):
            raise AssertionError("JSON parser ran before the raw wire ceiling")

        self.mod.json.loads = fail_loads
        try:
            with self.assertRaises(self.mod.FormatVectorError) as caught:
                self.mod.decode_wire(root, wire)
            self.assertEqual(str(caught.exception), "malformed wire")
        finally:
            self.mod.json.loads = original_loads
            self.mod.MAX_WIRE_BYTES = original_limit

    def test_decode_wire_rejects_malformed_and_extra_fields(self):
        vector, root, wire = self._root_and_wire()
        parsed = json.loads(wire.decode("utf-8"))

        def reject(raw):
            with self.assertRaises(self.mod.FormatVectorError) as caught:
                self.mod.decode_wire(root, raw)
            self.assertEqual(str(caught.exception), "malformed wire")
            self.assertNotIn("PUBLIC SYNTHETIC TEST DATA", str(caught.exception))
            self.assertNotIn(vector["inputs"]["secretRootHex"], str(caught.exception))

        extra = dict(parsed)
        extra["extra"] = 1
        reject(self.mod.canonical_fixture(extra).encode("utf-8"))

        header_extra = json.loads(wire.decode("utf-8"))
        header_extra["header"] = dict(header_extra["header"])
        header_extra["header"]["label"] = "nope"
        reject(self.mod.canonical_fixture(header_extra).encode("utf-8"))

        missing = dict(parsed)
        del missing["tag"]
        reject(self.mod.canonical_fixture(missing).encode("utf-8"))

        version = json.loads(wire.decode("utf-8"))
        version["header"] = dict(version["header"])
        version["header"]["version"] = True
        reject(self.mod.canonical_fixture(version).encode("utf-8"))

        kind = json.loads(wire.decode("utf-8"))
        kind["header"] = dict(kind["header"])
        kind["header"]["kind"] = "Snapshot"
        reject(self.mod.canonical_fixture(kind).encode("utf-8"))

        padded = json.loads(wire.decode("utf-8"))
        padded["header"] = dict(padded["header"])
        padded["header"]["nonce"] = padded["header"]["nonce"] + "="
        reject(self.mod.canonical_fixture(padded).encode("utf-8"))

        plus = json.loads(wire.decode("utf-8"))
        plus["header"] = dict(plus["header"])
        plus["header"]["vaultId"] = "+" * len(plus["header"]["vaultId"])
        reject(self.mod.canonical_fixture(plus).encode("utf-8"))

        duplicate = wire.replace(b'{"ciphertext":', b'{"ciphertext":"AA","ciphertext":', 1)
        reject(duplicate)
        reject(b"\xff")
        reject(b"\xef\xbb\xbf" + wire)
        reject(b"")
        reject(b"{")
        reject(b"null")
        reject(b"[]")
        reject(wire + b"\n0")
        reject(b"[" * 40 + b"]" * 40)

        with self.assertRaises(self.mod.FormatVectorError) as caught:
            self.mod.decode_wire(root, vector["expected"]["wireUtf8"])
        self.assertEqual(str(caught.exception), "malformed input")
        with self.assertRaises(self.mod.FormatVectorError) as caught:
            self.mod.decode_wire(root[:-1], wire)
        self.assertEqual(str(caught.exception), "malformed input")

    def test_decode_wire_rejects_noncanonical_base64url_pad_bits(self):
        vector, root, wire = self._root_and_wire()
        parsed = json.loads(wire.decode("utf-8"))
        valid = parsed["header"]["vaultId"]
        last = B64URL_ALPHABET.index(valid[-1])
        bad_last = last | 0x01
        if bad_last == last:
            bad_last = last | 0x02
        parsed["header"] = dict(parsed["header"])
        parsed["header"]["vaultId"] = valid[:-1] + B64URL_ALPHABET[bad_last]
        raw = self.mod.canonical_fixture(parsed).encode("utf-8")
        with self.assertRaises(self.mod.FormatVectorError) as caught:
            self.mod.decode_wire(root, raw)
        self.assertEqual(str(caught.exception), "malformed wire")

    def test_ceilings_match_the_draft_profile(self):
        self.assertEqual(self.mod.MAX_WIRE_BYTES, 24 * 1024 * 1024)
        self.assertEqual(self.mod.MAX_PLAINTEXT_BYTES, 16 * 1024 * 1024)
        self.assertEqual(self.mod.MAX_CIPHERTEXT_CHARS, 22369622)
        self.assertEqual(
            self.mod.MAX_CIPHERTEXT_CHARS,
            (self.mod.MAX_PLAINTEXT_BYTES * 8 + 5) // 6,
        )
        self.assertEqual(self.mod.MAX_HEADER_BYTES, 4096)
        self.assertEqual(self.mod.MAX_NESTING, 32)
        vector, root, wire = self._root_and_wire()
        original = self.mod.MAX_WIRE_BYTES
        self.mod.MAX_WIRE_BYTES = len(wire) - 1
        try:
            with self.assertRaises(self.mod.FormatVectorError) as caught:
                self.mod.decode_wire(root, wire)
            self.assertEqual(str(caught.exception), "malformed wire")
        finally:
            self.mod.MAX_WIRE_BYTES = original
        self.assertEqual(
            self.mod.decode_wire(root, wire),
            vector["expected"]["payloadUtf8"].encode("utf-8"),
        )

    def test_verify_fixture_compares_fields_and_decodes_both_wires(self):
        calls = []
        original = self.mod.decode_wire

        def wrapped(secret_root, wire_bytes):
            calls.append((secret_root, wire_bytes))
            return original(secret_root, wire_bytes)

        self.mod.decode_wire = wrapped
        try:
            mismatches = self.mod.verify_fixture(FIXTURE_PATH)
        finally:
            self.mod.decode_wire = original
        self.assertEqual(mismatches, [])
        vector = self.mod.build_vector()
        node = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        python_wire = vector["expected"]["wireUtf8"].encode("utf-8")
        node_wire = node["expected"]["wireUtf8"].encode("utf-8")
        seen = {call[1] for call in calls}
        self.assertIn(python_wire, seen)
        self.assertIn(node_wire, seen)
        self.assertGreaterEqual(len(calls), 2)
        root = bytes.fromhex(vector["inputs"]["secretRootHex"])
        self.assertTrue(all(call[0] == root for call in calls))

    def test_verify_fixture_reports_field_names_without_secret_values(self):
        node = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        node["expected"]["tagHex"] = "0" * 32
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "tampered-format-vector.json"
            target.write_text(json.dumps(node), encoding="utf-8")
            mismatches = self.mod.verify_fixture(target)
        self.assertIn("expected.tagHex", mismatches)
        rendered = " ".join(mismatches)
        self.assertNotIn(node["inputs"]["secretRootHex"], rendered)
        self.assertNotIn("PUBLIC SYNTHETIC TEST DATA", rendered)
        self.assertNotIn(node["expected"]["prkHex"], rendered)

    def test_verify_fixture_rejects_boolean_version(self):
        node = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        self.assertIs(type(node["inputs"]["header"]["version"]), int)
        self.assertEqual(node["inputs"]["header"]["version"], 1)
        node["inputs"]["header"]["version"] = True
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "tampered-version.json"
            target.write_text(json.dumps(node), encoding="utf-8")
            mismatches = self.mod.verify_fixture(target)
        self.assertIn("inputs.header", mismatches)
        rendered = " ".join(mismatches)
        self.assertNotIn(node["inputs"]["secretRootHex"], rendered)
        self.assertNotIn("PUBLIC SYNTHETIC TEST DATA", rendered)
        self.assertNotIn("expected.wireUtf8", mismatches)

    def test_cli_emit_and_verify(self):
        emit = subprocess.run(
            [sys.executable, str(MODULE_PATH), "--emit"],
            cwd=REPO_ROOT,
            capture_output=True,
            check=False,
        )
        self.assertEqual(emit.returncode, 0, emit.stderr)
        self.assertEqual(emit.stderr, b"")
        self.assertTrue(emit.stdout.endswith(b"\n"))
        self.assertEqual(json.loads(emit.stdout.decode("utf-8")), self.mod.build_vector())
        fixture = FIXTURE_PATH.read_bytes()
        self.assertEqual(emit.stdout, fixture)

        verified = subprocess.run(
            [sys.executable, str(MODULE_PATH), "--verify", "fixtures/wpp-v1-vectors.json"],
            cwd=REPO_ROOT,
            capture_output=True,
            check=False,
        )
        self.assertEqual(verified.returncode, 0, verified.stderr)
        self.assertEqual(verified.stdout, b"verified\n")
        self.assertEqual(verified.stderr, b"")

        node = json.loads(fixture.decode("utf-8"))
        node["expected"]["wireSha256"] = "0" * 64
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "tampered-format-vector.json"
            target.write_text(json.dumps(node), encoding="utf-8")
            failed = subprocess.run(
                [sys.executable, str(MODULE_PATH), "--verify", str(target)],
                cwd=REPO_ROOT,
                capture_output=True,
                check=False,
            )
        self.assertNotEqual(failed.returncode, 0)
        combined = failed.stdout + failed.stderr
        self.assertNotIn(b"PUBLIC SYNTHETIC TEST DATA", combined)
        self.assertNotIn(node["inputs"]["secretRootHex"].encode("ascii"), combined)
        self.assertNotIn(b"Traceback", combined)
        self.assertIn(b"verification failed: expected.wireSha256", failed.stderr)

        missing = subprocess.run(
            [sys.executable, str(MODULE_PATH), "--verify", "fixtures/missing-vector.json"],
            cwd=REPO_ROOT,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(missing.returncode, 0)
        self.assertNotIn(b"Traceback", missing.stderr)

        usage = subprocess.run(
            [sys.executable, str(MODULE_PATH)],
            cwd=REPO_ROOT,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(usage.returncode, 0)

    def test_import_does_not_write_stdio_or_files(self):
        probe = (
            "import importlib.util, sys\n"
            f"path = {str(MODULE_PATH)!r}\n"
            "spec = importlib.util.spec_from_file_location('format_vectors_python_silent', path)\n"
            "module = importlib.util.module_from_spec(spec)\n"
            "spec.loader.exec_module(module)\n"
        )
        completed = subprocess.run(
            [sys.executable, "-c", probe],
            cwd=REPO_ROOT,
            capture_output=True,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(completed.stdout, b"")
        self.assertEqual(completed.stderr, b"")


if __name__ == "__main__":
    unittest.main()
