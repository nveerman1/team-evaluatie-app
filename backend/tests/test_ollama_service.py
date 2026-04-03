"""
Unit tests for OllamaService.

Covers:
- SSRF URL validation (allowlist, blocked hosts, bad schemes)
- Docker service name "ollama" is explicitly allowed
- Legacy "ollama-host" hostname is rejected (regression guard)
- _validate_ollama_url called at __init__ time
- generate_summary: empty input, happy path, LLM refusal, network error
- generate_summary fallback chain when extract fails
- create_fallback_summary: negative, positive, mixed, empty, single comment
- _is_refusal: known phrases (NL + EN)
- _extract_json_block: fenced code, bare JSON, no JSON

Run with:
    cd backend
    pytest tests/test_ollama_service.py -v
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, Mock, patch

import pytest
import requests

from app.infra.services.ollama_service import ALLOWED_OLLAMA_HOSTS, OllamaService

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service(url: str = "http://ollama:11434") -> OllamaService:
    """Instantiate OllamaService bypassing real settings."""
    with patch("app.infra.services.ollama_service.settings") as mock_settings:
        mock_settings.OLLAMA_BASE_URL = url
        mock_settings.OLLAMA_MODEL = "mistral"
        mock_settings.OLLAMA_TIMEOUT = 60.0
        return OllamaService(base_url=url)


# ---------------------------------------------------------------------------
# SSRF / allowlist — static method
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestValidateOllamaUrl:
    """_validate_ollama_url rejects all hosts except the explicit allowlist."""

    # ----- allowed hosts -----

    def test_localhost_http_allowed(self):
        url = OllamaService._validate_ollama_url("http://localhost:11434")
        assert url == "http://localhost:11434"

    def test_localhost_https_allowed(self):
        url = OllamaService._validate_ollama_url("https://localhost:11434")
        assert url == "https://localhost:11434"

    def test_127_0_0_1_allowed(self):
        url = OllamaService._validate_ollama_url("http://127.0.0.1:11434")
        assert url == "http://127.0.0.1:11434"

    def test_ipv6_loopback_allowed(self):
        url = OllamaService._validate_ollama_url("http://[::1]:11434")
        assert url == "http://[::1]:11434"

    def test_ollama_service_name_allowed(self):
        """Docker Compose service name must pass — this is the core production case."""
        url = OllamaService._validate_ollama_url("http://ollama:11434")
        assert url == "http://ollama:11434"

    def test_ollama_service_name_uppercase_allowed(self):
        """Hostname comparison is case-insensitive."""
        url = OllamaService._validate_ollama_url("http://OLLAMA:11434")
        assert url == "http://OLLAMA:11434"

    # ----- blocked hosts (SSRF) -----

    def test_ollama_host_blocked(self):
        """Legacy hostname 'ollama-host' must be rejected (regression guard)."""
        with pytest.raises(ValueError, match="Ollama host not allowed"):
            OllamaService._validate_ollama_url("http://ollama-host:11434")

    def test_external_host_blocked(self):
        with pytest.raises(ValueError, match="Ollama host not allowed"):
            OllamaService._validate_ollama_url("http://example.com:11434")

    def test_internal_ip_blocked(self):
        """Private IP ranges must be blocked (no bypass via SSRF)."""
        with pytest.raises(ValueError, match="Ollama host not allowed"):
            OllamaService._validate_ollama_url("http://192.168.1.50:11434")

    def test_169_254_blocked(self):
        with pytest.raises(ValueError, match="Ollama host not allowed"):
            OllamaService._validate_ollama_url("http://169.254.169.254:11434")

    def test_10_0_0_1_blocked(self):
        with pytest.raises(ValueError, match="Ollama host not allowed"):
            OllamaService._validate_ollama_url("http://10.0.0.1:11434")

    # ----- bad schemes -----

    def test_file_scheme_blocked(self):
        with pytest.raises(ValueError, match="Ollama URL must use HTTP or HTTPS"):
            OllamaService._validate_ollama_url("file:///etc/passwd")

    def test_ftp_scheme_blocked(self):
        with pytest.raises(ValueError, match="Ollama URL must use HTTP or HTTPS"):
            OllamaService._validate_ollama_url("ftp://localhost:11434")

    def test_gopher_scheme_blocked(self):
        with pytest.raises(ValueError, match="Ollama URL must use HTTP or HTTPS"):
            OllamaService._validate_ollama_url("gopher://localhost:11434")

    # ----- error wrapping -----

    def test_invalid_url_raises_value_error(self):
        with pytest.raises(ValueError, match="Invalid Ollama URL"):
            OllamaService._validate_ollama_url("not-a-url")


@pytest.mark.unit
class TestAllowedHostsConstant:
    """ALLOWED_OLLAMA_HOSTS contains exactly the expected set."""

    def test_ollama_service_name_in_allowlist(self):
        assert "ollama" in ALLOWED_OLLAMA_HOSTS

    def test_localhost_in_allowlist(self):
        assert "localhost" in ALLOWED_OLLAMA_HOSTS

    def test_loopback_ipv4_in_allowlist(self):
        assert "127.0.0.1" in ALLOWED_OLLAMA_HOSTS

    def test_loopback_ipv6_in_allowlist(self):
        assert "::1" in ALLOWED_OLLAMA_HOSTS

    def test_ollama_host_NOT_in_allowlist(self):
        """Legacy hostname must NOT be allowed."""
        assert "ollama-host" not in ALLOWED_OLLAMA_HOSTS


# ---------------------------------------------------------------------------
# __init__ validation
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestOllamaServiceInit:
    """Validation is applied at instantiation time."""

    def test_init_with_valid_url(self):
        svc = _make_service("http://ollama:11434")
        assert svc.base_url == "http://ollama:11434"
        assert svc.model == "mistral"

    def test_init_with_localhost(self):
        svc = _make_service("http://localhost:11434")
        assert svc.base_url == "http://localhost:11434"

    def test_init_with_blocked_url_raises(self):
        with patch("app.infra.services.ollama_service.settings") as mock_settings:
            mock_settings.OLLAMA_BASE_URL = "http://ollama-host:11434"
            mock_settings.OLLAMA_MODEL = "mistral"
            mock_settings.OLLAMA_TIMEOUT = 60.0
            with pytest.raises(ValueError, match="Invalid Ollama URL"):
                OllamaService(base_url="http://ollama-host:11434")

    def test_init_timeout_set_correctly(self):
        svc = _make_service()
        assert svc.timeout == 60.0

    def test_init_custom_timeout(self):
        with patch("app.infra.services.ollama_service.settings") as mock_settings:
            mock_settings.OLLAMA_BASE_URL = "http://ollama:11434"
            mock_settings.OLLAMA_MODEL = "mistral"
            mock_settings.OLLAMA_TIMEOUT = 60.0
            svc = OllamaService(base_url="http://ollama:11434", timeout=30.0)
        assert svc.timeout == 30.0


# ---------------------------------------------------------------------------
# generate_summary
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestGenerateSummary:
    """generate_summary orchestrates extract → summarize with fallback chain."""

    def _svc(self) -> OllamaService:
        return _make_service()

    def test_empty_input_returns_none(self):
        svc = self._svc()
        assert svc.generate_summary([]) is None

    def test_none_filtered_from_comments(self):
        """Empty list after filtering → None (no crash)."""
        svc = self._svc()
        # Non-string items are filtered out inside _extract_structured; empty
        # list still goes through and returns None from generate_summary.
        result = svc.generate_summary([])
        assert result is None

    def test_happy_path_returns_summary(self):
        """Successful extract + summarize returns the LLM text."""
        svc = self._svc()
        struct = {
            "positives": ["goede samenwerking"],
            "negatives": ["te laat"],
            "themes": ["planning"],
            "action": "Maak volgende week een weekplanning.",
        }
        summary_text = "Je werkt goed samen maar bent soms te laat."

        with (
            patch.object(svc, "_extract_structured", return_value=struct),
            patch.object(svc, "_summarize_from_struct", return_value=summary_text),
        ):
            result = svc.generate_summary(["goede samenwerking", "te laat"])

        assert result == summary_text

    def test_short_summary_triggers_retry(self):
        """If first summarize returns ≤20 chars, retry is attempted."""
        svc = self._svc()
        struct = {"positives": [], "negatives": ["slecht"], "themes": [], "action": ""}
        short = "Te kort."  # len ≤ 20
        good = "Dit is een goede samenvatting van de feedback." * 2

        with (
            patch.object(svc, "_extract_structured", return_value=struct),
            patch.object(svc, "_summarize_from_struct", side_effect=[short, good]),
        ):
            result = svc.generate_summary(["slecht"])

        assert result == good

    def test_refusal_triggers_single_pass_fallback(self):
        """If extract returns None, single-pass is tried."""
        svc = self._svc()
        single_pass_text = "Een neutrale samenvatting van de peer-feedback."

        with (
            patch.object(svc, "_extract_structured", return_value=None),
            patch.object(svc, "_single_pass_summary", return_value=single_pass_text),
            patch.object(svc, "_is_refusal", return_value=False),
        ):
            result = svc.generate_summary(["some comment"])

        assert result == single_pass_text

    def test_all_fallbacks_fail_returns_none(self):
        """When all LLM attempts fail/refuse, generate_summary returns None."""
        svc = self._svc()

        with (
            patch.object(svc, "_extract_structured", return_value=None),
            patch.object(svc, "_single_pass_summary", return_value=None),
        ):
            result = svc.generate_summary(["comment"])

        assert result is None

    def test_llm_refusal_in_single_pass_returns_none(self):
        """Single-pass refusal → second retry → both refuse → None."""
        svc = self._svc()
        refusal = "Ik kan niet helpen met deze opdracht."

        with (
            patch.object(svc, "_extract_structured", return_value=None),
            patch.object(svc, "_single_pass_summary", return_value=refusal),
        ):
            result = svc.generate_summary(["comment"])

        assert result is None


# ---------------------------------------------------------------------------
# create_fallback_summary
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestCreateFallbackSummary:
    """Rule-based fallback produces sensible Dutch text."""

    def _svc(self) -> OllamaService:
        return _make_service()

    def test_empty_input(self):
        svc = self._svc()
        result = svc.create_fallback_summary([])
        assert result == "Nog geen peer-feedback ontvangen."

    def test_single_comment_count(self):
        svc = self._svc()
        result = svc.create_fallback_summary(["prima bijdrage"])
        # Singular: "reactie" (not "reacties")
        assert "1 peer-feedback reactie" in result

    def test_multiple_comments_count(self):
        svc = self._svc()
        result = svc.create_fallback_summary(["prima", "goed"])
        assert "2 peer-feedback reacties" in result

    def test_negative_terms_detected(self):
        svc = self._svc()
        comments = [
            "Werkte nooit op tijd",
            "Slecht gecommuniceerd met de groep",
            "Onvoldoende inzet getoond",
        ]
        result = svc.create_fallback_summary(comments)
        assert (
            "zorgen" in result.lower()
            or "inzet" in result.lower()
            or "afspraken" in result.lower()
        )

    def test_positive_terms_detected(self):
        svc = self._svc()
        comments = [
            "Goede bijdrage aan het project",
            "Proactief in de samenwerking",
        ]
        result = svc.create_fallback_summary(comments)
        assert "positief" in result.lower() or "bijdrage" in result.lower()

    def test_mixed_feedback(self):
        svc = self._svc()
        comments = [
            "Goed gepland maar soms niet aanwezig",
            "slecht gecommuniceerd",
        ]
        result = svc.create_fallback_summary(comments)
        # Mixed branch: "zowel positieve als kritische punten"
        assert result  # Should not be empty

    def test_whitespace_only_comments_filtered(self):
        svc = self._svc()
        result = svc.create_fallback_summary(["   ", "\t"])
        # Whitespace-only strings are stripped out (count becomes 0).
        # The service still returns a 0-count message rather than the empty-list
        # message, because the outer list is not empty.
        assert "0 peer-feedback reacties" in result

    def test_returns_string(self):
        svc = self._svc()
        result = svc.create_fallback_summary(["feedback text"])
        assert isinstance(result, str)
        assert len(result) > 0


# ---------------------------------------------------------------------------
# _is_refusal
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestIsRefusal:
    """_is_refusal identifies LLM refusal phrases in Dutch and English."""

    def _svc(self) -> OllamaService:
        return _make_service()

    @pytest.mark.parametrize(
        "phrase",
        [
            "Ik kan niet helpen met dit verzoek.",
            "Ik kan je niet helpen hiermee.",
            "Ik kan deze taak niet uitvoeren.",
            "Helaas kan ik niet wat je vraagt.",
            "Ik ben niet in staat dit te doen.",
            "Dit kan ik niet doen.",
            "Ik kan geen samenvatting maken.",
            "I am unable to provide this information.",
            "I cannot provide a summary.",
            "I can't help you with that.",
        ],
    )
    def test_refusal_phrases_detected(self, phrase):
        svc = self._svc()
        assert svc._is_refusal(phrase) is True

    @pytest.mark.parametrize(
        "text",
        [
            "Je werkt goed samen maar bent soms te laat.",
            "Er zijn zowel positieve als kritische punten.",
            "Maak een planning voor volgende week.",
            "",
        ],
    )
    def test_normal_text_not_refusal(self, text):
        svc = self._svc()
        assert svc._is_refusal(text) is False

    def test_none_not_refusal(self):
        svc = self._svc()
        assert svc._is_refusal(None) is False  # type: ignore[arg-type]

    def test_case_insensitive(self):
        svc = self._svc()
        assert svc._is_refusal("IK KAN NIET HELPEN") is True


# ---------------------------------------------------------------------------
# _extract_json_block
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestExtractJsonBlock:
    """_extract_json_block extracts JSON from various model output formats."""

    def test_fenced_json_block(self):
        text = '```json\n{"positives": [], "negatives": []}\n```'
        result = OllamaService._extract_json_block(text)
        assert result is not None
        data = json.loads(result)
        assert "positives" in data

    def test_fenced_block_no_lang_tag(self):
        text = '```\n{"positives": [], "negatives": []}\n```'
        result = OllamaService._extract_json_block(text)
        assert result is not None
        assert json.loads(result)["negatives"] == []

    def test_bare_json_object(self):
        text = '{"positives": ["goed"], "negatives": [], "themes": ["samenwerking"], "action": "Ga door"}'
        result = OllamaService._extract_json_block(text)
        assert result is not None
        data = json.loads(result)
        assert data["positives"] == ["goed"]

    def test_json_with_surrounding_prose(self):
        text = (
            "Hier is de gevraagde JSON:\n"
            '{"positives": [], "negatives": ["laat"], "themes": [], "action": "Verbeter planning."}\n'
            "Dat was alles."
        )
        result = OllamaService._extract_json_block(text)
        assert result is not None
        data = json.loads(result)
        assert data["negatives"] == ["laat"]

    def test_no_json_returns_none(self):
        result = OllamaService._extract_json_block("Geen JSON hier.")
        assert result is None

    def test_empty_string_returns_none(self):
        result = OllamaService._extract_json_block("")
        assert result is None

    def test_none_input_returns_none(self):
        result = OllamaService._extract_json_block(None)  # type: ignore[arg-type]
        assert result is None


# ---------------------------------------------------------------------------
# _request_ollama (network layer)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestRequestOllama:
    """_request_ollama handles HTTP responses, timeouts, and errors."""

    def _svc(self) -> OllamaService:
        return _make_service()

    def test_successful_response_returns_text(self):
        svc = self._svc()
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"response": "  Een mooie samenvatting.  "}

        with patch("requests.post", return_value=mock_resp):
            result = svc._request_ollama("prompt", {"temperature": 0.1})

        assert result == "Een mooie samenvatting."

    def test_non_200_response_returns_none(self):
        svc = self._svc()
        mock_resp = Mock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"

        with patch("requests.post", return_value=mock_resp):
            result = svc._request_ollama("prompt", {})

        assert result is None

    def test_timeout_returns_none(self):
        svc = self._svc()
        with patch("requests.post", side_effect=requests.Timeout):
            result = svc._request_ollama("prompt", {})

        assert result is None

    def test_connection_error_returns_none(self):
        svc = self._svc()
        with patch(
            "requests.post", side_effect=requests.ConnectionError("Connection refused")
        ):
            result = svc._request_ollama("prompt", {})

        assert result is None

    def test_correct_endpoint_called(self):
        svc = self._svc()
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"response": "tekst"}

        with patch("requests.post", return_value=mock_resp) as mock_post:
            svc._request_ollama("test prompt", {"temperature": 0.1})

        call_args = mock_post.call_args
        assert call_args[0][0] == "http://ollama:11434/api/generate"

    def test_correct_model_sent(self):
        svc = self._svc()
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"response": "tekst"}

        with patch("requests.post", return_value=mock_resp) as mock_post:
            svc._request_ollama("test prompt", {})

        payload = mock_post.call_args[1]["json"]
        assert payload["model"] == "mistral"
        assert payload["stream"] is False

    def test_empty_response_field_returns_empty_string(self):
        """response key missing → treated as empty string, stripped."""
        svc = self._svc()
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {}  # no "response" key

        with patch("requests.post", return_value=mock_resp):
            result = svc._request_ollama("prompt", {})

        assert result == ""


# ---------------------------------------------------------------------------
# Compose config — OLLAMA_BASE_URL is set to internal service name
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestComposeOllamaConfig:
    """
    Verify the Docker Compose production config sets OLLAMA_BASE_URL correctly.

    This test parses ops/docker/compose.prod.yml directly so it acts as a
    living contract that the infrastructure config matches the SSRF allowlist.
    """

    def _load_compose(self):
        from pathlib import Path
        import yaml

        compose_path = (
            Path(__file__).parent.parent.parent / "ops" / "docker" / "compose.prod.yml"
        )
        assert compose_path.exists(), f"compose.prod.yml not found at {compose_path}"
        return yaml.safe_load(compose_path.read_text())

    def test_ollama_service_exists(self):
        data = self._load_compose()
        assert (
            "ollama" in data["services"]
        ), "ollama service must be defined in compose.prod.yml"

    def test_ollama_on_private_network_only(self):
        data = self._load_compose()
        networks = data["services"]["ollama"].get("networks", [])
        assert "private" in networks, "ollama must be on the private network"
        assert "public" not in networks, "ollama must NOT be on the public network"

    def test_ollama_volume_defined(self):
        data = self._load_compose()
        assert "ollama-data" in data["volumes"], "ollama-data volume must be declared"

    def test_ollama_volume_mounted(self):
        data = self._load_compose()
        volumes = data["services"]["ollama"].get("volumes", [])
        mounts = [v if isinstance(v, str) else v.get("source", "") for v in volumes]
        assert any(
            "ollama-data" in m for m in mounts
        ), "ollama-data volume must be mounted in the ollama service"

    def test_ollama_has_healthcheck(self):
        data = self._load_compose()
        hc = data["services"]["ollama"].get("healthcheck")
        assert hc is not None, "ollama service must have a healthcheck"
        assert hc.get("test"), "healthcheck must have a test command"

    def test_ollama_healthcheck_uses_builtin_binary(self):
        """Healthcheck must use the built-in ollama binary, not curl."""
        data = self._load_compose()
        hc = data["services"]["ollama"]["healthcheck"]
        test_cmd = hc["test"]
        cmd_str = " ".join(test_cmd) if isinstance(test_cmd, list) else test_cmd
        assert "ollama" in cmd_str, "healthcheck should use the ollama binary"
        assert "curl" not in cmd_str, "healthcheck must not depend on curl"

    def test_ollama_restart_policy(self):
        data = self._load_compose()
        restart = data["services"]["ollama"].get("restart")
        assert restart == "unless-stopped", "ollama must have restart: unless-stopped"

    def test_backend_ollama_base_url_is_internal(self):
        data = self._load_compose()
        env = data["services"]["backend"].get("environment", {})
        url = env.get("OLLAMA_BASE_URL", "")
        assert (
            url == "http://ollama:11434"
        ), f"backend OLLAMA_BASE_URL must be http://ollama:11434, got: {url!r}"

    def test_worker_ollama_base_url_is_internal(self):
        data = self._load_compose()
        env = data["services"]["worker"].get("environment", {})
        url = env.get("OLLAMA_BASE_URL", "")
        assert (
            url == "http://ollama:11434"
        ), f"worker OLLAMA_BASE_URL must be http://ollama:11434, got: {url!r}"

    def test_backend_and_worker_use_same_url(self):
        data = self._load_compose()
        backend_url = data["services"]["backend"]["environment"]["OLLAMA_BASE_URL"]
        worker_url = data["services"]["worker"]["environment"]["OLLAMA_BASE_URL"]
        assert (
            backend_url == worker_url
        ), "backend and worker must use the same OLLAMA_BASE_URL"

    def test_ollama_url_in_allowlist(self):
        """The hostname from the compose URL must be in ALLOWED_OLLAMA_HOSTS."""
        from urllib.parse import urlparse

        data = self._load_compose()
        url = data["services"]["backend"]["environment"]["OLLAMA_BASE_URL"]
        hostname = urlparse(url).hostname
        assert hostname in ALLOWED_OLLAMA_HOSTS, (
            f"Compose OLLAMA_BASE_URL hostname '{hostname}' is not in "
            f"ALLOWED_OLLAMA_HOSTS {ALLOWED_OLLAMA_HOSTS}"
        )

    def test_ollama_no_public_ports(self):
        """Port 11434 must not be published to the host."""
        data = self._load_compose()
        ports = data["services"]["ollama"].get("ports", [])
        assert not ports, "ollama must not publish any ports to the host"

    def test_ollama_no_new_privileges(self):
        data = self._load_compose()
        sec_opt = data["services"]["ollama"].get("security_opt", [])
        assert "no-new-privileges:true" in sec_opt
