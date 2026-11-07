const DEFAULTS = {
  variant: 'desktopOSX',
  actionScheme: 'default',
  payloadScheme: 'default',
  decorationScheme: 'web-decoration-gti-v4',
  featureScheme: 'web-features-v6',
  dynamicFeatures: 'RecordingCardSupported',
  widgetScheme: 'web-explore-v48',
}

export const PRIME_PAGE_SIZE = 6

/** Monta o form-urlencoded de POST /api/getLandingPage. */
export function primeLandingForm(dest, page = {}) {
  const pageType = dest?.pageType ?? ''
  const pageId = dest?.pageId ?? ''
  if (!pageType || !pageId) {
    throw new Error(`landing recusado: recebido ${pageType}:${pageId}, esperado pageType e pageId`)
  }
  const fields = {
    ...DEFAULTS,
    pageType,
    pageId,
    pageNumber: String(page.pageNumber ?? 0),
    startIndex: String(page.startIndex ?? 0),
    pageSize: String(page.pageSize ?? PRIME_PAGE_SIZE),
  }
  if (dest.targetId) fields.targetId = dest.targetId
  if (page.serviceToken) fields.serviceToken = page.serviceToken
  return new URLSearchParams(fields)
}
