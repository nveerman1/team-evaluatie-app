# =============================================================================
# Custom Nginx Dockerfile with Updated libpng
# =============================================================================
# This Dockerfile extends the official nginx:stable-alpine image to upgrade
# libpng to the latest available version, addressing security vulnerabilities.
#
# Instead of suppressing Trivy warnings for libpng CVEs, we actively upgrade
# the library to the latest version available in Alpine's repositories.
# =============================================================================

FROM nginx:stable-alpine

# Upgrade libpng to the latest available version
# This addresses CVE-2026-22695 and CVE-2026-22801
RUN apk update && \
    apk upgrade libpng && \
    rm -rf /var/cache/apk/*

# Verify the upgrade was successful (optional, for build-time verification)
RUN apk info libpng | grep -E "libpng-[0-9]"
