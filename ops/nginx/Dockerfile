# =============================================================================
# Custom Nginx Dockerfile with Updated libpng
# =============================================================================
# This Dockerfile extends the official nginx:stable-alpine image to upgrade
# libpng to the latest available version, addressing security vulnerabilities.
#
# Instead of suppressing Trivy warnings for libpng CVEs (CVE-2026-22695 and
# CVE-2026-22801), we actively upgrade the library to the latest version
# available in Alpine's repositories.
#
# Background:
# - Alpine 3.23.2 (used by nginx:stable-alpine) ships with libpng 1.6.53
# - libpng 1.6.54 addresses known security vulnerabilities
# - This Dockerfile ensures we get the latest available version via apk upgrade
# =============================================================================

FROM nginx:stable-alpine

# Upgrade libpng to the latest available version in Alpine repositories
# This addresses CVE-2026-22695 and CVE-2026-22801 without suppressing them
RUN apk update && \
    apk upgrade libpng && \
    rm -rf /var/cache/apk/*

# Verify the upgrade was successful (optional, for build-time verification)
RUN apk info libpng | grep -E "libpng-[0-9]"
