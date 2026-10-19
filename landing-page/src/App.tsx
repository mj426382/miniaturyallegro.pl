import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Blog from './pages/Blog'
import BlogPostPage from './pages/BlogPost'
import Regulamin from './pages/Regulamin'
import PolitykaPrywatnosci from './pages/PolitykaPrywatnosci'
import NotFound from './pages/NotFound'
import CookieBanner from './consent/CookieBanner'
import PageViewTracker from './consent/PageViewTracker'
import SeoLanding from './pages/SeoLanding'
import { seoPages } from './data/seoPages'
import ProgramPartnerski from './pages/ProgramPartnerski'
import { PARTNER_PAGE_PATH } from './data/partnerProgram'
import PhotoCheckerRoute from './pages/PhotoCheckerRoute'
import { PHOTO_CHECKER_PATH } from './data/photoChecker'

/** Route table shared by the browser app and the prerender (SSG) script. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/regulamin" element={<Regulamin />} />
      <Route path="/polityka-prywatnosci" element={<PolitykaPrywatnosci />} />
      <Route path={PARTNER_PAGE_PATH} element={<ProgramPartnerski />} />
      <Route path={PHOTO_CHECKER_PATH} element={<PhotoCheckerRoute />} />
      {seoPages.map((p) => (
        <Route key={p.path} path={p.path} element={<SeoLanding key={p.path} page={p} />} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <PageViewTracker />
      <AppRoutes />
      <CookieBanner />
    </BrowserRouter>
  )
}
