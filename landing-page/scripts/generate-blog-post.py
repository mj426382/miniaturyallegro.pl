#!/usr/bin/env python3
"""
Daily blog post generator for AllGrafika.pl (docs/specs/10-landing-seo.md, AC-SEO-004).

Run by .github/workflows/daily-blog.yml. Writes src/data/blogPosts/<slug>.ts (the listing index is generated at build time),
refreshes public/sitemap.xml and opens a pull request.

Environment:
  MODELS_TOKEN  token for GitHub Models (GITHUB_TOKEN with `models: read` is enough)
  GH_TOKEN      token for `gh` (a PAT so that CI runs on the PR; falls back to GITHUB_TOKEN)
  BLOG_DRY_RUN  "1" = no API call, no git/gh – the article comes from BLOG_FIXTURE (JSON file)
  BLOG_FIXTURE  path to a JSON article used in dry runs (default: scripts/fixtures/blog-post.sample.json)
  OPENAI_API_KEY  optional – OpenAI is tried first, GitHub Models is the fallback
  BLOG_OPENAI_URL optional – OpenAI-compatible endpoint (tests point it at a local fake)
  BLOG_PUBLISH  "direct" = write the files and stop; the workflow builds the site and pushes to main
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LANDING = REPO_ROOT / "landing-page"
DRY_RUN = os.environ.get("BLOG_DRY_RUN") == "1"


def run(cmd):
    result = subprocess.run(cmd, shell=isinstance(cmd, str), check=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    return result.stdout.strip()


# ── Gather existing articles ────────────────────────────────────────
articles_dir = LANDING / "src/data/blogPosts"
existing = []
for ts_file in sorted(articles_dir.glob("*.ts")):
    text = ts_file.read_text(encoding="utf-8")
    title_m = re.search(r"title:\s*'([^']+)'", text) or re.search(r'title:\s*"([^"]+)"', text)
    slug_m = re.search(r"slug:\s*'([^']+)'", text) or re.search(r'slug:\s*"([^"]+)"', text)
    cat_m = re.search(r"category:\s*'([^']+)'", text) or re.search(r'category:\s*"([^"]+)"', text)
    if title_m:
        existing.append({
            "title": title_m.group(1),
            "slug": slug_m.group(1) if slug_m else "",
            "category": cat_m.group(1) if cat_m else "",
        })

existing_ids = []
for ts_file in articles_dir.glob("*.ts"):
    id_m = re.search(r"id:\s*['\"](\d+)['\"]", ts_file.read_text(encoding="utf-8"))
    if id_m:
        existing_ids.append(int(id_m.group(1)))
next_id = str(max(existing_ids, default=0) + 1)

now = datetime.now()
date_iso = now.strftime("%Y-%m-%d")
existing_str = "\n".join(f"- {e['title']} (slug: {e['slug']}, kat: {e['category']})" for e in existing)

cat_counts = {}
for e in existing:
    cat_counts[e["category"]] = cat_counts.get(e["category"], 0) + 1
cat_summary = ", ".join(f"{k}: {v}" for k, v in sorted(cat_counts.items(), key=lambda x: x[1]))

# ── Prompts ─────────────────────────────────────────────────────────
SYSTEM_PROMPT = (
    "Jesteś doświadczonym copywriterem SEO i strategiem contentu dla AllGrafika.pl "
    "— polskiego narzędzia AI do automatycznego generowania profesjonalnych miniaturek "
    "i zdjęć produktowych dla sprzedawców na Allegro.\n\n"
    "CZYM JEST ALLGRAFIKA.PL:\n"
    "Aplikacja webowa, która:\n"
    "- Przyjmuje zdjęcie produktu (JPG, PNG, WebP) od sprzedawcy\n"
    "- Generuje grafiki w wybranych przez użytkownika stylach: domyślnie zestaw startowy 3 stylów, "
    "łącznie dostępnych jest 19 stylów (uniwersalne, sezonowe i branżowe) + własny prompt\n"
    "- Produkt pozostaje wierny oryginałowi (AI zmienia tylko tło, scenę i oświetlenie)\n"
    "- Umożliwia własny prompt po polsku z opcjonalnym zdjęciem referencyjnym oraz przeróbkę gotowej grafiki\n"
    "- Pozwala kadrować, obracać i poprawiać grafiki w formatach Allegro (1:1, 4:3, 16:9, 3:4) i dodać plakietkę promocyjną\n"
    "- Pisze opis oferty pod SEO Allegro (tytuł do 75 znaków, opis, frazy) – pierwszy opis gratis do każdego zdjęcia z gotową grafiką\n"
    "- Przechowuje wygenerowane grafiki bezpiecznie w chmurze\n"
    "- Kosztuje 1,75-2 zł za grafikę (1 kredyt = 1 grafika), pierwsze 5 grafik jest bezpłatnych\n"
    "- Oszczędza czas i pieniądze vs. tradycyjna sesja fotograficzna (kilkaset zł za produkt)\n\n"
    "DOSTĘPNE STYLE MINIATUREK (wplataj naturalnie — max 2-3 wzmianki na artykuł; NIE wymyślaj innych):\n"
    "- Białe tło — zgodne z wymaganiami zdjęcia głównego Allegro (zestaw startowy)\n"
    "- Lifestyle (wnętrze) — produkt w jasnym, nowoczesnym wnętrzu (zestaw startowy)\n"
    "- Ciemny luksus — ciemne tło z dramatycznym oświetleniem, produkty premium (zestaw startowy)\n"
    "- Gradient — elegancki gradient dopasowany do kolorystyki produktu\n"
    "- Produkt w użyciu — realistyczna scena pokazująca zastosowanie\n"
    "- Wiele ujęć — kolaż 3-4 ujęć z różnych stron\n\n"
    "ZASADY WIARYGODNOŚCI (prawo konsumenckie / UOKiK):\n"
    "- NIE wymyślaj case studies, wyników klientów, nazwisk ani konkretnych procentów wzrostu sprzedaży "
    "przedstawianych jako prawdziwe. Jeśli podajesz liczby, opisuj je jako przykładowe/hipotetyczne "
    "lub cytuj ogólnodostępne, publiczne źródła z nazwą źródła.\n"
    "- NIE pisz, że AllGrafika używa 'własnego/dedykowanego modelu AI' — korzysta z modeli Google Gemini i OpenAI.\n\n"
    "ZASADY PISANIA ARTYKUŁÓW:\n"
    "1. Język: profesjonalny, ale przystępny polski. Bez korporacyjnego żargonu.\n"
    "2. Styl: bezpośredni — zwracaj się do czytelnika 'Ty', 'Twoje produkty', 'Twój sklep'.\n"
    "3. UNIKALNA STRUKTURA: każdy artykuł musi mieć inną strukturę H2/H3 niż pozostałe.\n"
    "   Nie używaj standardowego schematu 'wstęp → lista → podsumowanie'.\n"
    "   Stosuj: porównanie opcji, checklist, Q&A, krok po kroku, typowe błędy, przykład hipotetyczny\n"
    "   (wyraźnie oznaczony jako hipotetyczny, bez konkretnych procentów wzrostu).\n"
    "4. UNIKALNY WSTĘP: zacznij od pytania retorycznego, konkretnej sytuacji sprzedawcy lub\n"
    "   obserwacji z praktyki — nigdy od 'W dzisiejszych czasach' ani ogólnika. Liczby i statystyki\n"
    "   tylko z podaniem publicznego źródła (nazwa + rok), inaczej ich nie używaj.\n"
    "5. SEO On-Page: główna fraza kluczowa w tytule, excercie i pierwszym H2.\n"
    "   Frazy LSI rozsiane naturalnie w treści. NIE powtarzaj frazy kluczowej mechanicznie.\n"
    "6. Długość: 900-1200 słów treści (pole 'content').\n"
    "7. FORMAT pola 'content' — WYŁĄCZNIE liniowy Markdown bez HTML:\n"
    "   - Nagłówek H2: linia zaczynająca się od '## ' (dwa hashe i spacja)\n"
    "   - Nagłówek H3: linia zaczynająca się od '### ' (trzy hashe i spacja)\n"
    "   - Element listy: linia zaczynająca się od '- ' (myślnik i spacja)\n"
    "   - Pogrubienie: **tekst** (dwie gwiazdki z każdej strony)\n"
    "   - Link: [tekst](url) (nawias kwadratowy z tekstem i okrągły z URL)\n"
    "   - Akapit: zwykła linia tekstu\n"
    "   - Odstęp między sekcjami: pusta linia\n"
    "   - BEZ tagów HTML, BEZ numerowanych list (zamiast 1. 2. 3. używaj - )\n"
    "8. Ostatni akapit artykułu: link do strony głównej — dokładnie ta linia:\n"
    "   '[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)'\n"
    "9. Każde INNE wystąpienie nazwy AllGrafika w treści artykułu zapisuj jako "
    "link: [AllGrafika.pl](https://app.allgrafika.pl/register)\n"
    "10. INTERNAL LINKS: w treści artykułu dodaj 1-2 linki do innych powiązanych artykułów "
    "na blogu allgrafika.pl używając formatu [tytuł artykułu](https://allgrafika.pl/blog/slug).\n"
    "11. slug: tylko małe litery ASCII (a-z), myślniki zamiast spacji, "
    "bez polskich znaków diakrytycznych, max 60 znaków, "
    "ZAWSZE zaczyna się od litery (nie cyfry).\n"
    "12. category: jedna z: Poradniki / Technologia / Styl i design / E-commerce / Optymalizacja.\n"
    "    Priorytetuj kategorie z mniejszą liczbą artykułów.\n"
    "13. readTime: liczba całkowita (szacowane minuty czytania, ok. 200 słów/min).\n"
    "14. NIGDY nie powtarzaj tematów z listy istniejących artykułów.\n"
    "15. RÓŻNORODNOŚĆ STRUKTURY H2: używaj od 3 do 5 sekcji H2, każda z innym typem treści\n"
    "    (np. jedna sekcja z listą, jedna z akapitami narracyjnymi, jedna z H3 i podpunktami)."
)

USER_PROMPT = (
    f"Data publikacji: {date_iso}\n\n"
    f"Liczba artykułów per kategoria: {cat_summary}\n\n"
    f"Istniejące artykuły na blogu (NIE powtarzaj tych tematów):\n"
    f"{existing_str}\n\n"
    "Napisz nowy artykuł SEO dla AllGrafika.pl.\n\n"
    "WAŻNE — WYBÓR TEMATU:\n"
    "- Przeczytaj listę istniejących artykułów i wybierz temat, którego NA PEWNO tam nie ma, "
    "także w innym sformułowaniu (inny tytuł o tym samym = duplikat, a duplikaty są odrzucane).\n"
    "- Preferuj konkretne, wąskie tematy (np. jedna kategoria produktowa, jeden problem techniczny, "
    "jedno narzędzie Allegro) zamiast ogólnych 'jak miniaturki wpływają na sprzedaż'.\n"
    "- Tematy już wyczerpane (NIE pisz o nich ponownie): case study ze wzrostem CTR/sprzedaży, "
    "psychologia cen/kolorów/kompozycji/tła, miniaturki na urządzenia mobilne, kampanie sezonowe "
    "i świąteczne, testowanie miniaturek bez budżetu, nowe kategorie Allegro, produkty premium, "
    "zaufanie klientów, decyzje zakupowe, ranking Allegro.\n"
    "- Przykładowe wolne kierunki: konkretne kategorie Allegro jeszcze nieopisane, wymagania Allegro "
    "dla zdjęć w konkretnych kategoriach, przygotowanie zdjęcia wejściowego do AI, błędy w zdjęciach "
    "produktowych, grafiki do Allegro Ads, zdjęcia wariantów produktu, pakowanie i zestawy, "
    "fotografia produktów trudnych (szkło, biżuteria, czarne przedmioty), opisy ofert pod SEO.\n\n"
    "Wymagania dotyczące STRUKTURY tego konkretnego artykułu:\n"
    "- Zacznij od konkretnej sytuacji sprzedawcy albo pytania (nie od ogólnika, bez wymyślonych liczb)\n"
    "- Użyj CO NAJMNIEJ jednej sekcji H2 z praktycznym przykładem oznaczonym jako hipotetyczny\n"
    "- Użyj CO NAJMNIEJ jednej sekcji z podpunktami H3\n"
    "- Zakończ konkretnym CTA lub action item dla czytelnika\n\n"
    "Zwróć WYŁĄCZNIE surowy obiekt JSON (zero markdown, zero ```, zero komentarzy przed/po), "
    "w DOKŁADNIE tym formacie:\n"
    "{\n"
    '  "slug": "slug-bez-polskich-znakow-zaczyna-sie-od-litery-max-60-znakow",\n'
    '  "title": "Tytuł SEO 40-58 znaków zaczynający się od frazy głównej",\n'
    '  "excerpt": "Meta description 120-155 znaków z frazą główną, korzyścią i zachętą.",\n'
    '  "category": "jedna z: Poradniki / Technologia / Styl i design / E-commerce / Optymalizacja",\n'
    '  "readTime": 6,\n'
    '  "content": "## Nagłówek sekcji\\n\\nTekst akapitu z **pogrubieniem**.\\n\\n## Kolejna sekcja..."\n'
    "}"
)

# ── Duplicate detection (spec 10, AC-SEO-006) ───────────────────────
sys.path.insert(0, str(LANDING / "scripts"))
from blog_similarity import duplicate_reason, keyword_taken  # noqa: E402
from check_blog_duplicates import load_posts  # noqa: E402

corpus = load_posts()

# ── Keyword plan (the blog has to bring search traffic) ────────────
KEYWORDS_FILE = LANDING / "scripts/blog-keywords.json"
USED_FILE = LANDING / "scripts/blog-keywords-used.json"
used_keywords = json.loads(USED_FILE.read_text(encoding="utf-8")) if USED_FILE.exists() else []
used_set = {u["keyword"] for u in used_keywords}
plan = json.loads(KEYWORDS_FILE.read_text(encoding="utf-8")) if KEYWORDS_FILE.exists() else []
target = None
for k in plan:
    if k["keyword"] in used_set:
        continue
    covered = keyword_taken(k["keyword"], corpus)
    if covered:
        print(f"Keyword already covered by /blog/{covered['slug']} – skipping: {k['keyword']}")
        if not DRY_RUN:
            used_keywords.append({"keyword": k["keyword"], "slug": covered["slug"], "date": date_iso, "covered": True})
        continue
    target = k
    break
KEYWORD_PROMPT = (
    (
        "\n\nFRAZA GŁÓWNA TEGO ARTYKUŁU (realne zapytanie sprzedawców w Google – artykuł ma na nie "
        f"odpowiadać lepiej niż konkurencja):\n- fraza: \"{target['keyword']}\"\n- kąt: {target['angle']}\n"
        "Tytuł zaczyna się od tej frazy (odmiana dozwolona), slug to fraza bez polskich znaków.\n"
    )
    if target
    else ""
)
SEO_RULES = (
    "\n\nZASADY POD RUCH Z GOOGLE (obowiązkowe):\n"
    "- title: 40-58 znaków (do tytułu doklejamy ' | AllGrafika.pl'), fraza główna na początku, konkret "
    "(liczba, rok 2026 albo korzyść), bez clickbaitu.\n"
    "- excerpt: 120-155 znaków – to meta description: fraza główna + korzyść + zachęta.\n"
    "- Pierwsze 2 zdania pod pierwszym H2 odpowiadają wprost na zapytanie (pod featured snippet).\n"
    "- Długość pola content: 900-1200 słów, konkretne instrukcje zamiast ogólników.\n"
    "- Sekcja '## Najczęstsze pytania' z 3 pytaniami jako '### Pytanie?' i krótką odpowiedzią "
    "(pytania to inne zapytania długiego ogona związane z frazą).\n"
    "- Jedna sekcja z listą kontrolną (checklistą) do zastosowania od razu.\n"
)

ALLOWED_CATEGORIES = {"Poradniki", "Technologia", "Styl i design", "E-commerce", "Optymalizacja"}
STOPWORDS = {"jak", "na", "i", "w", "z", "do", "dla", "o", "a", "sie", "się", "czy", "co",
             "allegro", "miniaturki", "miniaturke", "miniaturka", "miniaturek", "grafiki", "grafik"}


def tokens(text):
    text = re.sub(r"[^a-z0-9ąćęłńóśźż]+", " ", text.lower())
    return {t for t in text.split() if len(t) > 2 and t not in STOPWORDS}


retired_path = LANDING / "src/data/retired-slugs.json"
retired_entries = []
if retired_path.exists():
    retired_entries = [{"slug": r, "title": r.replace("-", " ")} for r in json.loads(retired_path.read_text(encoding="utf-8"))]
vercel_cfg = json.loads((LANDING / "vercel.json").read_text(encoding="utf-8"))
redirected = {r["source"].removeprefix("/blog/") for r in vercel_cfg.get("redirects", [])}


TITLE_RANGE = (40, 58)
EXCERPT_RANGE = (120, 155)
MIN_WORDS = 700  # the prompt asks for 900-1200; below this the article is expanded, not rejected


def word_count(text):
    return len(re.sub(r"<[^>]+>", " ", text or "").split())


def shorten(text, limit):
    """Last resort: cut at a separator or word boundary within the limit, without a dangling separator."""
    text = text.strip()
    if len(text) <= limit:
        return text
    for sep in (" – ", " — ", ": ", "? ", " - "):
        head = text.split(sep)[0].strip()
        if len(head) >= limit * 0.55 and len(head) <= limit:
            return head + ("?" if sep == "? " else "")
    words = text[: limit + 1].rsplit(" ", 1)[0].split()
    # Never end on a conjunction or preposition ("…proporcje i", "…i nie").
    dangling = {"i", "a", "o", "w", "z", "na", "do", "od", "po", "dla", "oraz", "lub", "czy", "jak", "nie", "to", "we", "ze"}
    while len(words) > 3 and words[-1].lower().strip(",;:") in dangling:
        words.pop()
    return re.sub(r"[\s,;:–—-]+$", "", " ".join(words))


def ask_field(field, instruction, article):
    """A short follow-up call that rewrites one field; None when the model does not deliver."""
    system = "Jesteś redaktorem SEO. Odpowiadasz WYŁĄCZNIE obiektem JSON z jednym polem."
    prompt = (
        f"{instruction}\nObecna wartość pola {field}: {article.get(field, '')!r}\n"
        f"Temat artykułu: {article.get('title', '')}\nZwróć JSON: {{\"{field}\": \"...\"}}"
    )
    fixed = generate_online(prompt, system)
    value = fixed.get(field) if isinstance(fixed, dict) else None
    return value.strip() if isinstance(value, str) and value.strip() else None


def repair(article):
    """Fix what a model reliably gets wrong instead of discarding a good article (title/excerpt length,
    too short content). Topic, duplicates and content rules are still judged by article_problem()."""
    if DRY_RUN or not isinstance(article, dict):
        return article
    lo, hi = TITLE_RANGE
    for _ in range(2):
        if lo - 10 <= len(article.get("title", "")) <= hi:
            break
        print(f"Repairing title ({len(article.get('title', ''))} chars)")
        new = ask_field("title", f"Przepisz tytuł tak, aby miał od {lo} do {hi} znaków (policz znaki!), fraza główna na początku, bez cudzysłowów.", article)
        if new:
            article["title"] = new
    if len(article.get("title", "")) > hi:
        article["title"] = shorten(article["title"], hi)
    elo, ehi = EXCERPT_RANGE
    for _ in range(2):
        if elo - 20 <= len(article.get("excerpt", "")) <= ehi:
            break
        print(f"Repairing excerpt ({len(article.get('excerpt', ''))} chars)")
        new = ask_field("excerpt", f"Przepisz meta description tak, aby miał od {elo} do {ehi} znaków (policz znaki!): fraza główna, korzyść, zachęta.", article)
        if new:
            article["excerpt"] = new
    if len(article.get("excerpt", "")) > ehi:
        article["excerpt"] = shorten(article["excerpt"], ehi)
    for _ in range(2):
        words = word_count(article.get("content", ""))
        if words >= MIN_WORDS:
            break
        print(f"Expanding content ({words} words)")
        expanded = ask_field(
            "content",
            f"Rozbuduj ten artykuł do 950-1200 słów (teraz ma {words}): dodaj konkretne kroki, przykłady oznaczone jako "
            "hipotetyczne, checklistę i sekcję najczęstszych pytań. Zachowaj tytuł, ton, linki i zakończenie. "
            "Format: Markdown (## nagłówki, - listy, **pogrubienia**, linki [tekst](url)). Nie wymyślaj liczb ani wyników.",
            article,
        )
        if expanded and word_count(expanded) > words:
            article["content"] = expanded
    return article


def article_problem(article):
    """None when the article can be published, otherwise the reason (fed back to the model)."""
    slug = str(article.get("slug", ""))
    if not re.fullmatch(r"[a-z][a-z0-9-]{2,59}", slug):
        return f"niepoprawny slug {slug!r} (tylko a-z, 0-9, myślniki, max 60 znaków, zaczyna się od litery)"
    if article.get("category") not in ALLOWED_CATEGORIES:
        return f"niedozwolona kategoria {article.get('category')!r}"
    for field_name in ("title", "excerpt", "content"):
        if not str(article.get(field_name, "")).strip():
            return f"brak pola {field_name}"
    body = article.get("content", "")
    # Fabricated "sales grew by 40%" claims are an unfair commercial practice – refuse them unless sourced.
    if re.search(r"(wzros|zwiększ|spad|popraw)\w*[^.\n]{0,40}\bo\s+\d{1,3}\s?%", body, flags=re.I) and "źródło" not in body.lower():
        return "artykuł zawiera procentowy wzrost lub spadek bez źródła – usuń liczby procentowe"
    if re.search(r"<\s*/?\s*[a-z]+[^>]*>", body):
        return "treść zawiera HTML – tylko Markdown"
    if not DRY_RUN:
        if not TITLE_RANGE[0] - 10 <= len(article["title"]) <= TITLE_RANGE[1]:
            return f"tytuł ma {len(article['title'])} znaków – wymagane {TITLE_RANGE[0]}-{TITLE_RANGE[1]}"
        if not EXCERPT_RANGE[0] - 20 <= len(article["excerpt"]) <= EXCERPT_RANGE[1] + 5:
            return f"excerpt ma {len(article['excerpt'])} znaków – wymagane {EXCERPT_RANGE[0]}-{EXCERPT_RANGE[1]}"
        if word_count(body) < MIN_WORDS:
            return f"za krótka treść ({word_count(body)} słów) – wymagane 900-1200"
    if (articles_dir / f"{slug}.ts").exists():
        return f"DUPLICATE: post '{slug}' already exists"
    # Topic and content against every post, plus retired (merged) posts by topic.
    reason = duplicate_reason(article, corpus + [dict(e, content="") for e in retired_entries])
    if reason:
        return reason
    if slug in redirected:
        return f"slug '{slug}' jest przekierowaniem połączonego wpisu – wybierz inny"
    return None


def parse_article(raw):
    # Without response_format the model may wrap the JSON in prose or a code fence – keep the outer object.
    if not raw.lstrip().startswith("{") and "{" in raw and "}" in raw:
        raw = raw[raw.index("{"): raw.rindex("}") + 1]
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}\nRaw: {raw[:300]}")
        return None


def ask(url, headers, model, json_format, user_prompt, system=None):
    """One chat completion; returns the message text or None (and logs why)."""
    import requests  # only needed online

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system or (SYSTEM_PROMPT + SEO_RULES)},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 4000,
        "temperature": 0.8,
        "stream": False,
    }
    if json_format:
        payload["response_format"] = {"type": "json_object"}
    try:
        resp = requests.post(url, headers={**headers, "Content-Type": "application/json"}, json=payload, timeout=180)
    except requests.RequestException as e:
        print(f"{model}: request failed ({type(e).__name__})")
        return None
    ctype = resp.headers.get("content-type", "?")
    print(f"{model} (json_format={json_format}): HTTP {resp.status_code}, {ctype}, {len(resp.content)} bytes")
    if resp.status_code != 200:
        print(resp.text[:300])
        return None
    try:
        return resp.json()["choices"][0]["message"]["content"].strip() or None
    except (ValueError, KeyError, IndexError, TypeError, AttributeError) as e:
        print(f"Unusable response ({type(e).__name__}): {resp.text[:200]!r}")
        return None


def providers():
    # GitHub Models answered a bare "OK" (text/plain) on 2026-10-09 without the current API headers;
    # OpenAI directly is tried first when the OPENAI_API_KEY secret exists.
    out = []
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        openai_url = os.environ.get("BLOG_OPENAI_URL", "https://api.openai.com/v1/chat/completions")
        out.append((openai_url, {"Authorization": f"Bearer {openai_key}"}, "gpt-4.1", True))
    token = os.environ.get("MODELS_TOKEN") or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        gh_headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        for model in ("openai/gpt-4.1", "openai/gpt-4o"):
            out.append(("https://models.github.ai/inference/chat/completions", gh_headers, model, True))
            out.append(("https://models.github.ai/inference/chat/completions", gh_headers, model, False))
    return out


def generate_online(user_prompt, system=None):
    import time

    attempts = providers()
    if not attempts:
        print("ERROR: neither OPENAI_API_KEY nor MODELS_TOKEN / GITHUB_TOKEN is set")
        sys.exit(1)
    for i, (url, headers, model, json_format) in enumerate(attempts):
        raw = ask(url, headers, model, json_format, user_prompt, system)
        if raw:
            article = parse_article(raw)
            if article:
                return article
        if i < len(attempts) - 1:
            time.sleep(10)
    return None


# ── Obtain the article: AI (up to 3 drafts with feedback) or a fixture (dry run) ──
if DRY_RUN:
    fixture = Path(os.environ.get("BLOG_FIXTURE") or (LANDING / "scripts/fixtures/blog-post.sample.json"))
    print(f"DRY RUN – article from {fixture}")
    article = json.loads(fixture.read_text(encoding="utf-8"))
    problem = article_problem(article)
    if problem:
        if problem.startswith("DUPLICATE"):
            print(f"⚠️  Post '{article['slug']}' already exists — skipping to avoid duplicate.")
            sys.exit(0)
        print(f"❌ {problem}")
        sys.exit(1)
else:
    if target:
        print(f"Target keyword: {target['keyword']}")
    feedback = ""
    article = None
    keyword_block = KEYWORD_PROMPT
    for draft in range(1, 4):
        candidate = generate_online(USER_PROMPT + keyword_block + feedback)
        if not candidate:
            print("ERROR: no usable answer from the AI providers")
            sys.exit(1)
        candidate = repair(candidate)
        problem = article_problem(candidate)
        if not problem:
            article = candidate
            break
        print(f"Draft {draft} rejected: {problem}")
        if keyword_block and ("zbyt podobn" in problem or problem.startswith("DUPLICATE")):
            # The planned keyword is already covered by an older post – free topic instead; the keyword is
            # still recorded as used below, so the plan moves on tomorrow.
            print("Target keyword overlaps an existing post – switching to a free topic")
            keyword_block = ""
        feedback = f"\n\nPOPRZEDNIA PROPOZYCJA ZOSTAŁA ODRZUCONA: {problem}. Popraw to w nowej wersji."
    if not article:
        print("ERROR: no acceptable article after 3 drafts")
        sys.exit(1)

# Models like non-breaking and thin spaces; ESLint (no-irregular-whitespace) rejects them – normalise.
IRREGULAR_SPACE = re.compile("[   -     　]")
ZERO_WIDTH = re.compile("[​﻿]")
for _field in ("title", "excerpt", "content"):
    if isinstance(article.get(_field), str):
        article[_field] = ZERO_WIDTH.sub("", IRREGULAR_SPACE.sub(" ", article[_field]))

slug = article["slug"]


# ── Write TS article file ───────────────────────────────────────────
def esc_sq(s):
    """Escape for a TypeScript single-quoted string."""
    return str(s).replace("\\", "\\\\").replace("'", "\\'")


def esc_tl(s):
    """Escape for a TypeScript template literal (backtick string)."""
    return str(s).replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


ts_content = (
    "import type { BlogPostData } from '../blogPosts'\n\n"
    "const post: BlogPostData = {\n"
    f"  id: '{esc_sq(next_id)}',\n"
    f"  slug: '{esc_sq(slug)}',\n"
    f"  title: '{esc_sq(article['title'])}',\n"
    f"  excerpt: '{esc_sq(article['excerpt'])}',\n"
    "  content: `\n"
    f"{esc_tl(article['content'])}\n"
    "  `,\n"
    f"  publishedAt: '{date_iso}',\n"
    f"  modifiedAt: '{date_iso}',\n"
    "  author: 'AllGrafika.pl',\n"
    f"  readTime: {int(article['readTime'])},\n"
    f"  category: '{esc_sq(article['category'])}',\n"
    "}\n\n"
    "export default post\n"
)
out_file = articles_dir / f"{slug}.ts"
out_file.write_text(ts_content, encoding="utf-8")
print(f"Saved: {out_file}")

# The post listing (src/data/blogIndex.ts) is generated from the directory at build time
# (scripts/generate-blog-index.js), so nothing else has to be registered.

# ── Regenerate public/sitemap.xml with correct dates ────────────────
all_posts_meta = []
for ts_file in sorted(articles_dir.glob("*.ts")):
    text = ts_file.read_text(encoding="utf-8")
    slug_m = re.search(r"slug:\s*'([^']+)'", text) or re.search(r'slug:\s*"([^"]+)"', text)
    pub_m = re.search(r"publishedAt:\s*'([^']+)'", text) or re.search(r'publishedAt:\s*"([^"]+)"', text)
    mod_m = re.search(r"modifiedAt:\s*'([^']+)'", text) or re.search(r'modifiedAt:\s*"([^"]+)"', text)
    if slug_m:
        published_at = pub_m.group(1) if pub_m else date_iso
        modified_at = mod_m.group(1) if mod_m else published_at
        all_posts_meta.append({"slug": slug_m.group(1), "lastmod": modified_at or published_at})

most_recent = max((p["lastmod"] for p in all_posts_meta), default=date_iso)


def sitemap_url(loc, lastmod, changefreq, priority):
    return (
        f"  <url>\n"
        f"    <loc>{loc}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f"  </url>"
    )


sitemap_entries = [
    sitemap_url("https://allgrafika.pl/", most_recent, "weekly", "1.0"),
    sitemap_url("https://allgrafika.pl/blog", most_recent, "weekly", "0.9"),
]
for p in sorted(all_posts_meta, key=lambda x: x["lastmod"], reverse=True):
    sitemap_entries.append(sitemap_url(f"https://allgrafika.pl/blog/{p['slug']}", p["lastmod"], "monthly", "0.7"))
sitemap_xml = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "\n".join(sitemap_entries) + "\n"
    "</urlset>\n"
)
(LANDING / "public/sitemap.xml").write_text(sitemap_xml, encoding="utf-8")
print(f"✅ sitemap.xml updated ({len(all_posts_meta)} blog posts)")

# ── Keyword bookkeeping & publishing ────────────────────────────────
if target and not DRY_RUN:
    used_keywords.append({"keyword": target["keyword"], "slug": slug, "date": date_iso})
    USED_FILE.write_text(json.dumps(used_keywords, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if os.environ.get("BLOG_PUBLISH") == "direct" and not DRY_RUN:
    # The workflow builds the landing page and pushes to main only when the build passes.
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write(f"slug={slug}\ntitle={article['title']}\n")
    print(f"✅ Article written: {slug} – the workflow builds and publishes it")
    sys.exit(0)

# ── Git & PR ────────────────────────────────────────────────────────
commit_msg = f"feat(blog): {article['title']} ({date_iso})"
branch = f"blog/{date_iso}-{slug[:40]}"
if DRY_RUN:
    print(f"DRY RUN – would push branch {branch} and open PR: {commit_msg}")
    sys.exit(0)

os.chdir(REPO_ROOT)
run("git config user.name 'github-actions[bot]'")
run("git config user.email 'github-actions[bot]@users.noreply.github.com'")
run(["git", "checkout", "-b", branch])
run("git add landing-page/src/data/ landing-page/public/sitemap.xml")
run(["git", "commit", "-m", commit_msg])
run(["git", "push", "origin", f"HEAD:{branch}"])
pr_body = (
    f"Automatycznie wygenerowany wpis: **{article['title']}**\n\n"
    f"Kategoria: {article['category']} · slug: `{slug}`\n\n"
    "Przed merge sprawdź: brak zmyślonych liczb/case studies, brak duplikatu tematu, poprawny język.\n"
    "CI (kontrola przekierowań, build i prerender) musi być zielone.\n\n"
    "\U0001F916 Generated with GitHub Models"
)
# The label is optional: create it when missing so `gh pr create --label` never fails the run.
subprocess.run(["gh", "label", "create", "blog", "--color", "0E8A16", "--description", "Automatyczny wpis bloga", "--force"], check=False)
run(["gh", "pr", "create", "--base", "main", "--head", branch, "--title", commit_msg, "--body", pr_body, "--label", "blog"])
# Auto-merge after green CI when the repository has auto-merge enabled; otherwise the PR stays open for review.
subprocess.run(["gh", "pr", "merge", branch, "--auto", "--squash"], check=False)
print(f"✅ Opened PR from {branch}: {commit_msg}")
