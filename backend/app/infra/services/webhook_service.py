"""Webhook notification service for job completion."""
from __future__ import annotations

import logging
import requests
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class WebhookService:
    """Service for sending webhook notifications."""
    
    MAX_RETRIES = 3
    TIMEOUT_SECONDS = 10
    
    @staticmethod
    def send_webhook(
        url: str,
        payload: dict,
        max_retries: int = MAX_RETRIES,
        timeout: int = TIMEOUT_SECONDS,
    ) -> tuple[bool, Optional[str]]:
        """
        Send webhook notification.
        
        Args:
            url: Webhook URL
            payload: Data to send
            max_retries: Maximum number of retry attempts
            timeout: Request timeout in seconds
            
        Returns:
            Tuple of (success, error_message)
        """
        if not url:
            return False, "No webhook URL provided"
        
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "TeamEvaluatieApp/1.0",
        }
        
        last_error = None
        
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=timeout,
                )
                
                if response.status_code < 400:
                    logger.info(f"Webhook delivered successfully to {url}")
                    return True, None
                else:
                    last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                    logger.warning(f"Webhook delivery failed (attempt {attempt + 1}/{max_retries}): {last_error}")
                    
            except requests.exceptions.Timeout:
                last_error = "Request timed out"
                logger.warning(f"Webhook timeout (attempt {attempt + 1}/{max_retries}): {url}")
                
            except requests.exceptions.RequestException as e:
                last_error = f"Request error: {str(e)}"
                logger.warning(f"Webhook request error (attempt {attempt + 1}/{max_retries}): {e}")
                
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
                logger.error(f"Unexpected webhook error (attempt {attempt + 1}/{max_retries}): {e}", exc_info=True)
        
        logger.error(f"Webhook delivery failed after {max_retries} attempts: {last_error}")
        return False, last_error
    
    @staticmethod
    def create_job_payload(
        job_id: str,
        status: str,
        student_id: int,
        evaluation_id: int,
        result: Optional[dict] = None,
        error_message: Optional[str] = None,
    ) -> dict:
        """
        Create webhook payload for job notification.
        
        Args:
            job_id: Job identifier
            status: Job status
            student_id: Student ID
            evaluation_id: Evaluation ID
            result: Job result data
            error_message: Error message if failed
            
        Returns:
            Webhook payload dictionary
        """
        payload = {
            "event": "job.completed" if status == "completed" else "job.failed",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "job_id": job_id,
                "status": status,
                "student_id": student_id,
                "evaluation_id": evaluation_id,
            }
        }
        
        if result:
            payload["data"]["result"] = result
            
        if error_message:
            payload["data"]["error"] = error_message
        
        return payload
