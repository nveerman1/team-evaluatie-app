from __future__ import annotations
import os
import requests
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class OllamaService:
    """Service for interacting with Ollama LLM for generating feedback summaries."""

    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.1")
        self.timeout = float(os.getenv("OLLAMA_TIMEOUT", "10.0"))
        
    def _is_refusal(self, text: str) -> bool:
        """
        Detect if the LLM response is a refusal to generate content.
        
        Args:
            text: The generated text to check
            
        Returns:
            True if the text appears to be a refusal
        """
        # More specific refusal patterns to avoid false positives
        refusal_phrases = [
            "ik kan niet helpen",
            "ik kan je niet helpen", 
            "ik kan deze taak niet",
            "helaas kan ik niet",
            "ik ben niet in staat",
            "dit kan ik niet doen",
            "kan geen samenvatting",
            "unable to provide",
            "i cannot provide",
            "i can't help"
        ]
        text_lower = text.lower()
        
        # Check if any refusal phrase is present
        for phrase in refusal_phrases:
            if phrase in text_lower:
                logger.warning(f"Refusal detected with phrase: '{phrase}'")
                return True
        
        return False
    
    def generate_summary(
        self, 
        feedback_comments: list[str],
        student_name: Optional[str] = None,
        context: Optional[str] = None,
    ) -> Optional[str]:
        """
        Generate a Dutch summary of peer feedback comments.
        
        Args:
            feedback_comments: List of anonymized peer feedback comments
            student_name: Name of the student (for context, not included in output)
            context: Optional context like course/project phase
            
        Returns:
            Generated summary in Dutch or None if generation fails
        """
        if not feedback_comments:
            logger.info("No feedback comments provided")
            return None
        
        logger.info(f"Generating summary for {len(feedback_comments)} feedback comments")
        
        # Try primary prompt first
        summary = self._try_generate(feedback_comments, context, use_retry_prompt=False)
        
        if not summary:
            logger.warning("Primary generation returned None")
            return None
        
        # If we get a refusal, try with a more neutral prompt
        if self._is_refusal(summary):
            logger.warning("LLM refusal detected, retrying with neutral prompt")
            summary = self._try_generate(feedback_comments, context, use_retry_prompt=True)
            
            if not summary:
                logger.warning("Retry generation returned None")
                return None
            
            # If still refusal, return None to trigger fallback
            if self._is_refusal(summary):
                logger.warning("LLM refusal on retry, using fallback")
                return None
        
        logger.info(f"Successfully generated AI summary ({len(summary)} chars)")
        return summary
    
    def _try_generate(
        self,
        feedback_comments: list[str],
        context: Optional[str],
        use_retry_prompt: bool = False
    ) -> Optional[str]:
        """
        Internal method to attempt summary generation.
        
        Args:
            feedback_comments: List of feedback comments
            context: Optional context
            use_retry_prompt: If True, use a more neutral retry prompt
            
        Returns:
            Generated summary or None
        """
        # Build the prompt based on retry flag
        if use_retry_prompt:
            # Neutral retry prompt (less likely to trigger safety filters)
            system_prompt = (
                "Je bent een onderwijsassistent die samenvattingen schrijft voor leerlingen "
                "over hun peer-feedback. Dit is een educatieve context voor leren en groei. "
                "Schrijf in het Nederlands in je/jouw-vorm, max 7 zinnen. "
                "Wees feitelijk en neutraal: vat samen wat peers hebben genoemd. "
                "Gebruik constructieve formuleringen. Noem geen namen."
            )
        else:
            # Primary prompt (more friendly, educational framing)
            system_prompt = (
                "Je bent een onderwijsassistent die constructieve, tactvolle samenvattingen schrijft "
                "voor leerlingen over hun peer-feedback. Dit is géén roddel of belediging; "
                "het doel is leren en zelfverbetering. "
                "\n"
                "Schrijf in het Nederlands in je/jouw-vorm, max 7 zinnen. "
                "Wees feitelijk en neutraal: vat samen wat peers hebben genoemd "
                "(zowel sterke punten als verbeterpunten). "
                "Gebruik positieve, constructieve formuleringen en concrete acties. "
                "Noem geen namen of identificeerbare info. "
                "\n"
                "Belangrijk:\n"
                "- Vat samen; verzin niets dat niet in de feedback staat.\n"
                "- Vermijd beschuldigende taal. Gebruik 'je kunt', 'probeer', 'maak' i.p.v. harde oordelen.\n"
                "- Het is toegestaan om kritische feedback te beschrijven, mits respectvol en helpend.\n"
                "- Schrijf nooit dat je deze taak niet kunt uitvoeren."
            )
        
        # Build user message with feedback bullets
        user_message_parts = []
        if context:
            user_message_parts.append(f"Context: {context}")
        
        user_message_parts.append(f"\nAantal peer-feedback reacties: {len(feedback_comments)}")
        user_message_parts.append("Geanonimiseerde citaten:")
        
        for comment in feedback_comments[:10]:  # Limit to 10 comments
            # Trim very long comments
            trimmed = comment[:500] if len(comment) > 500 else comment
            user_message_parts.append(f'- "{trimmed}"')
        
        user_message_parts.append(
            "\nOpdracht:\n"
            "Schrijf één compacte samenvatting (max 7 zinnen) in je/jouw-vorm. "
            "Noem 1-2 sterke punten en 1 concreet verbeterpunt met praktische suggestie. "
            "Geen namen, geen herleidbare details; schrijf vloeiende tekst."
        )
        
        user_message = "\n".join(user_message_parts)
        
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": f"{system_prompt}\n\n{user_message}",
                    "stream": False,
                    "options": {
                        "temperature": 0.3,  # Lower temperature for consistency
                        "num_predict": 250,  # Slightly more tokens for complete sentences
                    }
                },
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                summary = result.get("response", "").strip()
                
                # Basic validation
                if summary and len(summary) > 20:
                    return summary
                else:
                    logger.warning(f"Generated summary too short: {len(summary)} chars")
                    return None
            else:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                return None
                
        except requests.Timeout:
            logger.error("Ollama request timed out")
            return None
        except Exception as e:
            logger.error(f"Error generating summary with Ollama: {e}")
            return None
            
    def create_fallback_summary(self, feedback_comments: list[str]) -> str:
        """
        Create a simple rule-based summary when AI is unavailable.
        
        Args:
            feedback_comments: List of feedback comments
            
        Returns:
            Basic template-based summary
        """
        if not feedback_comments:
            return "Nog geen peer-feedback ontvangen."
            
        comment_count = len(feedback_comments)
        all_text = " ".join(feedback_comments).lower()
        
        # Check for negations to avoid false positives
        negation_patterns = [
            "niet goed", "niet sterk", "niet uitstekend", "niet prima",
            "niet helder", "niet duidelijk", "niet proactief",
            "weinig goed", "slecht", "zwak", "onvoldoende"
        ]
        
        # Positive indicators (avoid simple word matching that can be negated)
        positive_patterns = [
            "goed gedaan", "sterke punten", "uitstekend werk", "prima samenwerking",
            "helder communicatie", "duidelijk uitgelegd", "proactief", "goede bijdrage"
        ]
        
        # Negative indicators
        negative_patterns = [
            "moet verbeteren", "kan beter", "meer aandacht", "minder",
            "te weinig", "onvoldoende", "niet goed", "slecht", "zwak"
        ]
        
        has_negation = any(pattern in all_text for pattern in negation_patterns)
        has_positive = any(pattern in all_text for pattern in positive_patterns)
        has_negative = any(pattern in all_text for pattern in negative_patterns)
        
        # If we detect negations, don't treat it as positive
        if has_negation:
            has_positive = False
            has_negative = True
        
        summary_parts = [
            f"Je hebt {comment_count} peer-feedback reactie{'s' if comment_count > 1 else ''} ontvangen."
        ]
        
        # Be more conservative: only add positive message if clearly positive
        if has_positive and not has_negative:
            summary_parts.append(
                "Je teamgenoten waarderen je bijdrage aan het team."
            )
        elif has_negative and not has_positive:
            summary_parts.append(
                "Er zijn aandachtspunten genoemd waar je aan kunt werken."
            )
        elif has_positive and has_negative:
            summary_parts.append(
                "Je feedback bevat zowel sterke punten als aandachtspunten."
            )
        else:
            summary_parts.append(
                "Je teamgenoten hebben feedback gegeven over je werk."
            )
            
        summary_parts.append(
            "Bekijk de individuele feedback voor meer details."
        )
        
        return " ".join(summary_parts)
