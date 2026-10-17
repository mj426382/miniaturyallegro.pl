import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LINK_RE } from '../utils/richText'

/**
 * Plain text with inline links written as [label](/path) or [label](https://…), rendered as React elements (no HTML
 * injection). Internal paths use the router (same tab, AC-SEO-017); external links open in a new tab.
 */
export default function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    const index = m.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    const [, label, href] = m
    parts.push(
      href.startsWith('/') ? (
        <Link key={index} to={href} className="text-blue-700 underline underline-offset-2 hover:text-blue-900">
          {label}
        </Link>
      ) : (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2 hover:text-blue-900">
          {label}
        </a>
      ),
    )
    last = index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment>{parts}</Fragment>
}
