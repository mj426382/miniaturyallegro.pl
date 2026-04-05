import post1 from './blogPosts/jak-zrobic-profesjonalne-zdjecia-allegro'
import post2 from './blogPosts/najlepsze-style-grafik-allegro'
import post3 from './blogPosts/ai-w-fotografii-produktowej'

export interface BlogPostData {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  publishedAt: string
  readTime: number
  category: string
}

export { post1, post2, post3 }

export const blogPosts: BlogPostData[] = [post1, post2, post3]
