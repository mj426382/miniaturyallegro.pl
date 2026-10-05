const APP_URL = 'https://app.allgrafika.pl'

/**
 * Spec 18, AC-MOB-008: "the mobile app is on its way". Plain text and an inline icon only – no
 * images (nothing new for LCP) and no official store badges until the apps are actually listed.
 */
export default function MobileAppTeaser() {
  return (
    <section id="aplikacja-mobilna" aria-labelledby="mobile-app-heading" className="py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 sm:p-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
          <svg viewBox="0 0 24 24" className="h-14 w-14 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <path d="M10.5 18.5h3" strokeLinecap="round" />
            <path d="M9 9.5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex-1">
            <p className="inline-block text-xs font-semibold uppercase tracking-wide text-blue-700 bg-white/70 rounded-full px-3 py-1 mb-3">Wkrótce</p>
            <h2 id="mobile-app-heading" className="text-2xl md:text-3xl font-bold text-gray-900">
              Aplikacja mobilna na Androida i iOS jest w drodze
            </h2>
            <p className="text-gray-600 mt-3">
              Zrobisz zdjęcie produktu telefonem i od razu wygenerujesz miniaturki – z tym samym kontem, kredytami i grafikami co w przeglądarce. Do czasu premiery aplikacja webowa działa na każdym
              telefonie bez instalacji.
            </p>
          </div>
          <a href={`${APP_URL}/register`} className="inline-block text-center bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 whitespace-nowrap self-start md:self-auto">
            Używaj już teraz w przeglądarce
          </a>
        </div>
      </div>
    </section>
  )
}
