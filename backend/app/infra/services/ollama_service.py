# app/services/ollama_service.py (drop-in vervanger)
from __future__ import annotations

import json
import logging
import re
import time
from typing import Optional
from urllib.parse import urlparse

import requests
from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed Ollama hosts (SSRF prevention)
ALLOWED_OLLAMA_HOSTS = ["localhost", "127.0.0.1", "::1", "ollama"]


class OllamaService:
    """Service for interacting with Ollama LLM for generating feedback summaries."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ):
        # Haal uit Pydantic settings (die .env leest)
        raw_url = base_url or str(settings.OLLAMA_BASE_URL)
        self.base_url = self._validate_ollama_url(raw_url)
        self.model = model or settings.OLLAMA_MODEL
        self.timeout = float(
            timeout if timeout is not None else settings.OLLAMA_TIMEOUT
        )

        logger.info(
            f"OllamaService: url={self.base_url}, model={self.model}, timeout={self.timeout}s"
        )

    @staticmethod
    def _validate_ollama_url(url: str) -> str:
        """
        Validate Ollama URL to prevent SSRF attacks.
        Only allow localhost and explicit container names.
        
        Args:
            url: The Ollama URL to validate
            
        Returns:
            Validated URL
            
        Raises:
            ValueError: If URL is not on allowlist
        """
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname or ""
            
            # Check if hostname is on allowlist
            if hostname.lower() not in ALLOWED_OLLAMA_HOSTS:
                raise ValueError(
                    f"Ollama host '{hostname}' not allowed. "
                    f"Only {ALLOWED_OLLAMA_HOSTS} are permitted. "
                    f"This prevents SSRF attacks."
                )
            
            logger.info(f"Ollama URL validated: {url}")
            return url
        except Exception as e:
            logger.error(f"Ollama URL validation failed: {e}")
            raise ValueError(f"Invalid Ollama URL: {e}")

    # ----------------------------
    # Public API
    # ----------------------------
    def generate_summary(
        self,
        feedback_comments: list[str],
        student_name: Optional[str] = None,
        context: Optional[str] = None,
    ) -> Optional[str]:
        """
        Generate a Dutch summary of peer feedback comments. Returns None to let caller use fallback.
        """
        if not feedback_comments:
            logger.info("No feedback comments provided")
            return None

        logger.info(
            f"Generating structured+summary for {len(feedback_comments)} comments"
        )

        # 1) Extract evidence as JSON (avoid hallucinated positives)
        struct = self._extract_structured(feedback_comments, context)
        if struct is None:
            logger.warning(
                "Structured extract failed; trying single-pass prompt as fallback-to-AI"
            )
            # Als extract faalt, probeer een enkele (oude) samenvattingsprompt
            sp = self._single_pass_summary(feedback_comments, context, retry=False)
            if sp and not self._is_refusal(sp):
                logger.info(
                    f"Successfully generated AI single-pass summary ({len(sp)} chars)"
                )
                return sp
            # laatste retry
            sp2 = self._single_pass_summary(feedback_comments, context, retry=True)
            if sp2 and not self._is_refusal(sp2):
                logger.info(
                    f"Successfully generated AI single-pass summary (retry) ({len(sp2)} chars)"
                )
                return sp2
            logger.warning(
                "AI single-pass failed/refused; caller should use rule-based fallback"
            )
            return None

        # 2) Summarize from the extracted JSON
        text = self._summarize_from_struct(struct, context)
        if text and not self._is_refusal(text) and len(text) > 20:
            logger.info(
                f"Successfully generated AI summary from struct ({len(text)} chars)"
            )
            return text

        # 3) One retry with softer framing
        text2 = self._summarize_from_struct(struct, context, retry=True)
        if text2 and not self._is_refusal(text2) and len(text2) > 20:
            logger.info(
                f"Successfully generated AI summary from struct (retry) ({len(text2)} chars)"
            )
            return text2

        logger.warning(
            "Summarize-from-struct failed/refused; caller should use rule-based fallback"
        )
        return None

    def create_fallback_summary(self, feedback_comments: list[str]) -> str:
        """
        Rule-based fallback (neutraal, conservatief).
        """
        if not feedback_comments:
            return "Nog geen peer-feedback ontvangen."

        texts = [t for t in feedback_comments if isinstance(t, str) and t.strip()]
        count = len(texts)
        all_text = " ".join(texts).lower()

        neg_terms = [
            r"\bniet\s+goed\b",
            r"\bweinig\s+inzet\b",
            r"\bnooit\b",
            r"\bslecht(e)?\b",
            r"\bonvoldoende\b",
            r"\bwerkte\s+niet\s+goed\s+samen\b",
            r"\bafspraken\s+(vrijwel\s+)?nooit\s+na\b",
        ]
        pos_terms = [
            r"\bgoed\s+gepland\b",
            r"\bgoede\s+bijdrage\b",
            r"\bheldere\s+communicatie\b",
            r"\bduidelijke\s+uitleg\b",
            r"\bproactief\b",
        ]
        # neutral_terms = [r"\bok\b", r"\bging\s+ok\b"]

        neg_hits = sum(len(re.findall(p, all_text)) for p in neg_terms)
        pos_hits = sum(len(re.findall(p, all_text)) for p in pos_terms)
        # neutral_hits = sum(len(re.findall(p, all_text)) for p in neutral_terms)

        msg = [
            f"Je hebt {count} peer-feedback reactie{'s' if count != 1 else ''} ontvangen."
        ]

        if neg_hits >= max(2, pos_hits + 1):
            msg.append(
                "Peers noemen vooral zorgen over inzet, afspraken en samenwerking."
            )
            action = "Spreek per overleg één taak en deadline af en bevestig die direct in de teamchat."
        elif pos_hits > 0 and neg_hits == 0:
            msg.append("Je bijdrage en communicatie worden positief benoemd.")
            action = (
                "Blijf dit vasthouden en maak vooraf duidelijk welke taak jij oppakt."
            )
        else:
            msg.append("Er zijn zowel positieve als kritische punten genoemd.")
            action = "Kies één verbeterpunt en maak daar deze week een concrete afspraak over."

        msg.append(action)
        return " ".join(msg)

    # ----------------------------
    # Private helpers
    # ----------------------------
    def _request_ollama(self, prompt: str, options: dict) -> Optional[str]:
        """Low-level request helper with tuple timeout + elapsed logging."""
        try:
            start = time.perf_counter()
            resp = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": options,
                },
                timeout=(5, self.timeout),  # connect=5s, read=self.timeout
            )
            elapsed = (time.perf_counter() - start) * 1000
            logger.info(
                f"Ollama request finished in {elapsed:.0f} ms with status {resp.status_code}"
            )
            if resp.status_code != 200:
                logger.error(f"Ollama API error: {resp.status_code} - {resp.text}")
                return None
            data = resp.json()
            return (data.get("response") or "").strip()
        except requests.Timeout:
            logger.error("Ollama request timed out")
            return None
        except Exception as e:
            logger.error(f"Ollama request error: {e}")
            return None

    def _is_refusal(self, text: str) -> bool:
        phrases = [
            "ik kan niet helpen",
            "ik kan je niet helpen",
            "ik kan deze taak niet",
            "helaas kan ik niet",
            "ik ben niet in staat",
            "dit kan ik niet doen",
            "kan geen samenvatting",
            "unable to provide",
            "i cannot provide",
            "i can't help",
        ]
        t = (text or "").lower()
        return any(p in t for p in phrases)

    # ---------- STEP 1: EXTRACT ----------
    def _extract_structured(
        self, feedback_comments: list[str], context: Optional[str]
    ) -> Optional[dict]:
        """
        Laat het model alleen evidence structureren: positives/negatives/themes/action.
        Retourneert dict of None.
        """
        sys = (
            "Je verzamelt uitsluitend FEITEN uit geanonimiseerde peer-quotes voor een leercontext. "
            "Je verzint niets. 'ok' is neutraal, niet positief. Geef JSON en niets anders."
        )
        # Quotes compact aanbieden
        bullets = "\n".join(
            f'- "{c.strip()}"'
            for c in feedback_comments[:10]
            if c and isinstance(c, str)
        )

        user = (
            f"{'Context: ' + context if context else ''}\n"
            f"Aantal peer-quotes: {len(feedback_comments)}\n"
            "Geanonimiseerde citaten:\n"
            f"{bullets}\n\n"
            "Opdracht: Geef exact JSON met velden "
            '{"positives": [..], "negatives": [..], "themes": ["1-3 kernonderwerpen"], "action": "1 concreet advies"} '
            "— zonder extra tekst."
        )

        prompt = f"{sys}\n\n{user}"

        text = self._request_ollama(
            prompt,
            {
                "temperature": 0.1,
                "top_p": 0.9,
                "num_predict": 220,
            },
        )
        if not text or self._is_refusal(text):
            return None

        # Robust JSON extraction (sometimes models print extra prose)
        json_str = self._extract_json_block(text)
        if not json_str:
            logger.warning("No JSON block found in extract output")
            return None

        try:
            data = json.loads(json_str)
            # Normalize
            data.setdefault("positives", [])
            data.setdefault("negatives", [])
            data.setdefault("themes", [])
            data.setdefault("action", "")

            # Positives mogen niet uit 'ok' bestaan
            data["positives"] = [
                p
                for p in data["positives"]
                if " ok" not in p.lower() and p.strip().lower() != "ok"
            ]
            return data
        except Exception as e:
            logger.error(f"Failed to parse extract JSON: {e} :: {json_str[:200]}")
            return None

    # ---------- STEP 2: SUMMARIZE ----------
    def _summarize_from_struct(
        self, struct: dict, context: Optional[str], retry: bool = False
    ) -> Optional[str]:
        """
        Laat het model samenvatten o.b.v. struct. Nooit positieve claims zonder positives.
        """

        sys = (
            "Je schrijft een korte, leerlingvriendelijke samenvatting in **de tweede persoon (je/jouw)**. "
            "Gebruik nooit 'de leerling', 'de persoon' of 'de student'. "
            "Gebruik alleen 'je' of 'jouw'. "
            "De tekst is bedoeld als directe terugkoppeling aan de leerling. "
            "Maximaal 7 zinnen. Noem niets dat niet uit de feiten volgt. Geen namen/PII."
        )
        rules = (
            "- Benoem 0–1 sterk punt alleen als 'positives' NIET leeg is.\n"
            "- Benoem 2–3 concrete verbeterpunten uit 'negatives'/'themes'.\n"
            "- Sluit af met het advies uit 'action' (1 zin, praktisch).\n"
            "- 'ok' is neutraal en telt niet als positief.\n"
        )
        if retry:
            rules += "- Formuleer extra neutraal en oplossingsgericht; vermijd oordelende taal.\n"

        user = (
            "Feiten (JSON):\n"
            f"{json.dumps(struct, ensure_ascii=False)}\n\n"
            "Opdracht:\n"
            "Schrijf één compacte samenvatting in lopende tekst (geen lijstjes). "
            "Gebruik de regels hierboven strikt."
        )

        prompt = f"{sys}\nBelangrijk:\n{rules}\n\n{user}"
        text = self._request_ollama(
            prompt,
            {
                "temperature": 0.1,
                "top_p": 0.9,
                "num_predict": 200,
            },
        )
        return text

    # ---------- Single-pass (fallback-to-AI) ----------
    def _single_pass_summary(
        self, feedback_comments: list[str], context: Optional[str], retry: bool
    ) -> Optional[str]:
        """Oude éénstaps prompt als AI-fallback wanneer extract faalt."""
        system_prompt = (
            "Je bent een onderwijsassistent die constructieve, tactvolle samenvattingen schrijft "
            "voor leerlingen over hun peer-feedback. Doel: leren en verbeteren. "
            "NL, je/jouw-vorm, max 7 zinnen, feitelijk, geen namen/PII. "
            "Verzin niets. 'ok' is neutraal."
        )
        if retry:
            system_prompt += " Het is toegestaan om kritische punten te benoemen mits respectvol en gericht op groei."

        bullets = "\n".join(
            f'- "{c.strip()}"'
            for c in feedback_comments[:10]
            if c and isinstance(c, str)
        )
        user_message = (
            f"{'Context: ' + context if context else ''}\n"
            f"Aantal peer-quotes: {len(feedback_comments)}\n"
            "Geanonimiseerde citaten:\n"
            f"{bullets}\n\n"
            "Opdracht: schrijf één compacte samenvatting (max 7 zinnen) in je/jouw-vorm. "
            "Noem alleen sterke punten als die expliciet voorkomen; geef 1 concreet verbeterpunt met praktische suggestie."
        )

        prompt = f"{system_prompt}\n\n{user_message}"
        return self._request_ollama(
            prompt,
            {
                "temperature": 0.2,
                "top_p": 0.9,
                "num_predict": 220,
            },
        )

    # ---------- Utils ----------
    @staticmethod
    def _extract_json_block(text: str) -> Optional[str]:
        """
        Haal het JSON-blok uit modeloutput (met of zonder extra tekst eromheen).
        """
        t = (text or "").strip()
        # Probeer fenced code blocks eerst
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", t, flags=re.DOTALL)
        if m:
            return m.group(1)
        # Anders: pak het grootste { ... } blok
        stack = 0
        start = None
        for i, ch in enumerate(t):
            if ch == "{":
                stack += 1
                if start is None:
                    start = i
            elif ch == "}":
                stack -= 1
                if stack == 0 and start is not None:
                    return t[start : i + 1]
        return None
