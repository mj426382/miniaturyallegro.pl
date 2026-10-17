#!/usr/bin/env python3
"""
Blog post generator for AllGrafika.pl (docs/specs/23-blog-bot.md, docs/specs/10-landing-seo.md AC-SEO-004…006, 012).

Run by .github/workflows/daily-blog.yml. Picks the next topic from the researched e-commerce plan
(blog-keywords.json via blog_plan.py – cluster rotation, seasonal windows, pillar guides), writes the article with
a type-specific brief, repairs what code can repair and rejects drafts that fail the quality gates
(blog_quality.py) or duplicate an existing post (blog_similarity.py). Writes src/data/blogPosts/<slug>.ts
(the listing index is generated at build time) and refreshes public/sitemap.xml.

Environment:
  MODELS_TOKEN  token for GitHub Models (GITHUB_TOKEN with `models: read` is enough)
  GH_TOKEN      token for `gh` (a PAT so that CI runs on the PR; falls back to GITHUB_TOKEN)
  BLOG_DRY_RUN  "1" = no API call, no git/gh – the article comes from BLOG_FIXTURE (JSON file); the same gates run
  BLOG_FIXTURE  path to a JSON article used in dry runs (default: scripts/fixtures/blog-post.sample.json)
  OPENAI_API_KEY  optional – OpenAI is tried first, GitHub Models is the fallback
  BLOG_OPENAI_URL optional – OpenAI-compatible endpoint (tests point it at a local fake)
  BLOG_PUBLISH  "direct" = write the files and stop; the workflow builds the site and pushes to main
  BLOG_TODAY    optional YYYY-MM-DD – the date used for the seasonal calendar (tests)
  BLOG_PLAN_FILE / BLOG_LEDGER_FILE  optional paths instead of blog-keywords.json / blog-keywords-used.json (tests)
  BLOG_POSTS_DIR / BLOG_SITEMAP_FILE optional paths instead of src/data/blogPosts / public/sitemap.xml (tests)
  GITHUB_STEP_SUMMARY / GITHUB_OUTPUT – set by GitHub Actions; the run is summarised there
"""
import json
import os
import re
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LANDING = REPO_ROOT / "landing-page"
SCRIPTS = LANDING / "scripts"
DRY_RUN = os.environ.get("BLOG_DRY_RUN") == "1"
DIRECT = os.environ.get("BLOG_PUBLISH") == "direct"

sys.path.insert(0, str(SCRIPTS))
from blog_plan import (  # noqa: E402
    EVENTS, LEDGER_FILE, availability, link_title, load_ledger, load_plan, next_event, pick_topic, resolve_link,
    simulate, site_context, validate_plan,
)
from blog_quality import (  # noqa: E402
    ARTICLE_TYPES, EXCERPT_MAX, EXCERPT_MIN, FREE_GRAPHICS, HOME_LINK, PLATFORMS, REGISTER_URL, TITLE_MAX, TITLE_MIN,
    normalize, problems as quality_problems, sections, word_count,
)
from blog_similarity import duplicate_reason, keyword_taken, reserved_by  # noqa: E402
from check_blog_duplicates import load_posts  # noqa: E402

# ── Job summary (visible in the GitHub Actions run) ─────────────────
SUMMARY = []


def summary(line=""):
    print(line)
    SUMMARY.append(line)


def flush_summary():
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path and SUMMARY:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write("\n".join(SUMMARY) + "\n\n")
        SUMMARY.clear()


def set_output(**values):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            for k, v in values.items():
                fh.write(f"{k}={str(v).replace(chr(10), ' ')}\n")


def fail(message):
    summary(f"❌ **{message}**")
    print(f"::error::{message}")
    flush_summary()
    sys.exit(1)


def run(cmd):
    result = subprocess.run(cmd, shell=isinstance(cmd, str), check=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    return result.stdout.strip()


# ── Context: live site, plan, ledger ────────────────────────────────
articles_dir = Path(os.environ.get("BLOG_POSTS_DIR") or (LANDING / "src/data/blogPosts"))
SITEMAP = Path(os.environ.get("BLOG_SITEMAP_FILE") or (LANDING / "public/sitemap.xml"))
site = site_context()
PLAN_PATH = Path(os.environ.get("BLOG_PLAN_FILE") or (SCRIPTS / "blog-keywords.json"))
LEDGER_PATH = Path(os.environ.get("BLOG_LEDGER_FILE") or LEDGER_FILE)
plan = load_plan(PLAN_PATH)
ledger = load_ledger(LEDGER_PATH)
corpus = load_posts()
today = date.fromisoformat(os.environ["BLOG_TODAY"]) if os.environ.get("BLOG_TODAY") else datetime.now().date()
date_iso = datetime.now().strftime("%Y-%m-%d")
next_id = str(max((int(m.group(1)) for f in articles_dir.glob("*.ts") if (m := re.search(r"id:\s*['\"](\d+)['\"]", f.read_text(encoding="utf-8")))), default=0) + 1)
retired_entries = [{"slug": r, "title": r.replace("-", " ")} for r in site["retired"]]
redirected = {src.removeprefix("/blog/") for src in site["redirects"]}

summary("## 📝 Blog bot – " + ("dry run (przykładowy artykuł, bez API i publikacji)" if DRY_RUN else "nowy artykuł"))
plan_problems, plan_warnings = validate_plan(plan, site)
if plan_problems:
    fail("Plan tematów jest niepoprawny: " + "; ".join(plan_problems[:5]))
for w in plan_warnings:
    print(f"warning: {w}")

# Spec 10, AC-SEO-012: the tool does not support this marketplace any more – no article may be about it.
UNSUPPORTED_PLATFORM = re.compile(r"allegro", re.I)
ALLOWED_CATEGORIES = {"Poradniki", "Technologia", "Styl i design", "E-commerce", "Optymalizacja"}


def mark_covered(entry, slug, reason):
    print(f"Skipping keyword ({reason}): {entry['keyword']}")
    if not DRY_RUN:
        ledger.append({"keyword": entry["keyword"], "slug": slug, "date": date_iso, "covered": True, "cluster": entry["cluster"], "type": entry["type"]})


def available(entry):
    """Reserved for a landing page (AC-SEO-008) or already covered by a post (AC-SEO-006) → recorded and skipped."""
    owner = reserved_by(entry["keyword"], site["reserved"])
    if owner:
        mark_covered(entry, owner["slug"], f"reserved for {owner['path']}")
        return False
    taken = keyword_taken(entry["keyword"], corpus)
    if taken:
        mark_covered(entry, taken["slug"], f"covered by /blog/{taken['slug']}")
        return False
    return True


# ── Prompts ─────────────────────────────────────────────────────────
SYSTEM_PROMPT = (
    "Jesteś doświadczonym redaktorem e-commerce i copywriterem SEO dla AllGrafika.pl – polskiego narzędzia AI do "
    "zdjęć produktowych dla sprzedawców na OLX, Vinted, eBay, Amazon i we własnych sklepach internetowych. "
    "Piszesz przekrojowe, rzetelne poradniki o e-commerce: fotografia produktowa, sprzedaż i konwersja, SEO sklepu, "
    "kanały sprzedaży, sezonowość, AI w e-commerce i praktyczne prawo sprzedawcy.\n\n"
    "CZYM JEST ALLGRAFIKA.PL (wspominaj uczciwie, tylko tam, gdzie naprawdę pomaga czytelnikowi):\n"
    "- Ze zdjęcia produktu zrobionego telefonem (JPG, PNG, WebP) tworzy profesjonalne grafiki: białe tło (packshot), "
    "sceny lifestyle, ciemne tło premium, gradient, produkt w użyciu, kolaż ujęć – łącznie 19 stylów oraz własny prompt.\n"
    "- Produkt pozostaje wierny oryginałowi – AI zmienia tło, scenę i światło, nie sam produkt.\n"
    "- Kadrowanie, obrót, korekta i eksport z presetem pod OLX, Vinted, eBay, Amazon albo własny sklep; plakietka promocyjna; "
    "infografiki z cechami i wymiarami.\n"
    "- Pisze tytuł i opis oferty dopasowany do platformy (pierwszy opis do zdjęcia gratis).\n"
    "- NIE łączy się z kontami na platformach i niczego nie publikuje – sprzedawca pobiera pliki i sam wstawia je do oferty.\n"
    f"- Nowe konto dostaje {FREE_GRAPHICS} darmowych grafik. Nie podawaj cen pakietów (zmieniają się).\n"
    "- Korzysta z modeli Google Gemini i OpenAI – nie pisz o 'własnym modelu AI'.\n\n"
    "ZASADY PLATFORM (podawaj je z linkiem do oficjalnego źródła z listy):\n"
    "- Vinted: zdjęcia muszą być własnymi zdjęciami sprzedawcy przedstawiającymi faktyczny przedmiot – NIE polecaj do Vinted "
    "zdjęć z AI ani scen generowanych (AllGrafika może tam pomóc tylko opisem oferty).\n"
    "- eBay: zasady zdjęć zabraniają dodanych napisów, ramek, znaków wodnych i plakietek.\n"
    "- Amazon: zdjęcie główne na czystym białym tle, produkt wypełnia co najmniej 85% kadru, bez napisów i dodatków.\n"
    "- AllGrafika NIE obsługuje Allegro – nie wspominaj tej platformy w żadnym polu i nie wybieraj tematów z nią związanych. "
    "Nazwy platform to znaki towarowe ich właścicieli – nie sugeruj partnerstwa ani powiązań.\n\n"
    "WIARYGODNOŚĆ (prawo konsumenckie / UOKiK – złamanie = artykuł odrzucony):\n"
    "- NIE wymyślaj statystyk, procentów, wyników badań, case studies, klientów ani cytatów. Liczba, procent albo 'badania "
    "pokazują' tylko z linkiem do źródła z listy w tym samym akapicie. Przykłady oznaczaj jako hipotetyczne i bez wyników sprzedaży.\n"
    "- Fakty o platformach (wymiary, limity, zakazy, opłaty) tylko z linkiem do oficjalnego źródła z listy w tej samej sekcji; "
    "gdy źródła brak – odeślij czytelnika do aktualnej pomocy platformy zamiast podawać liczbę.\n"
    "- Żadnych linków zewnętrznych spoza listy źródeł. Żadnej krytyki konkurencji ani innych narzędzi, żadnych superlatyw "
    "('najlepsze', 'jedyne', 'gwarantujemy') o AllGrafika.\n"
    "- Prawo: opisuj zasady ogólne ze źródeł, bez porad w konkretnej sprawie; przy wątpliwościach odeślij do prawnika/doradcy.\n\n"
    "STYL: profesjonalny, przystępny polski; zwracaj się do czytelnika per 'Ty'. Zacznij od konkretnej sytuacji sprzedawcy lub "
    "pytania – nigdy od 'W dzisiejszych czasach'. Pierwsze 2 zdania pod pierwszym H2 odpowiadają wprost na zapytanie "
    "(featured snippet). Konkretne instrukcje zamiast ogólników.\n\n"
    "FORMAT pola 'content' – WYŁĄCZNIE liniowy Markdown bez HTML:\n"
    "- '## ' nagłówek H2, '### ' nagłówek H3, '- ' punkt listy, **pogrubienie**, [tekst](url) link, zwykła linia = akapit,\n"
    "  pusta linia między blokami. BEZ tabel, BEZ list numerowanych, BEZ nagłówka '# ', BEZ bloków kodu.\n"
    "- Sekcja '## Najczęstsze pytania' z pytaniami jako '### Pytanie?' i odpowiedzią pod każdym.\n"
    f"- Każde wystąpienie nazwy AllGrafika w treści zapisuj jako link: [AllGrafika.pl]({REGISTER_URL}) (min. 1 raz, uczciwe CTA).\n"
    f"- Ostatnia linia artykułu to dokładnie: {HOME_LINK}\n"
    "- slug: małe litery ASCII, cyfry i myślniki, bez polskich znaków, max 60 znaków, zaczyna się od litery – fraza główna.\n"
    f"- title: {TITLE_MIN}–{TITLE_MAX - 2} znaków, fraza główna na początku, konkret (rok 2026, liczba lub korzyść), bez clickbaitu.\n"
    f"- excerpt (meta description): {EXCERPT_MIN + 10}–{EXCERPT_MAX - 3} znaków: fraza główna + korzyść + zachęta."
)

SOURCES_BY_ID = plan.get("sources", {})
LANDING_LINKS = "".join(f"- [{p['h1']}](https://allgrafika.pl{p['path']})\n" for p in site["landing_pages"])
POST_LINKS = "".join(f"- [{p['title']}](https://allgrafika.pl/blog/{p['slug']})\n" for p in site["posts"])
JSON_FORMAT = (
    "Zwróć WYŁĄCZNIE surowy obiekt JSON (bez ``` i komentarzy) w DOKŁADNIE tym formacie:\n"
    "{\n"
    '  "slug": "fraza-glowna-bez-polskich-znakow",\n'
    '  "title": "Tytuł z frazą główną na początku",\n'
    '  "excerpt": "Meta description z frazą główną, korzyścią i zachętą.",\n'
    '  "content": "## Pierwsza sekcja\\n\\nAkapit...\\n\\n## Najczęstsze pytania\\n\\n### Pytanie?\\n\\nOdpowiedź..."\n'
    "}"
)


def brief(entry):
    spec = ARTICLE_TYPES[entry["type"]]
    cluster = plan["clusters"][entry["cluster"]]
    planned = [p for p in (resolve_link(link, site) for link in entry.get("links", [])) if p]
    planned_lines = "".join(f"- [{link_title(p, site)}](https://allgrafika.pl{p})\n" for p in dict.fromkeys(planned))
    own = [SOURCES_BY_ID[s] for s in entry.get("sources", []) if s in SOURCES_BY_ID]
    # Other official sources only for platforms the topic mentions (plus the three platform rules every article may
    # touch) – GitHub Models accepts about 8000 input tokens per request.
    topic_text = f"{entry['keyword']} {entry['angle']}".lower()
    mentioned = {p for p, pattern in PLATFORMS.items() if re.search(pattern, topic_text)}
    core = {"amazon-product-images", "ebay-picture-policy", "vinted-photo-tips"}
    others = [
        s for sid, s in SOURCES_BY_ID.items()
        if sid not in entry.get("sources", []) and (sid in core or s.get("platform") in mentioned)
    ]
    source_lines = "".join(f"- {s['publisher']}: {s['url']}\n" for s in own) or "- (brak – nie podawaj liczb ani zasad platform)\n"
    other_lines = "".join(f"- {s['publisher']}: {s['url']}\n" for s in others)
    season = ""
    if entry.get("season"):
        name = EVENTS[entry["season"]][0]
        season = f"- Wydarzenie: {name} – {next_event(entry['season'], today).isoformat()} (artykuł publikujemy z wyprzedzeniem; podaj harmonogram przygotowań).\n"
    return (
        f"Data publikacji: {date_iso}\n\n"
        f"TEMAT (realne zapytanie z planu – artykuł ma odpowiadać na nie lepiej niż konkurencja):\n"
        f"- fraza główna: \"{entry['keyword']}\" (intencja: {entry['intent']})\n"
        f"- kąt i zakres: {entry['angle']}\n"
        f"- klaster tematyczny: {cluster['label']}\n{season}\n"
        f"TYP ARTYKUŁU: {spec['label']}\n"
        f"- długość pola content: {spec['words']} słów (minimum {spec['min_words']}); min. {spec['min_h2']} sekcji H2 (z FAQ), "
        f"min. {spec['min_h3']} nagłówków H3, FAQ z min. {spec['faq']} pytaniami.\n"
        f"{spec['structure']}\n\n"
        f"LINKI WEWNĘTRZNE: min. {spec['min_links']} różne linki do istniejących wpisów lub stron narzędzia, opisowy tekst linku "
        "(nie 'kliknij tutaj'). Obowiązkowo co najmniej jeden z zaplanowanych:\n"
        f"{planned_lines}"
        "Inne istniejące wpisy (możesz linkować; NIE powtarzaj ich tematów – duplikaty są odrzucane):\n"
        f"{POST_LINKS}"
        "Strony narzędzia (frazy tych stron należą do nich – linkuj, nie pisz o tym samym):\n"
        f"{LANDING_LINKS}\n"
        "ŹRÓDŁA DO TEGO TEMATU (jedyne dozwolone linki zewnętrzne, cytuj przy faktach):\n"
        f"{source_lines}"
        "Inne oficjalne źródła, jeśli wspominasz te platformy lub przepisy:\n"
        f"{other_lines}\n"
        f"{JSON_FORMAT}"
    )


# ── Model calls ─────────────────────────────────────────────────────
def parse_article(raw):
    # Without response_format the model may wrap the JSON in prose or a code fence – keep the outer object.
    if not raw.lstrip().startswith("{") and "{" in raw and "}" in raw:
        raw = raw[raw.index("{"): raw.rindex("}") + 1]
    try:
        value = json.loads(raw.strip())
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}\nRaw: {raw[:300]}")
        return None


def ask(url, headers, model, json_format, user_prompt, system, max_tokens):
    """One chat completion; returns the message text or None (and logs why)."""
    import requests  # only needed online

    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user_prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.7,
        "stream": False,
    }
    if json_format:
        payload["response_format"] = {"type": "json_object"}
    try:
        resp = requests.post(url, headers={**headers, "Content-Type": "application/json"}, json=payload, timeout=300)
    except requests.RequestException as e:
        print(f"{model}: request failed ({type(e).__name__})")
        return None
    print(f"{model} (json_format={json_format}): HTTP {resp.status_code}, {resp.headers.get('content-type', '?')}, {len(resp.content)} bytes")
    if resp.status_code != 200:
        print(resp.text[:300])
        return None
    try:
        return resp.json()["choices"][0]["message"]["content"].strip() or None
    except (ValueError, KeyError, IndexError, TypeError, AttributeError) as e:
        print(f"Unusable response ({type(e).__name__}): {resp.text[:200]!r}")
        return None


def providers():
    # OpenAI directly first when the OPENAI_API_KEY secret exists; GitHub Models (output capped at 4000 tokens per
    # request) is the fallback – long articles are completed section by section in expand().
    out = []
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        openai_url = os.environ.get("BLOG_OPENAI_URL", "https://api.openai.com/v1/chat/completions")
        out.append((openai_url, {"Authorization": f"Bearer {openai_key}"}, "gpt-4.1", True, 16000))
    token = os.environ.get("MODELS_TOKEN") or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        gh_headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        for model in ("openai/gpt-4.1", "openai/gpt-4o"):
            out.append(("https://models.github.ai/inference/chat/completions", gh_headers, model, True, 4000))
            out.append(("https://models.github.ai/inference/chat/completions", gh_headers, model, False, 4000))
    return out


def generate_online(user_prompt, system=SYSTEM_PROMPT, max_tokens=6000):
    import time

    attempts = providers()
    if not attempts:
        fail("Brak OPENAI_API_KEY i MODELS_TOKEN / GITHUB_TOKEN – bot nie może pisać")
    for i, (url, headers, model, json_format, cap) in enumerate(attempts):
        raw = ask(url, headers, model, json_format, user_prompt, system, min(max_tokens, cap))
        if raw:
            parsed = parse_article(raw)
            if parsed:
                return parsed
        if i < len(attempts) - 1:
            time.sleep(10)
    return None


def ask_field(field, instruction, article):
    """A short follow-up call that rewrites one field; None when the model does not deliver."""
    system = "Jesteś redaktorem SEO. Odpowiadasz WYŁĄCZNIE obiektem JSON z jednym polem."
    prompt = (
        f"{instruction}\nObecna wartość pola {field}: {article.get(field, '')!r}\n"
        f"Temat artykułu: {article.get('title', '')}\nZwróć JSON: {{\"{field}\": \"...\"}}"
    )
    fixed = generate_online(prompt, system, 4000)
    value = fixed.get(field) if isinstance(fixed, dict) else None
    return value.strip() if isinstance(value, str) and value.strip() else None


def expand(article, spec):
    """Long articles exceed one response of the fallback provider – grow the shortest sections one at a time."""
    for _ in range(8):
        words = word_count(article.get("content", ""))
        if words >= spec["min_words"]:
            return
        parts = sections(article["content"])
        candidates = [(i, h, b) for i, (h, b) in enumerate(parts) if h and "pytani" not in h.lower() and "faq" not in h.lower()]
        if not candidates:
            return
        i, heading, body = min(candidates, key=lambda c: word_count("\n".join(c[2])))
        target = word_count("\n".join(body)) + max(200, (spec["min_words"] - words) // 2 + 100)
        print(f"Expanding section '{heading}' ({words} words in the article)")
        new = ask_field(
            "section",
            f"Rozbuduj tę sekcję artykułu do ok. {target} słów: konkretne kroki, przykłady oznaczone jako hipotetyczne, "
            "listy kontrolne. Zachowaj nagłówek '## " + heading + "', ton i istniejące linki. Format: Markdown (## / ### / - / **), "
            "bez tabel i HTML. Nie wymyślaj liczb, procentów ani wyników; nie dodawaj linków zewnętrznych.\n"
            "Sekcja:\n## " + heading + "\n" + "\n".join(body),
            {"section": "", "title": article.get("title", "")},
        )
        if not new or word_count(new) <= word_count("\n".join(body)):
            continue
        new_lines = new.strip().split("\n")
        if new_lines[0].startswith("## "):
            new_lines = new_lines[1:]
        parts[i] = (heading, [""] + new_lines + [""])
        article["content"] = "\n".join(
            ([*parts[0][1]] if parts[0][1] else []) + [ln for h, b in parts[1:] for ln in [f"## {h}", *b]]
        ).strip()


def repair(article, spec):
    """Fix what a model reliably gets wrong instead of discarding a good article; the gates judge the rest."""
    if len(article.get("title", "")) < TITLE_MIN:
        new = ask_field("title", f"Przepisz tytuł tak, aby miał od {TITLE_MIN + 10} do {TITLE_MAX - 2} znaków, fraza główna na początku.", article)
        if new:
            article["title"] = new
    if len(article.get("excerpt", "")) < EXCERPT_MIN:
        new = ask_field("excerpt", f"Przepisz meta description tak, aby miał od {EXCERPT_MIN + 10} do {EXCERPT_MAX - 3} znaków: fraza główna, korzyść, zachęta.", article)
        if new:
            article["excerpt"] = new
    expand(article, spec)


def basic_problem(article):
    """Hard rules checked before the quality gates (slug, fields, Allegro, duplicates)."""
    slug = str(article.get("slug", ""))
    if not re.fullmatch(r"[a-z][a-z0-9-]{2,59}", slug):
        return f"niepoprawny slug {slug!r} (tylko a-z, 0-9, myślniki, max 60 znaków, zaczyna się od litery)"
    if article.get("category") not in ALLOWED_CATEGORIES:
        return f"niedozwolona kategoria {article.get('category')!r}"
    for field_name in ("title", "excerpt", "content"):
        if not isinstance(article.get(field_name), str) or not article[field_name].strip():
            return f"brak pola {field_name}"
    if UNSUPPORTED_PLATFORM.search(" ".join(str(article.get(f, "")) for f in ("slug", "title", "excerpt", "content"))):
        return (
            "artykuł wspomina Allegro – AllGrafika nie obsługuje tej platformy; napisz o OLX, Vinted, eBay, Amazon, "
            "sklepie internetowym albo fotografii produktowej"
        )
    if (articles_dir / f"{slug}.ts").exists():
        return f"DUPLICATE: post '{slug}' already exists"
    # Topic and content against every post, plus retired (merged) posts by topic.
    reason = duplicate_reason(article, corpus + [dict(e, content="") for e in retired_entries])
    if reason:
        return reason
    if slug in redirected:
        return f"slug '{slug}' jest przekierowaniem połączonego wpisu – wybierz inny"
    return None


def review(article, type_key, keyword, planned):
    """All reasons to reject (basic first – a duplicate or Allegro makes the rest irrelevant)."""
    hard = basic_problem(article)
    if hard:
        return [hard]
    return quality_problems(article, type_key, site, plan, keyword, planned)


def topic_line(entry, why):
    season = f", sezon: {EVENTS[entry['season']][0]}" if entry.get("season") else ""
    return f"**Temat:** „{entry['keyword']}” · klaster `{entry['cluster']}` · typ `{entry['type']}` · priorytet {entry['priority']}{season}  \n_{why}_"


# ── Obtain the article ──────────────────────────────────────────────
target = None
if DRY_RUN:
    preview = simulate(plan, ledger, today, 5, availability(site))
    if preview:
        summary("**Następne tematy wg planu:** " + " → ".join(f"„{t['keyword']}” ({t['cluster']}, {t['type']})" for t in preview))
    fixture = Path(os.environ.get("BLOG_FIXTURE") or (SCRIPTS / "fixtures/blog-post.sample.json"))
    print(f"DRY RUN – article from {fixture}")
    article = json.loads(fixture.read_text(encoding="utf-8"))
    type_key = article.get("type") if article.get("type") in ARTICLE_TYPES else "guide"
    fixes = normalize(article, site) if isinstance(article.get("content"), str) else []
    found = review(article, type_key, article.get("keyword"), [])
    if found:
        if found[0].startswith("DUPLICATE"):
            summary(f"⚠️ Post '{article['slug']}' already exists — skipping to avoid duplicate.")
            flush_summary()
            sys.exit(0)
        for p in found:
            print(f"❌ {p}")
        fail(f"Przykładowy artykuł nie przeszedł bramek jakości ({len(found)}): " + "; ".join(found[:3]))
    for f in fixes:
        print(f"fixed: {f}")
else:
    article = None
    exclude = []
    for topic_round in range(2):
        target, why = pick_topic(plan, ledger, today, available, exclude)
        if target is None:
            summary(f"⚠️ **Brak artykułu dziś:** {why}")
            print(f"::warning::{why}")
            LEDGER_PATH.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            flush_summary()
            sys.exit(0)
        summary(topic_line(target, why))
        type_key = target["type"]
        spec = ARTICLE_TYPES[type_key]
        planned = [p for p in (resolve_link(link, site) for link in target.get("links", [])) if p]
        category = target.get("category") or plan["clusters"][target["cluster"]]["category"]
        prompt = brief(target)
        feedback = ""
        switch_topic = False
        for draft in range(1, 4):
            candidate = generate_online(prompt + feedback, SYSTEM_PROMPT, spec["max_tokens"])
            if not candidate:
                fail("Brak użytecznej odpowiedzi od dostawców AI (OpenAI / GitHub Models)")
            candidate["category"] = category
            if isinstance(candidate.get("content"), str):
                repair(candidate, spec)
                fixes = normalize(candidate, site)
                for f in fixes:
                    print(f"fixed: {f}")
            found = review(candidate, type_key, target["keyword"], planned)
            if not found:
                article = candidate
                break
            summary(f"- Szkic {draft} odrzucony ({len(found)}): " + "; ".join(found[:6]))
            if found[0].startswith("DUPLICATE") or "zbyt podobn" in found[0]:
                # The planned topic overlaps an older post – record it and take the next topic from the plan.
                mark_covered(target, candidate.get("slug", ""), found[0])
                exclude.append(target["keyword"])
                switch_topic = True
                break
            feedback = (
                "\n\nPOPRZEDNIA WERSJA ZOSTAŁA ODRZUCONA. Popraw WSZYSTKIE punkty i zwróć cały artykuł od nowa:\n"
                + "\n".join(f"- {p}" for p in found[:15])
            )
        if article:
            break
        if not switch_topic:
            fail(f"Brak akceptowalnego artykułu po 3 szkicach dla „{target['keyword']}” – zobacz powody powyżej")
    if not article:
        fail("Dwa kolejne tematy z planu pokrywają się z istniejącymi wpisami – przejrzyj plan")

slug = article["slug"]
words = word_count(article["content"])


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
internal = sorted({m.group(1) for m in re.finditer(r"\]\(https://allgrafika\.pl(/[^)\s]+)\)", article["content"])})
summary(f"✅ **{article['title']}** → `/blog/{slug}` · {words} słów · {len(internal)} linków wewnętrznych · kategoria {article['category']}")

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


seo_src = (LANDING / "src/data/seoPages.ts").read_text(encoding="utf-8")
sitemap_entries = [
    sitemap_url("https://allgrafika.pl/", most_recent, "weekly", "1.0"),
    sitemap_url("https://allgrafika.pl/blog", most_recent, "weekly", "0.9"),
]
# Same entries as scripts/generate-sitemap.js, which the build runs again before the commit.
SEO_PAGES_UPDATED = re.search(r"SEO_PAGES_UPDATED = '([\d-]+)'", seo_src).group(1)
for p in site["landing_pages"]:
    sitemap_entries.append(sitemap_url(f"https://allgrafika.pl{p['path']}", SEO_PAGES_UPDATED, "monthly", "0.9"))
for p in sorted(all_posts_meta, key=lambda x: x["lastmod"], reverse=True):
    sitemap_entries.append(sitemap_url(f"https://allgrafika.pl/blog/{p['slug']}", p["lastmod"], "monthly", "0.7"))
sitemap_xml = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "\n".join(sitemap_entries) + "\n"
    "</urlset>\n"
)
SITEMAP.write_text(sitemap_xml, encoding="utf-8")
print(f"✅ sitemap.xml updated ({len(all_posts_meta)} blog posts)")

# ── Keyword bookkeeping & publishing ────────────────────────────────
if target and not DRY_RUN:
    ledger.append({"keyword": target["keyword"], "slug": slug, "date": date_iso, "cluster": target["cluster"], "type": target["type"]})
    LEDGER_PATH.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

set_output(slug=slug, title=article["title"], keyword=target["keyword"] if target else "", words=words)

if DIRECT and not DRY_RUN:
    # The workflow builds the landing page and pushes to main only when the build passes.
    print(f"✅ Article written: {slug} – the workflow builds and publishes it")
    flush_summary()
    sys.exit(0)

# ── Git & PR ────────────────────────────────────────────────────────
commit_msg = f"feat(blog): {article['title']} ({date_iso})"
branch = f"blog/{date_iso}-{slug[:40]}"
if DRY_RUN:
    print(f"DRY RUN – would push branch {branch} and open PR: {commit_msg}")
    flush_summary()
    sys.exit(0)

os.chdir(REPO_ROOT)
run("git config user.name 'github-actions[bot]'")
run("git config user.email 'github-actions[bot]@users.noreply.github.com'")
run(["git", "checkout", "-b", branch])
run("git add landing-page/src/data/ landing-page/public/sitemap.xml landing-page/scripts/blog-keywords-used.json")
run(["git", "commit", "-m", commit_msg])
run(["git", "push", "origin", f"HEAD:{branch}"])
pr_body = (
    f"Automatycznie wygenerowany wpis: **{article['title']}**\n\n"
    f"Kategoria: {article['category']} · slug: `{slug}` · {words} słów\n\n"
    "Bramki jakości (spec 23) przeszły; przed merge przeczytaj tekst: brak zmyślonych liczb, poprawny język.\n"
    "CI (kontrola przekierowań, build i prerender) musi być zielone.\n\n"
    "\U0001F916 Generated with GitHub Models"
)
# The label is optional: create it when missing so `gh pr create --label` never fails the run.
subprocess.run(["gh", "label", "create", "blog", "--color", "0E8A16", "--description", "Automatyczny wpis bloga", "--force"], check=False)
run(["gh", "pr", "create", "--base", "main", "--head", branch, "--title", commit_msg, "--body", pr_body, "--label", "blog"])
# Auto-merge after green CI when the repository has auto-merge enabled; otherwise the PR stays open for review.
subprocess.run(["gh", "pr", "merge", branch, "--auto", "--squash"], check=False)
flush_summary()
print(f"✅ Opened PR from {branch}: {commit_msg}")
