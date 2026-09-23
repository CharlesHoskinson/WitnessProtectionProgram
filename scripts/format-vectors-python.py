"""Independent Python encoder and decoder for one public synthetic WPP vector.

This is restricted M0 fixture evidence for the draft-v1 witness package. It is
not a production parser, not a general RFC 8785 implementation, and not a
Midnight native-export implementation. Synthetic inputs are public test data.
Do not use them in a real application.

`build_vector` computes the vector from those inputs. It does not call Node
and it does not read the Node fixture. `verify_fixture` performs that
comparison afterward.

The accepted domain is printable ASCII text, booleans, null, safe integers
other than negative zero, plain lists, and plain dicts. Python canonical
fixture encoding rejects nesting deeper than 32 levels. AES-256-GCM uses the
pinned `cryptography==46.0.5` AESGCM class. HKDF, hashes, JSON, and base64url
use the Python standard library. Child keys use HKDF-Expand only.

`decode_wire` accepts insignificant outer whitespace, reordered outer
members, and a trailing newline when the JSON stays strict and closed.
Duplicate keys, invalid UTF-8, malformed encodings, and unknown fields stay
rejected. A header `version` token is the integer 1 only when its exact
decimal value is 1 and the token has at most 64 characters. `1`, `1.0`,
`1e0`, and `10e-1` are accepted examples. `1.0000000000000001` and
`0.99999999999999999` are rejected. The AES-GCM AAD is the canonical header
byte string, which keeps the token `1`. It is not the exact outer wire text.
Nonfinite numbers, numbers outside the safe integer range, and boolean
`true` are rejected as a version. A numeric token longer than 64 characters
is rejected before `Decimal` or a large `int` is built. Emitted wires stay
canonical. Their SHA-256 is taken over those exact emitted bytes. Ciphertext
text longer than 22369622 characters is rejected before base64url decoding.
Decoded ciphertext longer than 16 MiB is rejected before AES-GCM. After
authentication, plaintext longer than 16 MiB is rejected. This decoder does
not parse payload metadata and does not enforce the 64 KiB metadata ceiling.

`fixtures/wpp-v1-wire-corpus.json` is the shared accept/reject corpus.
Error code classes can differ across parsers. This corpus is not an M0
format freeze, metadata validation, or production cryptographic approval.
"""

import argparse
import base64
import binascii
import hashlib
import hmac
import json
import sys
from decimal import Decimal, InvalidOperation, Overflow
from importlib.metadata import version
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


if version("cryptography") != "46.0.5":
    raise RuntimeError("cryptography pin mismatch")

MAX_SAFE_INTEGER = 9007199254740991
MAX_NUMBER_TOKEN_CHARS = 64
MAX_WIRE_BYTES = 24 * 1024 * 1024
MAX_PLAINTEXT_BYTES = 16 * 1024 * 1024
MAX_CIPHERTEXT_CHARS = (MAX_PLAINTEXT_BYTES * 8 + 5) // 6
MAX_HEADER_BYTES = 4096
MAX_NESTING = 32
PRINTABLE_ASCII_MIN = 0x20
PRINTABLE_ASCII_MAX = 0x7E
B64URL_ALPHABET = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
)
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
INPUT_FIELDS = ("secretRootHex", "header", "payload")
EXPECTED_FIELDS = (
    "prkHex",
    "scopeKeyHex",
    "objectKeyHex",
    "nativeKeyHex",
    "nativeExportPassword",
    "headerUtf8",
    "headerHex",
    "payloadUtf8",
    "payloadHex",
    "ciphertextHex",
    "tagHex",
    "wireUtf8",
    "wireSha256",
)
PROFILE = "wpp-draft-v1-synthetic-vector"


class FormatVectorError(Exception):
    """Static fixture failure. Messages must stay free of secret material."""


def _reject_canonical():
    raise FormatVectorError("canonical encoding rejected")


def _printable_ascii(value):
    return all(PRINTABLE_ASCII_MIN <= ord(char) <= PRINTABLE_ASCII_MAX for char in value)


def canonical_fixture(value):
    """Return compact canonical JSON for the restricted fixture domain."""
    return _encode(value, 1, set())


def _encode(value, depth, stack):
    if value is None:
        return "null"
    value_type = type(value)
    if value_type is bool:
        return "true" if value else "false"
    if value_type is int:
        if value < -MAX_SAFE_INTEGER or value > MAX_SAFE_INTEGER:
            _reject_canonical()
        return json.dumps(value)
    if value_type is str:
        if not _printable_ascii(value):
            _reject_canonical()
        return json.dumps(value, ensure_ascii=True)
    if value_type is list:
        return _encode_list(value, depth, stack)
    if value_type is dict:
        return _encode_dict(value, depth, stack)
    _reject_canonical()


def _encode_list(value, depth, stack):
    if depth > MAX_NESTING or id(value) in stack:
        _reject_canonical()
    stack.add(id(value))
    try:
        encoded = [_encode(item, depth + 1, stack) for item in value]
    finally:
        stack.remove(id(value))
    return "[" + ",".join(encoded) + "]"


def _encode_dict(value, depth, stack):
    if depth > MAX_NESTING or id(value) in stack:
        _reject_canonical()
    keys = list(value)
    for key in keys:
        if type(key) is not str or not _printable_ascii(key):
            _reject_canonical()
    stack.add(id(value))
    try:
        encoded = []
        for key in sorted(keys):
            encoded.append(
                json.dumps(key, ensure_ascii=True) + ":" + _encode(value[key], depth + 1, stack)
            )
    finally:
        stack.remove(id(value))
    return "{" + ",".join(encoded) + "}"


def hkdf_expand32(parent_key, info):
    """Return one RFC 5869 HKDF-Expand block of 32 bytes.

    The operation is HMAC-SHA256(parent_key, info || 0x01). It does not Extract.
    """
    if type(parent_key) is not bytes or len(parent_key) != 32:
        raise FormatVectorError("hkdf expand rejected")
    if type(info) is not bytes:
        raise FormatVectorError("hkdf expand rejected")
    return hmac.new(parent_key, info + b"\x01", hashlib.sha256).digest()


def _hkdf_extract(salt, ikm):
    return hmac.new(salt, ikm, hashlib.sha256).digest()


def _b64url_encode(data):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(text, exact_len=None):
    if type(text) is not str or any(char not in B64URL_ALPHABET for char in text):
        raise FormatVectorError("malformed wire")
    if exact_len is not None and len(text) != (exact_len * 8 + 5) // 6:
        raise FormatVectorError("malformed wire")
    if text == "":
        decoded = b""
    else:
        pad = "=" * ((4 - len(text) % 4) % 4)
        try:
            decoded = base64.urlsafe_b64decode(text + pad)
        except (ValueError, binascii.Error):
            raise FormatVectorError("malformed wire") from None
    if exact_len is not None and len(decoded) != exact_len:
        raise FormatVectorError("malformed wire")
    if _b64url_encode(decoded) != text:
        raise FormatVectorError("malformed wire")
    return decoded


def _synthetic_bytes(start, length):
    return bytes(range(start, start + length))


def build_vector():
    """Return the deterministic public synthetic draft-v1 vector.

    Dict insertion order follows the published fixture object order.
    """
    secret_root = _synthetic_bytes(0, 32)
    vault_salt = _synthetic_bytes(32, 32)
    vault_id = _synthetic_bytes(64, 16)
    root_epoch = _synthetic_bytes(80, 16)
    scope_id = _synthetic_bytes(96, 32)
    record_id = _synthetic_bytes(128, 32)
    generation_id = _synthetic_bytes(160, 32)
    nonce = _synthetic_bytes(192, 12)

    header = {
        "format": "wpp-witness-package",
        "version": 1,
        "suite": "HKDF-SHA256+A256GCM",
        "vaultId": _b64url_encode(vault_id),
        "vaultSalt": _b64url_encode(vault_salt),
        "rootEpoch": _b64url_encode(root_epoch),
        "scopeId": _b64url_encode(scope_id),
        "recordId": _b64url_encode(record_id),
        "generationId": _b64url_encode(generation_id),
        "kind": "snapshot",
        "nonce": _b64url_encode(nonce),
    }
    payload = {
        "payloadVersion": 1,
        "metadata": {
            "network": {"id": "synthetic-local", "genesisHash": None},
            "accountBinding": {"scheme": "synthetic-fixture", "value": "fixture-account"},
            "applicationId": "wpp-vector-fixture",
            "contract": {"address": "synthetic-contract", "codeHash": None},
            "privateStateIds": ["fixture-state"],
            "codec": {
                "id": "wpp.synthetic-vector",
                "version": 1,
                "producerPackage": "wpp-format-vectors",
                "producerVersion": "0.1.0",
                "sourceCommit": "0" * 40,
            },
            "capturedAt": "2026-09-19T00:00:00Z",
            "lifecycle": {"status": "unassociated", "transactionId": None, "blockHash": None},
            "parents": [],
            "retentionClass": "retained-application-witness",
        },
        "content": {
            "counter": "12345678901234567890",
            "bytes": "AAECAw",
            "message": "PUBLIC SYNTHETIC TEST DATA",
        },
    }

    prk = _hkdf_extract(vault_salt, secret_root)
    scope_key = hkdf_expand32(
        prk,
        canonical_fixture(
            ["WPP", "1", "scope", header["vaultId"], header["rootEpoch"], header["scopeId"]]
        ).encode("utf-8"),
    )
    object_key = hkdf_expand32(
        scope_key,
        canonical_fixture(
            ["WPP", "1", "object", header["kind"], header["recordId"], header["generationId"]]
        ).encode("utf-8"),
    )
    native_key = hkdf_expand32(
        scope_key,
        canonical_fixture(
            ["WPP", "1", "native-export-password", header["recordId"], header["generationId"]]
        ).encode("utf-8"),
    )
    header_utf8 = canonical_fixture(header)
    payload_utf8 = canonical_fixture(payload)
    sealed = AESGCM(object_key).encrypt(nonce, payload_utf8.encode("utf-8"), header_utf8.encode("utf-8"))
    ciphertext = sealed[:-16]
    tag = sealed[-16:]
    wire = {
        "header": header,
        "ciphertext": _b64url_encode(ciphertext),
        "tag": _b64url_encode(tag),
    }
    wire_utf8 = canonical_fixture(wire)
    return {
        "profile": PROFILE,
        "inputs": {
            "secretRootHex": secret_root.hex(),
            "header": header,
            "payload": payload,
        },
        "expected": {
            "prkHex": prk.hex(),
            "scopeKeyHex": scope_key.hex(),
            "objectKeyHex": object_key.hex(),
            "nativeKeyHex": native_key.hex(),
            "nativeExportPassword": _b64url_encode(native_key),
            "headerUtf8": header_utf8,
            "headerHex": header_utf8.encode("utf-8").hex(),
            "payloadUtf8": payload_utf8,
            "payloadHex": payload_utf8.encode("utf-8").hex(),
            "ciphertextHex": ciphertext.hex(),
            "tagHex": tag.hex(),
            "wireUtf8": wire_utf8,
            "wireSha256": hashlib.sha256(wire_utf8.encode("utf-8")).hexdigest(),
        },
    }


def _reject_duplicate_pairs(pairs):
    obj = {}
    for key, item in pairs:
        if type(key) is not str or key in obj:
            raise FormatVectorError("malformed wire")
        obj[key] = item
    return obj


def _integer_token(text):
    return int(text, 10)


def _decimal_value(text):
    return Decimal(text)


def _reject_long_number_token(text):
    if type(text) is not str or len(text) > MAX_NUMBER_TOKEN_CHARS:
        raise FormatVectorError("malformed wire")


def _parse_int(text):
    _reject_long_number_token(text)
    try:
        value = _integer_token(text)
    except (TypeError, ValueError):
        raise FormatVectorError("malformed wire") from None
    if value < -MAX_SAFE_INTEGER or value > MAX_SAFE_INTEGER:
        raise FormatVectorError("malformed wire")
    return value


def _reject_non_integer(_text):
    raise FormatVectorError("malformed wire")


def _parse_exact_safe_integer(text):
    """Return the integer value of one JSON number token.

    Decimal digits are kept. ``float`` is not used. A fractional token cannot
    round to an integer, and a huge exponent cannot overflow to infinity.
    Tokens longer than ``MAX_NUMBER_TOKEN_CHARS`` fail before ``Decimal``.
    """
    _reject_long_number_token(text)
    try:
        decimal_value = _decimal_value(text)
    except (InvalidOperation, Overflow, ValueError):
        raise FormatVectorError("malformed wire") from None
    if not decimal_value.is_finite():
        raise FormatVectorError("malformed wire")
    _sign, digits, exponent = decimal_value.as_tuple()
    if type(exponent) is not int:
        raise FormatVectorError("malformed wire")
    if exponent >= 0:
        integer_length = len(digits) + exponent
    else:
        fraction_length = -exponent
        fraction_digits = digits[max(0, len(digits) - fraction_length) :]
        if any(digit != 0 for digit in fraction_digits):
            raise FormatVectorError("malformed wire")
        integer_length = len(digits) - fraction_length
        if integer_length < 0:
            integer_length = 0
    if integer_length > 16:
        raise FormatVectorError("malformed wire")
    if integer_length == 0:
        return 0
    try:
        value = int(decimal_value)
    except (InvalidOperation, Overflow, ValueError):
        raise FormatVectorError("malformed wire") from None
    if value < -MAX_SAFE_INTEGER or value > MAX_SAFE_INTEGER:
        raise FormatVectorError("malformed wire")
    return value


def _assert_nesting(text):
    depth = 0
    in_string = False
    escape = False
    for char in text:
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
            continue
        if char in "{[":
            depth += 1
            if depth > MAX_NESTING:
                raise FormatVectorError("malformed wire")
        elif char in "}]":
            depth -= 1
            if depth < 0:
                raise FormatVectorError("malformed wire")


def _parse_wire_json(wire_bytes):
    if len(wire_bytes) == 0 or len(wire_bytes) > MAX_WIRE_BYTES:
        raise FormatVectorError("malformed wire")
    try:
        text = wire_bytes.decode("utf-8")
    except UnicodeError:
        raise FormatVectorError("malformed wire") from None
    _assert_nesting(text)
    try:
        parsed = json.loads(
            text,
            object_pairs_hook=_reject_duplicate_pairs,
            parse_int=_parse_int,
            parse_float=_parse_exact_safe_integer,
            parse_constant=_reject_non_integer,
        )
        canonical_fixture(parsed)
    except FormatVectorError:
        raise FormatVectorError("malformed wire") from None
    except (UnicodeError, json.JSONDecodeError, RecursionError, ValueError):
        raise FormatVectorError("malformed wire") from None
    return parsed


def _require_exact_keys(value, keys):
    if type(value) is not dict or tuple(sorted(value)) != keys:
        raise FormatVectorError("malformed wire")


def _require_literal(value, expected):
    if type(value) is not str or value != expected:
        raise FormatVectorError("malformed wire")


def _validated_header(header):
    _require_exact_keys(header, HEADER_KEYS)
    _require_literal(header["format"], "wpp-witness-package")
    if type(header["version"]) is not int or header["version"] != 1:
        raise FormatVectorError("malformed wire")
    _require_literal(header["suite"], "HKDF-SHA256+A256GCM")
    if header["kind"] not in ("snapshot", "catalog"):
        raise FormatVectorError("malformed wire")
    decoded = {
        "vaultId": _b64url_decode(header["vaultId"], 16),
        "rootEpoch": _b64url_decode(header["rootEpoch"], 16),
        "vaultSalt": _b64url_decode(header["vaultSalt"], 32),
        "scopeId": _b64url_decode(header["scopeId"], 32),
        "recordId": _b64url_decode(header["recordId"], 32),
        "generationId": _b64url_decode(header["generationId"], 32),
        "nonce": _b64url_decode(header["nonce"], 12),
    }
    return decoded


def decode_wire(secret_root, wire_bytes):
    """Authenticate one closed draft wire and return plaintext bytes.

    Insignificant outer whitespace, reordered outer members, and a trailing
    newline are accepted. Duplicate keys, invalid UTF-8, malformed encodings,
    and unknown fields are rejected. A header version token becomes the
    integer 1 only when its exact decimal value is 1 and it has at most 64
    characters. ``1``, ``1.0``, ``1e0``, and ``10e-1`` are accepted examples.
    Keys come from the header
    fields and `secret_root`. The AES-GCM AAD is the canonical header byte
    string, not the exact outer wire text. Ciphertext text longer than
    22369622 characters is rejected before base64url decoding. Decoded
    ciphertext longer than 16 MiB is rejected before AES-GCM. Plaintext is
    returned only after the tag check succeeds. Plaintext longer than 16 MiB
    is rejected after that check.
    """
    if type(secret_root) is not bytes or len(secret_root) != 32 or type(wire_bytes) is not bytes:
        raise FormatVectorError("malformed input")
    parsed = _parse_wire_json(wire_bytes)
    _require_exact_keys(parsed, WIRE_KEYS)
    ciphertext_text = parsed["ciphertext"]
    if type(ciphertext_text) is not str or len(ciphertext_text) > MAX_CIPHERTEXT_CHARS:
        raise FormatVectorError("malformed wire")
    header = parsed["header"]
    decoded = _validated_header(header)
    try:
        header_text = canonical_fixture(header)
    except FormatVectorError:
        raise FormatVectorError("malformed wire") from None
    header_bytes = header_text.encode("utf-8")
    if len(header_bytes) > MAX_HEADER_BYTES:
        raise FormatVectorError("malformed wire")
    ciphertext = _b64url_decode(ciphertext_text)
    if len(ciphertext) > MAX_PLAINTEXT_BYTES:
        raise FormatVectorError("malformed wire")
    tag = _b64url_decode(parsed["tag"], 16)
    scope_key = hkdf_expand32(
        _hkdf_extract(decoded["vaultSalt"], secret_root),
        canonical_fixture(
            ["WPP", "1", "scope", header["vaultId"], header["rootEpoch"], header["scopeId"]]
        ).encode("utf-8"),
    )
    object_key = hkdf_expand32(
        scope_key,
        canonical_fixture(
            ["WPP", "1", "object", header["kind"], header["recordId"], header["generationId"]]
        ).encode("utf-8"),
    )
    try:
        plaintext = AESGCM(object_key).decrypt(decoded["nonce"], ciphertext + tag, header_bytes)
    except InvalidTag:
        raise FormatVectorError("authentication failed") from None
    except ValueError:
        raise FormatVectorError("malformed wire") from None
    if len(plaintext) > MAX_PLAINTEXT_BYTES:
        raise FormatVectorError("plaintext ceiling exceeded")
    return plaintext


def _lookup(document, *parts):
    current = document
    for part in parts:
        if type(current) is not dict or part not in current:
            return False, None
        current = current[part]
    return True, current


def _same_fixture_value(left, right):
    """Return true only when both values have the same canonical fixture text.

    Boolean true and integer 1 are different. Values outside the fixture
    domain do not match.
    """
    try:
        return canonical_fixture(left) == canonical_fixture(right)
    except FormatVectorError:
        return False


def verify_fixture(path):
    """Compare `build_vector()` with a Node fixture and decode both wires.

    Comparison uses canonical fixture text, so boolean true does not match
    integer 1. Return a list of public field names that differ. An empty list
    means the vectors agree and both wires authenticate.
    """
    python_vector = build_vector()
    mismatches = []
    try:
        raw = Path(path).read_bytes()
        node = json.loads(
            raw.decode("utf-8"),
            object_pairs_hook=_reject_duplicate_pairs,
            parse_int=_parse_int,
            parse_float=_reject_non_integer,
            parse_constant=_reject_non_integer,
        )
    except (OSError, UnicodeError, json.JSONDecodeError, RecursionError, ValueError, FormatVectorError):
        return ["fixture"]

    if type(node) is not dict or set(node) != {"profile", "inputs", "expected"}:
        mismatches.append("fixture.extra")
    present, profile = _lookup(node, "profile")
    if not present or not _same_fixture_value(profile, python_vector["profile"]):
        mismatches.append("profile")

    present, inputs = _lookup(node, "inputs")
    if not present or type(inputs) is not dict or set(inputs) != set(INPUT_FIELDS):
        mismatches.append("fixture.extra")
    for name in INPUT_FIELDS:
        present, value = _lookup(node, "inputs", name)
        if not present or not _same_fixture_value(value, python_vector["inputs"][name]):
            mismatches.append("inputs." + name)

    present, expected = _lookup(node, "expected")
    if not present or type(expected) is not dict or set(expected) != set(EXPECTED_FIELDS):
        mismatches.append("fixture.extra")
    for name in EXPECTED_FIELDS:
        present, value = _lookup(node, "expected", name)
        if not present or not _same_fixture_value(value, python_vector["expected"][name]):
            mismatches.append("expected." + name)

    root = bytes.fromhex(python_vector["inputs"]["secretRootHex"])
    python_plain = _decode_named(root, python_vector["expected"]["wireUtf8"].encode("utf-8"))
    if python_plain != python_vector["expected"]["payloadUtf8"].encode("utf-8"):
        mismatches.append("decode.python")

    present, node_wire = _lookup(node, "expected", "wireUtf8")
    if not present or type(node_wire) is not str:
        mismatches.append("decode.node")
    else:
        try:
            node_bytes = node_wire.encode("utf-8")
        except UnicodeError:
            mismatches.append("decode.node")
        else:
            node_plain = _decode_named(root, node_bytes)
            if node_plain != python_vector["expected"]["payloadUtf8"].encode("utf-8"):
                mismatches.append("decode.node")
    return mismatches


def _decode_named(secret_root, wire_bytes):
    try:
        return decode_wire(secret_root, wire_bytes)
    except FormatVectorError:
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(prog="format-vectors-python")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--emit", action="store_true")
    group.add_argument("--verify", metavar="PATH")
    args = parser.parse_args(argv)
    if args.emit:
        sys.stdout.write(json.dumps(build_vector(), indent=2) + "\n")
        return 0
    mismatches = verify_fixture(args.verify)
    if mismatches:
        for name in mismatches:
            print("verification failed: " + name, file=sys.stderr)
        return 1
    sys.stdout.write("verified\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
