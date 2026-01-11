#!/bin/bash
# =============================================================================
# UFW Firewall Configuration - Team Evaluatie App
# =============================================================================
#
# This script provides firewall configuration commands for different stages
# of deployment: staging (testing) and production (go-live).
#
# DO NOT RUN THIS SCRIPT DIRECTLY - Execute commands manually after review
#
# =============================================================================

set -e

echo "==================================================================="
echo "UFW Firewall Configuration - Team Evaluatie App"
echo "==================================================================="
echo ""
echo "IMPORTANT: This script is for REFERENCE ONLY."
echo "Review and execute commands manually to avoid locking yourself out."
echo ""
echo "==================================================================="
echo ""

# =============================================================================
# STAGE 1: Initial UFW Setup (if not already configured)
# =============================================================================
echo "# ----------------------------------------------------------------"
echo "# STAGE 1: Initial UFW Setup"
echo "# ----------------------------------------------------------------"
echo ""
echo "# Install UFW (if not installed)"
echo "sudo apt-get update && sudo apt-get install -y ufw"
echo ""
echo "# Set default policies"
echo "sudo ufw default deny incoming"
echo "sudo ufw default allow outgoing"
echo ""

# =============================================================================
# STAGE 2: SSH Protection (CRITICAL - Do this first!)
# =============================================================================
echo "# ----------------------------------------------------------------"
echo "# STAGE 2: SSH Protection (CRITICAL - Configure FIRST!)"
echo "# ----------------------------------------------------------------"
echo ""
echo "# OPTION A: Allow SSH from anywhere (less secure)"
echo "sudo ufw allow 22/tcp comment 'SSH'"
echo ""
echo "# OPTION B: Allow SSH only from your IP (recommended)"
echo "# Replace YOUR_IP with your actual IP address"
echo "# sudo ufw allow from YOUR_IP to any port 22 proto tcp comment 'SSH from trusted IP'"
echo ""
echo "# OPTION C: Allow SSH from multiple trusted IPs"
echo "# sudo ufw allow from YOUR_OFFICE_IP to any port 22 proto tcp comment 'SSH from office'"
echo "# sudo ufw allow from YOUR_HOME_IP to any port 22 proto tcp comment 'SSH from home'"
echo ""

# =============================================================================
# STAGE 3: Staging Mode (Testing with Limited Access)
# =============================================================================
echo "# ----------------------------------------------------------------"
echo "# STAGE 3: Staging Mode (Testing)"
echo "# ----------------------------------------------------------------"
echo "# Use this configuration when testing the deployment"
echo "# Only your IP can access HTTPS, HTTP is denied"
echo "# Replace YOUR_IP with your actual IP address"
echo ""
echo "# Allow HTTPS (443) only from your IP for testing"
echo "# sudo ufw allow from YOUR_IP to any port 443 proto tcp comment 'HTTPS staging access'"
echo ""
echo "# Deny HTTP (80) from everywhere (no redirect during staging)"
echo "sudo ufw deny 80/tcp comment 'HTTP denied during staging'"
echo ""
echo "# Enable UFW (will prompt for confirmation)"
echo "# sudo ufw enable"
echo ""
echo "# Check status"
echo "sudo ufw status numbered"
echo ""

# =============================================================================
# STAGE 4: Go-Live (Production Mode)
# =============================================================================
echo "# ----------------------------------------------------------------"
echo "# STAGE 4: Go-Live (Production Mode)"
echo "# ----------------------------------------------------------------"
echo "# Use this configuration when ready to serve public traffic"
echo ""
echo "# Remove staging HTTPS rule (if set)"
echo "# First, list rules to find the rule number:"
echo "sudo ufw status numbered"
echo "# Then delete the staging rule (replace N with rule number):"
echo "# sudo ufw delete N"
echo ""
echo "# Allow HTTPS (443) from anywhere"
echo "sudo ufw allow 443/tcp comment 'HTTPS production'"
echo ""
echo "# Allow HTTP (80) from anywhere (for ACME challenges and redirect to HTTPS)"
echo "sudo ufw allow 80/tcp comment 'HTTP for ACME and redirect'"
echo ""
echo "# Reload UFW"
echo "sudo ufw reload"
echo ""
echo "# Check status"
echo "sudo ufw status verbose"
echo ""

# =============================================================================
# STAGE 5: Optional - Additional Security Rules
# =============================================================================
echo "# ----------------------------------------------------------------"
echo "# STAGE 5: Optional - Additional Security Rules"
echo "# ----------------------------------------------------------------"
echo ""
echo "# Rate limiting for SSH (prevent brute force)"
echo "sudo ufw limit 22/tcp comment 'SSH rate limit'"
echo ""
echo "# Allow Docker containers to communicate (if needed)"
echo "# sudo ufw allow from 172.16.0.0/12 to any"
echo ""

# =============================================================================
# Management Commands
# =============================================================================
echo "# ----------------------------------------------------------------"
echo "# UFW Management Commands"
echo "# ----------------------------------------------------------------"
echo ""
echo "# Check UFW status"
echo "sudo ufw status verbose"
echo ""
echo "# Check UFW status with rule numbers"
echo "sudo ufw status numbered"
echo ""
echo "# Delete a rule by number (get number from 'status numbered')"
echo "# sudo ufw delete N"
echo ""
echo "# Delete a rule by specification"
echo "# sudo ufw delete allow 80/tcp"
echo ""
echo "# Disable UFW (emergency - restores full access)"
echo "# sudo ufw disable"
echo ""
echo "# Enable UFW"
echo "# sudo ufw enable"
echo ""
echo "# Reload UFW (apply changes)"
echo "sudo ufw reload"
echo ""
echo "# Reset UFW (remove all rules)"
echo "# sudo ufw reset"
echo ""

# =============================================================================
# Verification Commands
# =============================================================================
echo "# ----------------------------------------------------------------"
echo "# Verification Commands"
echo "# ----------------------------------------------------------------"
echo ""
echo "# Test HTTPS access from external machine"
echo "curl -I https://app.technasiummbh.nl"
echo ""
echo "# Test HTTP redirect"
echo "curl -I http://app.technasiummbh.nl"
echo ""
echo "# Check open ports"
echo "sudo netstat -tulpn | grep LISTEN"
echo ""
echo "# Check iptables rules (UFW uses iptables under the hood)"
echo "sudo iptables -L -n -v"
echo ""

echo "==================================================================="
echo "Configuration Reference Complete"
echo "==================================================================="
echo ""
echo "NEXT STEPS:"
echo "1. Review all commands above"
echo "2. Execute SSH protection commands FIRST (Stage 2)"
echo "3. Enable UFW"
echo "4. Choose staging or production mode (Stage 3 or 4)"
echo "5. Verify firewall rules with 'sudo ufw status verbose'"
echo "6. Test access from external machine"
echo ""
echo "WARNING: Incorrect firewall configuration can lock you out!"
echo "         Always test from another terminal session before closing"
echo "         your current SSH connection."
echo ""
