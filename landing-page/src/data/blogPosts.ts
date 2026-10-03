/**
 * Shape of a blog post file in ./blogPosts/*.ts.
 *
 * Posts are discovered from the directory: scripts/generate-blog-index.js builds the metadata
 * index (src/data/blogIndex.ts) at build time and bodies load lazily via blogLoader.ts, so adding
 * a post means adding ONE file – no registry to edit (the daily bot relies on this).
 */
export interface BlogPostData {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  publishedAt: string
  modifiedAt?: string
  author?: string
  readTime: number
  category: string
}
