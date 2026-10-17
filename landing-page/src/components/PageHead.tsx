import { Helmet } from 'react-helmet-async'
import { DEFAULT_OG_IMAGE, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, SITE_NAME, SITE_URL } from '../data/site'

interface PageHeadProps {
  /** Full <title> (already passed through pageTitle where the brand suffix applies). */
  title: string
  description: string
  /** Path of the page, e.g. "/blog" – the canonical and og:url are built from it. */
  path: string
  /** Absolute URL or site path of a 1200×630 PNG (AC-SEO-019). */
  image?: string
  imageAlt: string
  type?: 'website' | 'article'
  /** JSON-LD blocks, each rendered as its own script tag. */
  jsonLd?: object[]
  /** Extra tags (article:published_time…). */
  children?: React.ReactNode
}

/** The per-route SEO head shared by every page (spec 10): title, description, canonical, Open Graph, Twitter, JSON-LD. */
export default function PageHead({ title, description, path, image = DEFAULT_OG_IMAGE, imageAlt, type = 'website', jsonLd = [], children }: PageHeadProps) {
  const url = path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
  const imageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="pl_PL" />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content={OG_IMAGE_WIDTH} />
      <meta property="og:image:height" content={OG_IMAGE_HEIGHT} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={imageAlt} />
      {children}
      {jsonLd.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  )
}
