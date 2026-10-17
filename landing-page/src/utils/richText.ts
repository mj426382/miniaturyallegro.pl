/** Inline link markup used in landing page copy: [label](/internal-path) or [label](https://external.url). */
export const LINK_RE = /\[([^\]]+)\]\(((?:\/|https:\/\/)[^\s)]+)\)/g

/** The text without link markup – for meta tags and JSON-LD. */
export function plainText(text: string): string {
  return text.replace(LINK_RE, '$1')
}
