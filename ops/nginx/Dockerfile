# =============================================================================
# Custom Nginx Dockerfile with upgraded Alpine packages
# =============================================================================
# This Dockerfile extends the official nginx:stable-alpine image and upgrades
# all Alpine packages to their latest available versions, addressing security
# vulnerabilities without suppressing Trivy warnings.
#
# Packages upgraded by this image (among others):
# - libpng  (CVE-2026-22695, CVE-2026-22801)
# - zlib    (CVE-2026-22184, fixed in 1.3.2-r0)
# - libexpat (CVE-2026-32767, fixed in 2.7.5-r0)
# =============================================================================

FROM nginx:stable-alpine

# Upgrade all Alpine packages to pick up latest security patches
RUN apk upgrade --no-cache
