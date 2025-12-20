/**
 * Helper functions for document viewer functionality
 */

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
      '.sharepoint.com',
      '.sharepoint-df.com',
      'onedrive.live.com',
      '.1drv.ms',
      '.office.com',
      '.officeapps.live.com',
      '.microsoft.com',
    ];
    
    return trustedDomains.some(domain => {
      if (domain.startsWith('.')) {
        // Wildcard subdomain match
        return hostname.endsWith(domain) || hostname === domain.slice(1);
      }
      // Exact match
      return hostname === domain;
    });
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
 * Generate a viewer URL for Office documents
 * For SharePoint/OneDrive links, try to use them directly
 * @param url The original document URL
 * @param fileHint The type of file
 * @returns The URL to use in the iframe
 */
export function getViewerUrl(url: string | null | undefined, fileHint: string): string | null {
  if (!url) return null;
  
  // For PDF, use the original URL directly
  if (fileHint === "pdf") {
    return url;
  }
  
  // For Office documents, check if it's already an Office Online link
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Check if it's an Office Online URL using proper hostname validation
    if (hostname.endsWith('.office.com') || 
        hostname === 'office.com' ||
        hostname.endsWith('.officeapps.live.com') ||
        hostname === 'officeapps.live.com' ||
        hostname.endsWith('onedrive.live.com') ||
        hostname === 'onedrive.live.com' ||
        url.includes('/_layouts/')) {
      // Already an Office viewer link, use it directly
      return url;
    }
  } catch (e) {
    // Invalid URL, return as-is
    return url;
  }
  
  // For other Office document links, use the original URL
  // SharePoint/OneDrive will handle the viewing, though may block embedding
  return url;
}
