import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { HelmetProvider, HelmetServerState } from 'react-helmet-async'
import { AppRoutes } from './App'
import { primePostCache } from './data/blogLoader'
import { allPosts } from './data/blogContent.server'
import { primeLegalCache } from './data/legalLoader'
import RegulaminContent from './legal/RegulaminContent'
import PolitykaContent from './legal/PolitykaContent'

primePostCache(allPosts)
primeLegalCache({ regulamin: RegulaminContent, polityka: PolitykaContent })

export interface RenderResult {
  html: string
  head: string
}

/**
 * Server-side render used by scripts/prerender.js to produce static HTML for
 * every route (SSG). Crawlers and users get full content without JavaScript;
 * the client bundle then hydrates the page.
 */
export function render(url: string): RenderResult {
  const helmetContext: { helmet?: HelmetServerState } = {}
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </HelmetProvider>,
  )
  const helmet = helmetContext.helmet
  const head = helmet ? [helmet.title.toString(), helmet.meta.toString(), helmet.link.toString(), helmet.script.toString()].filter(Boolean).join('\n') : ''
  return { html, head }
}
