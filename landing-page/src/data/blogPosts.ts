import post1 from './blogPosts/jak-zrobic-profesjonalne-zdjecia-allegro'
import post2 from './blogPosts/najlepsze-style-grafik-allegro'
import post3 from './blogPosts/ai-w-fotografii-produktowej'
import idealnaMiniaturkaAllegroElektronika from './blogPosts/idealna-miniaturka-allegro-elektronika'
import jakZwiekszycCtrNaAllegroMiniaturki from './blogPosts/jak-zwiekszyc-ctr-na-allegro-miniaturki'
import jakStworzycMiniaturkeAllegroUroda from './blogPosts/jak-stworzyc-miniaturke-allegro-uroda'
import wymaganiaTechniczneAllegroZdjecia20252026 from './blogPosts/wymagania-techniczne-allegro-zdjecia-2025-2026'

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

export { post1, post2, post3, idealnaMiniaturkaAllegroElektronika, jakZwiekszycCtrNaAllegroMiniaturki, jakStworzycMiniaturkeAllegroUroda, wymaganiaTechniczneAllegroZdjecia20252026 }

export const blogPosts: BlogPostData[] = [wymaganiaTechniczneAllegroZdjecia20252026, jakStworzycMiniaturkeAllegroUroda, jakZwiekszycCtrNaAllegroMiniaturki, idealnaMiniaturkaAllegroElektronika, post1, post2, post3]
