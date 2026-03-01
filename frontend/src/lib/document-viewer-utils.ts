/**
 * Helper functions for document viewer functionality
 */

/**
 * Check if a hostname is an exact match or valid subdomain of a domain
 * @param hostname The hostname to check (should be lowercase)
 * @param domain The domain to match against
 * @returns true if hostname is domain or a valid subdomain of domain
 */
export function isHostnameOrSubdomain(hostname: string, domain: string): boolean {
  if (hostname === domain) return true;
  // Check if it ends with .domain and has a dot before it (preventing evil-domain.com matches)
  return hostname.endsWith('.' + domain);
}

/**
 * Check if a hostname is known to block iframe embedding
 * These hosts typically redirect to login or refuse iframe connections
 * @param hostname The hostname to check (should be lowercase)
 * @returns true if the hostname is known to block iframe embedding
 */
export function isBlockedIframeHost(hostname: string): boolean {
  if (!hostname) return false;
  
  const blockedDomains = [
    'login.microsoftonline.com',
    'login.live.com',
    'account.live.com',
    'microsoftonline.com', // Blocks most iframe embeds
    'msauth.net',
    'msauthimages.net',
  ];
  
  return blockedDomains.some(domain => isHostnameOrSubdomain(hostname, domain));
}

/**
 * Safely extract hostname from a URL
 * @param url The URL to parse
 * @returns The hostname in lowercase, or null if invalid
 */
export function safeHostname(url: string | null | undefined): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch (e) {
    return null;
  }
}

/**
 * Check if a URL matches a SharePoint PDF viewer or embed URL pattern
 * (e.g., /:b:/ sharing links, /preview paths, or action=embedview parameter)
 * @param url The URL to check
 * @returns true if the URL is a SharePoint PDF viewer/embed URL
 */
export function isSharePointPdfViewerUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    if (!isHostnameOrSubdomain(hostname, 'sharepoint.com') &&
        !isHostnameOrSubdomain(hostname, 'onedrive.live.com') &&
        !isHostnameOrSubdomain(hostname, '1drv.ms')) {
      return false;
    }

    return pathname.includes('/:b:/') ||
           pathname.endsWith('/preview') ||
           urlObj.searchParams.get('action') === 'embedview' ||
           // Personal OneDrive consumer PDF short links: 1drv.ms/b/c/<userId>/<itemId>
           (isHostnameOrSubdomain(hostname, '1drv.ms') && /^\/b\/c\//.test(pathname));
  } catch (e) {
    return false;
  }
}

/**
 * Check if a URL belongs to a trusted Microsoft domain for document viewing
 * @param url The URL to validate
 * @returns true if the URL is from a trusted Microsoft domain
 */
export function isTrustedMicrosoftUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Allowlist of trusted Microsoft domains
    const trustedDomains = [
      'sharepoint.com',
      'sharepoint-df.com',
      'onedrive.live.com',
      '1drv.ms',
      'office.com',
      'officeapps.live.com',
      'microsoft.com',
    ];
    
    return trustedDomains.some(domain => isHostnameOrSubdomain(hostname, domain));
  } catch (e) {
    // Invalid URL
    return false;
  }
}

/**
 * Detect the file type from a URL based on extension or query parameters
 * @param url The URL to analyze
 * @returns A hint about the file type
 */
export function getFileHint(url: string | null | undefined): "pdf" | "doc" | "ppt" | "unknown" {
  if (!url) return "unknown";
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const urlLower = url.toLowerCase();
    
    // Check for PDF - look for .pdf extension specifically
    if (pathname.endsWith('.pdf') || /\.pdf(\?|#|$)/.test(urlLower)) {
      return "pdf";
    }
    
    // Check for Word documents - specific patterns
    if (pathname.endsWith('.doc') || pathname.endsWith('.docx') || 
        /\.docx?(\?|#|$)/.test(urlLower) ||
        urlObj.hostname.toLowerCase() === 'word.office.com' ||
        urlObj.hostname.toLowerCase().endsWith('.word.office.com') ||
        /\/w\/[^/]*$/.test(pathname)) { // Office Online word path pattern
      return "doc";
    }
    
    // Check for PowerPoint presentations - specific patterns
    if (pathname.endsWith('.ppt') || pathname.endsWith('.pptx') || 
        /\.pptx?(\?|#|$)/.test(urlLower) ||
        urlObj.hostname.toLowerCase() === 'powerpoint.office.com' ||
        urlObj.hostname.toLowerCase().endsWith('.powerpoint.office.com') ||
        /\/p\/[^/]*$/.test(pathname)) { // Office Online PowerPoint path pattern
      return "ppt";
    }
    
    return "unknown";
  } catch (e) {
    return "unknown";
  }
}

/**
 * Check if a URL is likely to redirect to login/auth pages
 * These are typically SharePoint/OneDrive/Office web app links that require authentication
 * @param url The URL to check
 * @returns true if the URL is likely to redirect to login
 */
export function isLikelyToRedirectToLogin(url: string | null | undefined): boolean {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const urlLower = url.toLowerCase();
    
    // Check if hostname is a Microsoft web app domain
    if (isHostnameOrSubdomain(hostname, 'sharepoint.com') ||
        isHostnameOrSubdomain(hostname, '1drv.ms') ||
        isHostnameOrSubdomain(hostname, 'onedrive.live.com') ||
        isHostnameOrSubdomain(hostname, 'office.com')) {
      
      // Check for typical sharing/web app query parameters
      const redirectIndicators = [
        '?e=',
        '?share=',
        'guestaccess',
        'sourcedoc',
        'web=1',
        'download=0',
        ':b:/', // SharePoint file link pattern
        '/_layouts/',
      ];
      
      return redirectIndicators.some(indicator => urlLower.includes(indicator));
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Check if a URL is a direct PDF link (not a web app link)
 * @param url The URL to check
 * @returns true if the URL is a direct PDF link that can be embedded
 */
export function isDirectPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    const urlLower = url.toLowerCase();
    
    // Must end with .pdf or be a recognised SharePoint PDF viewer URL
    const hasPdfExtension = pathname.endsWith('.pdf');
    const isSpViewerUrl = isSharePointPdfViewerUrl(url);

    if (!hasPdfExtension && !isSpViewerUrl) {
      return false;
    }

    // If it's from SharePoint/OneDrive/1drv.ms, only allow if it has explicit download parameter
    // or matches a known SharePoint PDF viewer/embed URL pattern
    if (isHostnameOrSubdomain(hostname, 'sharepoint.com') ||
        isHostnameOrSubdomain(hostname, 'onedrive.live.com') ||
        isHostnameOrSubdomain(hostname, '1drv.ms')) {
      return urlLower.includes('download=1') || isSpViewerUrl;
    }
    
    // For other domains, allow direct PDF links
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Try to convert a SharePoint/OneDrive PDF URL into an embeddable iframe URL.
 * - Pattern 1: SharePoint /:b:/ sharing links → set action=embedview
 * - Pattern 2: Direct SharePoint PDF file paths → proxy via view.officeapps.live.com
 * @param url The original document URL
 * @returns An embeddable URL, or null if the URL is not a supported SharePoint PDF
 */
export function tryGetSharePointPdfEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    if (!isHostnameOrSubdomain(hostname, 'sharepoint.com') &&
        !isHostnameOrSubdomain(hostname, 'onedrive.live.com') &&
        !isHostnameOrSubdomain(hostname, '1drv.ms')) {
      return null;
    }

    // Pattern 1: SharePoint /:b:/ sharing links → use action=embedview
    // Clear existing query params (e.g. ?e=<token>) and set only action=embedview
    if (pathname.includes('/:b:/')) {
      const embedUrl = new URL(url);
      embedUrl.search = '';
      embedUrl.searchParams.set('action', 'embedview');
      return embedUrl.toString();
    }

    // Pattern 2: Personal OneDrive consumer PDF short links: 1drv.ms/b/c/<userId>/<itemId>
    // Keep the ?e= sharing token and add action=embedview so the redirect lands on the embed viewer
    if (isHostnameOrSubdomain(hostname, '1drv.ms') && /^\/b\/c\//.test(pathname)) {
      const embedUrl = new URL(url);
      embedUrl.searchParams.set('action', 'embedview');
      return embedUrl.toString();
    }

    // Pattern 3: Direct PDF file paths → proxy via view.officeapps.live.com
    if (pathname.endsWith('.pdf')) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Determine if inline embedding should be attempted for a URL
 * @param url The URL to check
 * @returns Object with ok boolean and optional reason string
 */
export function shouldAttemptInlineEmbed(url: string | null | undefined): { ok: boolean; reason?: string } {
  if (!url) {
    return { ok: false, reason: 'no-url' };
  }
  
  // Check if URL is trusted
  if (!isTrustedMicrosoftUrl(url)) {
    return { ok: false, reason: 'untrusted' };
  }
  
  // Check if hostname is blocked
  const hostname = safeHostname(url);
  if (hostname && isBlockedIframeHost(hostname)) {
    return { ok: false, reason: 'blocked-host' };
  }
  
  // Check if it's a direct PDF URL (includes SharePoint viewer patterns)
  if (isDirectPdfUrl(url)) {
    return { ok: true };
  }

  // Check if the URL points to a PDF based on file hint — getViewerUrl will handle conversion
  if (getFileHint(url) === 'pdf') {
    return { ok: true };
  }

  // Check if likely to redirect to login (checked after PDF checks so SharePoint PDF
  // links are not prematurely rejected)
  if (isLikelyToRedirectToLogin(url)) {
    return { ok: false, reason: 'microsoft-web-link' };
  }

  // For all other cases (Office docs, etc.), don't attempt embedding
  return { ok: false, reason: 'not-direct-pdf' };
}

/**
 * Generate a viewer URL for Office documents
 * For v1, only returns URL for direct PDF links that can be safely embedded
 * @param url The original document URL
 * @returns The URL to use in the iframe, or null if embedding should not be attempted
 */
export function getViewerUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const decision = shouldAttemptInlineEmbed(url);
  
  // Only return URL if we should attempt embedding
  if (decision.ok) {
    // Try to convert SharePoint PDF URLs to an embeddable format; fall back to original URL
    return tryGetSharePointPdfEmbedUrl(url) ?? url;
  }

  // Fallback: some SharePoint PDF URLs (e.g. /:b:/ sharing links) are rejected by
  // shouldAttemptInlineEmbed because they superficially match redirect-to-login patterns,
  // but can be converted into a safe embeddable URL by tryGetSharePointPdfEmbedUrl.
  if (decision.reason === 'microsoft-web-link' || decision.reason === 'not-direct-pdf') {
    return tryGetSharePointPdfEmbedUrl(url);
  }

  // For all other cases, return null (will show fallback)
  return null;
}
