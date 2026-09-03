/** True when a Source string is an http(s) URL that should render as a link. */
export function isUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}
