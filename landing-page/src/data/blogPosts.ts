import post1 from './blogPosts/jak-zrobic-profesjonalne-zdjecia-allegro'
import post2 from './blogPosts/najlepsze-style-grafik-allegro'
import post3 from './blogPosts/ai-w-fotografii-produktowej'
import idealnaMiniaturkaAllegroElektronika from './blogPosts/idealna-miniaturka-allegro-elektronika'
import jakZwiekszycCtrNaAllegroMiniaturki from './blogPosts/jak-zwiekszyc-ctr-na-allegro-miniaturki'

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

export { post1, post2, post3, idealnaMiniaturkaAllegroElektronika, jakZwiekszycCtrNaAllegroMiniaturki }

export const blogPosts: BlogPostData[] = [jakZwiekszycCtrNaAllegroMiniaturki, idealnaMiniaturkaAllegroElektronika, post1, post2, post3]
