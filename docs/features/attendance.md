# RFID Scanner Setup Guide

This guide explains how to set up and use the RFID scanner functionality for the Team Evaluatie App.

## Table of Contents
- [Overview](#overview)
- [Backend Configuration](#backend-configuration)
- [Raspberry Pi Setup](#raspberry-pi-setup)
- [Python Scanner Script](#python-scanner-script)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

The RFID scanner system allows students to check in and check out of sessions using RFID cards. The system consists of:
- **Backend API**: FastAPI endpoint (`/api/v1/attendance/scan`) that handles RFID scans
- **Raspberry Pi**: Device with an RFID reader that sends card UIDs to the backend
- **API Key Authentication**: Secure authentication using X-API-Key headers

## Backend Configuration

### 1. Generate API Keys

Generate strong API keys for your RFID scanners:

```bash
# Generate a single API key
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Example output: yK9vZpX6mJ8nT5wQ2rL4dH7aB1cF3eG5
```

### 2. Configure Environment Variables

Add the API keys to your backend environment configuration:

**For Development (`.env` file):**
```bash
RFID_API_KEYS=yK9vZpX6mJ8nT5wQ2rL4dH7aB1cF3eG5
```

**For Production (environment variables or `.env.production`):**
```bash
# Multiple API keys (one per scanner), comma-separated
RFID_API_KEYS=scanner1-key-here,scanner2-key-here,scanner3-key-here
```

### 3. Restart Backend

Restart your FastAPI backend server for the changes to take effect:

```bash
# Development
cd backend
uvicorn app.main:app --reload

# Production
systemctl restart team-evaluatie-app
```

## Raspberry Pi Setup

### Hardware Requirements
- Raspberry Pi (any model with network connectivity)
- MFRC522 RFID Reader Module
- Jumper wires
- Power supply for Raspberry Pi

### Wiring Diagram

Connect the MFRC522 RFID reader to your Raspberry Pi:

```
MFRC522 Pin  ->  Raspberry Pi Pin
SDA (SS)     ->  GPIO 8 (Pin 24)
SCK          ->  GPIO 11 (Pin 23)
MOSI         ->  GPIO 10 (Pin 19)
MISO         ->  GPIO 9 (Pin 21)
IRQ          ->  (Not connected)
GND          ->  Ground (Pin 6, 9, 14, 20, 25, 30, 34, or 39)
RST          ->  GPIO 25 (Pin 22)
3.3V         ->  3.3V (Pin 1 or 17)
```

### Software Setup

1. **Update Raspberry Pi OS:**
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

2. **Enable SPI Interface:**
```bash
sudo raspi-config
# Navigate to: Interface Options -> SPI -> Enable
# Reboot: sudo reboot
```

3. **Install Python and dependencies:**
```bash
sudo apt-get install python3 python3-pip -y
pip3 install spidev mfrc522 requests
```

4. **Download the scanner script:**
```bash
cd ~
curl -O https://raw.githubusercontent.com/nveerman1/team-evaluatie-app/main/docs/scripts/rfid_scanner.py
```

5. **Configure the script:**

Edit `rfid_scanner.py` and update the configuration:
```python
# API Configuration
API_BASE_URL = "https://your-app-domain.com/api/v1"  # Your backend URL
API_KEY = "yK9vZpX6mJ8nT5wQ2rL4dH7aB1cF3eG5"  # Your API key
```

6. **Test the scanner:**
```bash
python3 rfid_scanner.py
```

7. **Set up autostart (optional):**

Create a systemd service to run the scanner on boot:

```bash
sudo nano /etc/systemd/system/rfid-scanner.service
```

Add the following content:
```ini
[Unit]
Description=RFID Scanner Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/rfid_scanner.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable rfid-scanner.service
sudo systemctl start rfid-scanner.service
sudo systemctl status rfid-scanner.service
```

## Python Scanner Script

See the example script in `docs/scripts/rfid_scanner.py`.

Key features:
- Reads RFID card UIDs from the MFRC522 reader
- Sends UIDs to the backend API with API key authentication
- Handles check-in and check-out logic
- Visual/audio feedback for successful scans
- Error handling and retry logic
- Logging for troubleshooting

## Security Considerations

### API Key Security
- **Never commit API keys to version control**
- Use environment variables or secure secrets management
- Generate unique keys for each scanner location
- Rotate keys periodically (e.g., every 6 months)
- Use strong, random keys (minimum 32 characters)

### Network Security
- **Use HTTPS only** - Never send API keys over unencrypted HTTP
- **IP Whitelisting**: Configure your firewall/nginx to only accept requests from known scanner IPs:
  ```nginx
  # Example nginx configuration
  location /api/v1/attendance/scan {
      # Only allow requests from scanner IPs
      allow 192.168.1.100;  # Scanner 1
      allow 192.168.1.101;  # Scanner 2
      deny all;
      
      proxy_pass http://backend;
  }
  ```

### Additional Recommendations
- Use a separate network/VLAN for RFID scanners
- Monitor API logs for suspicious activity
- Implement rate limiting (already included in the backend)
- Keep Raspberry Pi OS and packages updated
- Use strong passwords for Raspberry Pi accounts
- Disable unnecessary services on the Pi

## Troubleshooting

### Scanner Not Reading Cards
1. Check SPI is enabled: `lsmod | grep spi`
2. Verify wiring connections
3. Test RFID reader: `python3 -c "from mfrc522 import SimpleMFRC522; reader = SimpleMFRC522(); print('Scan card...'); print(reader.read())"`

### API Authentication Errors
- **401 Unauthorized**: Check that API key is correct and matches backend configuration
- **503 Service Unavailable**: Backend `RFID_API_KEYS` environment variable is not configured
- Verify API key in scanner script matches one in `RFID_API_KEYS`

### Network Issues
- Verify Raspberry Pi network connectivity: `ping google.com`
- Check backend URL is correct and accessible: `curl https://your-domain.com/api/v1/attendance/scan`
- Verify firewall rules allow connections from scanner IP

### Card Not Found in System
- Response: `{"status": "not_found", "message": "Geen gebruiker gevonden..."}`
- Solution: Register the RFID card UID in the system first via the teacher interface

### Logs
- Scanner logs: Check console output or system journal: `sudo journalctl -u rfid-scanner -f`
- Backend logs: Check FastAPI logs for authentication and scan events
- Look for ERROR or WARNING messages

## API Reference

### POST /api/v1/attendance/scan

**Request:**
```bash
curl -X POST https://your-domain.com/api/v1/attendance/scan \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"uid": "1234567890"}'
```

**Response (Check-in):**
```json
{
  "status": "ok",
  "action": "check_in",
  "user": {
    "id": 42,
    "name": "Jan Janssen",
    "email": "jan@school.nl",
    "class_name": "4V1"
  },
  "event": {
    "id": 123,
    "check_in": "2026-01-24T14:30:00Z",
    "check_out": null
  }
}
```

**Response (Check-out):**
```json
{
  "status": "ok",
  "action": "check_out",
  "user": {
    "id": 42,
    "name": "Jan Janssen",
    "email": "jan@school.nl",
    "class_name": "4V1"
  },
  "event": {
    "id": 123,
    "check_in": "2026-01-24T14:30:00Z",
    "check_out": "2026-01-24T16:45:00Z",
    "duration_seconds": 8100
  }
}
```

**Response (Card not found):**
```json
{
  "status": "not_found",
  "message": "Geen gebruiker gevonden met deze kaart. Vraag een docent om de kaart te activeren."
}
```

## Support

For issues or questions:
- Check the [main README](../README.md)
- Review backend logs
- Contact your system administrator
