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
    
    // Must end with .pdf
    if (!pathname.endsWith('.pdf')) {
      return false;
    }
    
    // If it's from SharePoint/OneDrive/1drv.ms, only allow if it has explicit download parameter
    if (isHostnameOrSubdomain(hostname, 'sharepoint.com') ||
        isHostnameOrSubdomain(hostname, 'onedrive.live.com') ||
        isHostnameOrSubdomain(hostname, '1drv.ms')) {
      // Only allow if it has download=1 or similar direct download indicator
      return urlLower.includes('download=1') || urlLower.includes('?download=1');
    }
    
    // For other domains, allow direct PDF links
    return true;
  } catch (e) {
    return false;
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
  
  // Check if likely to redirect to login
  if (isLikelyToRedirectToLogin(url)) {
    return { ok: false, reason: 'microsoft-web-link' };
  }
  
  // Check if it's a direct PDF URL
  if (isDirectPdfUrl(url)) {
    return { ok: true };
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
  
  // Only return URL if we should attempt embedding (direct PDF)
  if (decision.ok) {
    return url;
  }
  
  // For all other cases, return null (will show fallback)
  return null;
}
