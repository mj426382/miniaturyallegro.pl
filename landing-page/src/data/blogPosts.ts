import post1 from './blogPosts/jak-zrobic-profesjonalne-zdjecia-allegro'
import post2 from './blogPosts/najlepsze-style-grafik-allegro'
import post3 from './blogPosts/ai-w-fotografii-produktowej'
import idealnaMiniaturkaAllegroElektronika from './blogPosts/idealna-miniaturka-allegro-elektronika'
import jakZwiekszycCtrNaAllegroMiniaturki from './blogPosts/jak-zwiekszyc-ctr-na-allegro-miniaturki'
import jakStworzycMiniaturkeAllegroUroda from './blogPosts/jak-stworzyc-miniaturke-allegro-uroda'
import wymaganiaTechniczneAllegroZdjecia20252026 from './blogPosts/wymagania-techniczne-allegro-zdjecia-2025-2026'
import jakStworzycMiniaturkeAllegroOdziez from './blogPosts/jak-stworzyc-miniaturke-allegro-odziez'
import psychologiaKolorowWMiniaturkachAllegro from './blogPosts/psychologia-kolorow-w-miniaturkach-allegro'
import jakStworzycMiniaturkeAllegroDomIOgrod from './blogPosts/jak-stworzyc-miniaturke-allegro-dom-i-ogrod'
import jakZbudowacSpojnaIdentyfikacjeWizualnaAllegro from './blogPosts/jak-zbudowac-spojna-identyfikacje-wizualna-allegro'
import jakZwiekszycCtrAbTestowanieMiniaturek from './blogPosts/jak-zwiekszyc-ctr-ab-testowanie-miniaturek'
import mobilePhotographyDlaSprzedawcowAllegro from './blogPosts/mobile-photography-dla-sprzedawcow-allegro'
import jakStworzycMiniaturkeAllegroDlaMotoryzacji from './blogPosts/jak-stworzyc-miniaturke-allegro-dla-motoryzacji'
import jakAiGenerujeOpisyIStyleMiniaturek from './blogPosts/jak-ai-generuje-opisy-i-style-miniaturek'
import flatLayJakTworzycEstetyczneUkladyProduktow from './blogPosts/flat-lay-jak-tworzyc-estetyczne-uklady-produktow'

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

export { post1, post2, post3, idealnaMiniaturkaAllegroElektronika, jakZwiekszycCtrNaAllegroMiniaturki, jakStworzycMiniaturkeAllegroUroda, wymaganiaTechniczneAllegroZdjecia20252026, jakStworzycMiniaturkeAllegroOdziez, psychologiaKolorowWMiniaturkachAllegro, jakStworzycMiniaturkeAllegroDomIOgrod, jakZbudowacSpojnaIdentyfikacjeWizualnaAllegro, jakZwiekszycCtrAbTestowanieMiniaturek, mobilePhotographyDlaSprzedawcowAllegro, jakStworzycMiniaturkeAllegroDlaMotoryzacji, jakAiGenerujeOpisyIStyleMiniaturek, flatLayJakTworzycEstetyczneUkladyProduktow }

export const blogPosts: BlogPostData[] = [flatLayJakTworzycEstetyczneUkladyProduktow, jakAiGenerujeOpisyIStyleMiniaturek, jakStworzycMiniaturkeAllegroDlaMotoryzacji, mobilePhotographyDlaSprzedawcowAllegro, jakZwiekszycCtrAbTestowanieMiniaturek, jakZbudowacSpojnaIdentyfikacjeWizualnaAllegro, jakStworzycMiniaturkeAllegroDomIOgrod, psychologiaKolorowWMiniaturkachAllegro, jakStworzycMiniaturkeAllegroOdziez, wymaganiaTechniczneAllegroZdjecia20252026, jakStworzycMiniaturkeAllegroUroda, jakZwiekszycCtrNaAllegroMiniaturki, idealnaMiniaturkaAllegroElektronika, post1, post2, post3]
