/** Accept only in-app hash routes from push notification payloads. */
export function safePushUrlHash(urlHash: unknown): string {
  return typeof urlHash === 'string' && urlHash.startsWith('#') ? urlHash : '';
}
