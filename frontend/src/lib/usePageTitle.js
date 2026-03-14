import { useEffect } from 'react';

/**
 * Sets the document title and fires a GA4 page_view event.
 * Usage: usePageTitle('Dashboard') → "Dashboard | Valuora"
 */
export function usePageTitle(title) {
  useEffect(() => {
    const full = title ? `${title} | Valuora` : 'Valuora — Professional Business Valuation';
    document.title = full;

    // GA4 page_view
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: full,
        page_location: window.location.href,
        page_path: window.location.pathname,
      });
    }
  }, [title]);
}
