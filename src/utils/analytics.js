export const trackEvent = (eventName, payload = {}) => {
  const event = {
    eventName,
    payload,
    timestamp: new Date().toISOString(),
  }

  console.info('[analytics]', event)
}
