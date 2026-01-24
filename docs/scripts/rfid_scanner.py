#!/usr/bin/env python3
"""
RFID Scanner Script for Team Evaluatie App
==========================================

This script reads RFID cards using an MFRC522 reader connected to a Raspberry Pi
and sends the card UID to the backend API for check-in/check-out processing.

Hardware Requirements:
- Raspberry Pi (any model with GPIO and network)
- MFRC522 RFID Reader Module
- Buzzer (optional, for audio feedback)
- LED (optional, for visual feedback)

Installation:
    pip3 install mfrc522 requests

Configuration:
    Update API_BASE_URL and API_KEY constants below with your values.

Usage:
    python3 rfid_scanner.py
"""

import time
import sys
import logging
from typing import Dict
import requests
from mfrc522 import SimpleMFRC522

# ============================================================================
# CONFIGURATION - Update these values for your environment
# ============================================================================

# Backend API Configuration
API_BASE_URL = "https://your-app-domain.com/api/v1"  # UPDATE THIS
API_KEY = "your-api-key-here"  # UPDATE THIS - Use a strong key from backend

# Scanner Settings
SCAN_COOLDOWN_SECONDS = 2  # Prevent duplicate scans within this time window
READ_TIMEOUT_SECONDS = 10  # Request timeout
RETRY_ATTEMPTS = 3  # Number of retry attempts for failed requests
RETRY_DELAY_SECONDS = 1  # Delay between retry attempts

# Visual/Audio Feedback (set to True to enable, requires additional hardware)
ENABLE_BUZZER = False  # Requires buzzer connected to GPIO
ENABLE_LED = False  # Requires LED connected to GPIO
BUZZER_GPIO_PIN = 18  # GPIO pin for buzzer (BCM numbering)
LED_GPIO_PIN = 23  # GPIO pin for LED (BCM numbering)

# Logging Configuration
LOG_LEVEL = logging.INFO  # Change to logging.DEBUG for more verbose output
LOG_FILE = "/var/log/rfid_scanner.log"  # Set to None to log only to console

# ============================================================================
# END OF CONFIGURATION
# ============================================================================

# Configure logging
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        *([logging.FileHandler(LOG_FILE)] if LOG_FILE else [])
    ]
)
logger = logging.getLogger(__name__)


class FeedbackController:
    """Controls visual and audio feedback (buzzer, LED)"""
    
    def __init__(self):
        self.buzzer_enabled = ENABLE_BUZZER
        self.led_enabled = ENABLE_LED
        
        if self.buzzer_enabled or self.led_enabled:
            try:
                import RPi.GPIO as GPIO
                self.GPIO = GPIO
                GPIO.setmode(GPIO.BCM)
                GPIO.setwarnings(False)
                
                if self.buzzer_enabled:
                    GPIO.setup(BUZZER_GPIO_PIN, GPIO.OUT)
                    logger.info(f"Buzzer initialized on GPIO {BUZZER_GPIO_PIN}")
                
                if self.led_enabled:
                    GPIO.setup(LED_GPIO_PIN, GPIO.OUT)
                    GPIO.output(LED_GPIO_PIN, GPIO.LOW)
                    logger.info(f"LED initialized on GPIO {LED_GPIO_PIN}")
            except ImportError:
                logger.warning("RPi.GPIO not available - feedback disabled")
                self.buzzer_enabled = False
                self.led_enabled = False
            except Exception as e:
                logger.error(f"Failed to initialize feedback: {e}")
                self.buzzer_enabled = False
                self.led_enabled = False
    
    def beep(self, duration: float = 0.1, count: int = 1):
        """
        Sound the buzzer
        
        Args:
            duration: Duration of each beep in seconds (default: 0.1)
            count: Number of beeps (default: 1)
        """
        if not self.buzzer_enabled:
            return
        
        try:
            for _ in range(count):
                self.GPIO.output(BUZZER_GPIO_PIN, self.GPIO.HIGH)
                time.sleep(duration)
                self.GPIO.output(BUZZER_GPIO_PIN, self.GPIO.LOW)
                time.sleep(duration)
        except Exception as e:
            logger.error(f"Buzzer error: {e}")
    
    def led_on(self):
        """Turn LED on"""
        if self.led_enabled:
            try:
                self.GPIO.output(LED_GPIO_PIN, self.GPIO.HIGH)
            except Exception as e:
                logger.error(f"LED error: {e}")
    
    def led_off(self):
        """Turn LED off"""
        if self.led_enabled:
            try:
                self.GPIO.output(LED_GPIO_PIN, self.GPIO.LOW)
            except Exception as e:
                logger.error(f"LED error: {e}")
    
    def success_feedback(self):
        """Provide success feedback (1 beep, LED blink)"""
        self.beep(duration=0.1, count=1)
        if self.led_enabled:
            self.led_on()
            time.sleep(0.5)
            self.led_off()
    
    def error_feedback(self):
        """Provide error feedback (3 beeps, LED rapid blink)"""
        self.beep(duration=0.05, count=3)
        if self.led_enabled:
            for _ in range(3):
                self.led_on()
                time.sleep(0.1)
                self.led_off()
                time.sleep(0.1)
    
    def cleanup(self):
        """Clean up GPIO resources"""
        if hasattr(self, 'GPIO') and (self.buzzer_enabled or self.led_enabled):
            try:
                self.GPIO.cleanup()
                logger.info("GPIO cleaned up")
            except Exception as e:
                logger.error(f"GPIO cleanup error: {e}")


class RFIDScanner:
    """Handles RFID card reading and API communication"""
    
    def __init__(self):
        self.reader = SimpleMFRC522()
        self.feedback = FeedbackController()
        self.last_scan_time = {}  # Track last scan time per UID
        self.api_url = f"{API_BASE_URL}/attendance/scan"
        self.headers = {
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        }
        
        # Validate configuration
        if "your-app-domain.com" in API_BASE_URL:
            logger.error("❌ API_BASE_URL not configured! Update the script with your backend URL.")
            sys.exit(1)
        
        if "your-api-key-here" in API_KEY:
            logger.error("❌ API_KEY not configured! Update the script with your API key.")
            sys.exit(1)
        
        logger.info("✅ RFID Scanner initialized")
        logger.info(f"   Backend: {API_BASE_URL}")
        logger.info(f"   Endpoint: {self.api_url}")
    
    def is_within_cooldown(self, uid: str) -> bool:
        """Check if a card was scanned recently (within cooldown period)"""
        if uid not in self.last_scan_time:
            return False
        
        elapsed = time.time() - self.last_scan_time[uid]
        return elapsed < SCAN_COOLDOWN_SECONDS
    
    def send_scan_to_api(self, uid: str) -> Dict | None:
        """Send RFID scan to backend API with retry logic"""
        payload = {"uid": uid}
        
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                logger.debug(f"Sending scan (attempt {attempt}/{RETRY_ATTEMPTS})...")
                response = requests.post(
                    self.api_url,
                    json=payload,
                    headers=self.headers,
                    timeout=READ_TIMEOUT_SECONDS
                )
                
                # Log response status
                logger.debug(f"Response status: {response.status_code}")
                
                # Handle authentication errors
                if response.status_code == 401:
                    logger.error("❌ Authentication failed - Invalid API key")
                    return None
                
                if response.status_code == 503:
                    logger.error("❌ Service unavailable - RFID not configured on backend")
                    return None
                
                # Parse response
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"Unexpected status code: {response.status_code}")
                    logger.debug(f"Response body: {response.text}")
                    
            except requests.exceptions.Timeout:
                logger.warning(f"Request timeout (attempt {attempt}/{RETRY_ATTEMPTS})")
            except requests.exceptions.ConnectionError as e:
                logger.warning(f"Connection error (attempt {attempt}/{RETRY_ATTEMPTS}): {e}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Request error: {e}")
                return None
            
            # Wait before retry (except on last attempt)
            if attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_DELAY_SECONDS)
        
        logger.error(f"❌ Failed to send scan after {RETRY_ATTEMPTS} attempts")
        return None
    
    def handle_scan_response(self, response: Dict):
        """Handle and display scan response"""
        status = response.get("status")
        
        if status == "ok":
            action = response.get("action")
            user = response.get("user", {})
            event = response.get("event", {})
            
            user_name = user.get("name", "Unknown")
            class_name = user.get("class_name", "")
            
            if action == "check_in":
                logger.info(f"✅ CHECK-IN: {user_name} ({class_name})")
                logger.info(f"   Time: {event.get('check_in', 'N/A')}")
                self.feedback.success_feedback()
            
            elif action == "check_out":
                logger.info(f"✅ CHECK-OUT: {user_name} ({class_name})")
                duration = event.get("duration_seconds", 0)
                hours = duration // 3600
                minutes = (duration % 3600) // 60
                logger.info(f"   Duration: {hours}h {minutes}m")
                self.feedback.success_feedback()
        
        elif status == "not_found":
            message = response.get("message", "Card not found")
            logger.warning(f"⚠️  {message}")
            self.feedback.error_feedback()
        
        elif status == "error":
            message = response.get("message", "Unknown error")
            logger.error(f"❌ Error: {message}")
            self.feedback.error_feedback()
        
        else:
            logger.warning(f"⚠️  Unknown response status: {status}")
            self.feedback.error_feedback()
    
    def run(self):
        """Main scanner loop"""
        logger.info("🔍 Scanner ready - Hold RFID card near reader...")
        logger.info("   Press Ctrl+C to stop\n")
        
        try:
            while True:
                try:
                    # Read RFID card
                    uid, text = self.reader.read()
                    uid_str = str(uid)
                    
                    # Check cooldown to prevent duplicate scans
                    if self.is_within_cooldown(uid_str):
                        logger.debug(f"Ignoring scan (cooldown): {uid_str}")
                        continue
                    
                    # Update last scan time
                    self.last_scan_time[uid_str] = time.time()
                    
                    # Log scan
                    logger.info(f"📡 Card scanned: {uid_str}")
                    
                    # Send to API
                    response = self.send_scan_to_api(uid_str)
                    
                    if response:
                        self.handle_scan_response(response)
                    else:
                        logger.error("❌ No response from API")
                        self.feedback.error_feedback()
                    
                    # Brief pause before next scan
                    time.sleep(0.5)
                    
                except KeyboardInterrupt:
                    raise  # Re-raise to be caught by outer try-except
                except Exception as e:
                    logger.error(f"Error reading card: {e}")
                    time.sleep(1)  # Prevent rapid error loops
        
        except KeyboardInterrupt:
            logger.info("\n🛑 Scanner stopped by user")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Clean up resources"""
        logger.info("Cleaning up...")
        self.feedback.cleanup()
        logger.info("✅ Cleanup complete")


def main():
    """Main entry point"""
    logger.info("=" * 60)
    logger.info("RFID Scanner for Team Evaluatie App")
    logger.info("=" * 60)
    
    try:
        scanner = RFIDScanner()
        scanner.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
