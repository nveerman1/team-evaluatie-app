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
        self.timeout = float(os.getenv("OLLAMA_TIMEOUT", "60.0"))
        
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
            return None
            
        # Build the prompt
        system_prompt = (
            "Je bent een vriendelijke coach die feedback samenvat voor studenten. "
            "Maak een korte, tactvolle samenvatting in het Nederlands. "
            "Spreek de student aan met 'je/jouw'. "
            "Noem NOOIT namen van mensen. "
            "Maximaal 7 zinnen. "
            "Benoem 1-2 sterke punten en 1 aandachtspunt. "
            "Verzin niets dat niet in de feedback staat. "
            "Sluit af met een concrete actie voor de komende week."
        )
        
        # Build user message with feedback bullets
        user_message_parts = []
        if context:
            user_message_parts.append(f"Context: {context}")
        user_message_parts.append("\nAnonieme peer-feedback:")
        for i, comment in enumerate(feedback_comments[:10], 1):  # Limit to 10 comments
            # Trim very long comments
            trimmed = comment[:500] if len(comment) > 500 else comment
            user_message_parts.append(f"- {trimmed}")
        
        user_message_parts.append(
            "\nMaak een tactvolle samenvatting in je/jouw-vorm, "
            "max 7 zinnen, noem 1-2 sterke punten en 1 aandachtspunt."
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
                        "num_predict": 200,  # Limit output length
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
        
        # Extract common positive/negative words (simple heuristic)
        positive_words = ["goed", "sterk", "uitstekend", "prima", "helder", "duidelijk", "proactief"]
        negative_words = ["verbeteren", "meer", "minder", "aandacht", "beter", "nog"]
        
        all_text = " ".join(feedback_comments).lower()
        
        has_positive = any(word in all_text for word in positive_words)
        has_negative = any(word in all_text for word in negative_words)
        
        summary_parts = [
            f"Je hebt {comment_count} peer-feedback reactie{'s' if comment_count > 1 else ''} ontvangen."
        ]
        
        if has_positive:
            summary_parts.append(
                "Je teamgenoten waarderen je positieve bijdrage aan het team."
            )
        
        if has_negative:
            summary_parts.append(
                "Er zijn ook aandachtspunten genoemd waar je aan kunt werken."
            )
        else:
            summary_parts.append(
                "Over het algemeen ben je op de goede weg."
            )
            
        summary_parts.append(
            "Bekijk de individuele feedback voor meer details."
        )
        
        return " ".join(summary_parts)
