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
    "łącznie dostępnych jest 6 stylów automatycznych + własny prompt\n"
    "- Produkt pozostaje wierny oryginałowi (AI zmienia tylko tło, scenę i oświetlenie)\n"
    "- Umożliwia własny prompt po polsku z opcjonalnym zdjęciem referencyjnym oraz przeróbkę gotowej grafiki\n"
    "- Pozwala kadrować, obracać i poprawiać grafiki w formatach Allegro (1:1, 4:3, 16:9, 3:4) i dodać plakietkę promocyjną\n"
    "- Pisze opis oferty pod SEO Allegro (tytuł do 75 znaków, opis, frazy) – pierwszy opis gratis do każdego zdjęcia z gotową grafiką\n"
    "- Przechowuje wygenerowane grafiki bezpiecznie w chmurze\n"
    "- Kosztuje 1,75-2 zł za grafikę (1 kredyt = 1 grafika), pierwsze 10 grafik jest bezpłatnych\n"
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
    "6. Długość: 600-800 słów treści (pole 'content') — więcej niż dotychczas.\n"
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
    '  "title": "Tytuł SEO 60-70 znaków z główną frazą kluczową",\n'
    '  "excerpt": "Opis 150-180 znaków z główną frazą SEO. Zachęca do przeczytania artykułu.",\n'
    '  "category": "jedna z: Poradniki / Technologia / Styl i design / E-commerce / Optymalizacja",\n'
    '  "readTime": 6,\n'
    '  "content": "## Nagłówek sekcji\\n\\nTekst akapitu z **pogrubieniem**.\\n\\n## Kolejna sekcja..."\n'
    "}"
)

# ── Obtain the article: GitHub Models or a fixture (dry run) ────────
if DRY_RUN:
    fixture = Path(os.environ.get("BLOG_FIXTURE") or (LANDING / "scripts/fixtures/blog-post.sample.json"))
    article = json.loads(fixture.read_text(encoding="utf-8"))
    print(f"DRY RUN – article from {fixture}")
else:
    import requests  # only needed online

    token = os.environ.get("MODELS_TOKEN") or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        print("ERROR: MODELS_TOKEN / GITHUB_TOKEN not set")
        sys.exit(1)
    resp = requests.post(
        "https://models.github.ai/inference/chat/completions",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "model": "openai/gpt-4o",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
            "max_tokens": 3500,
            "temperature": 0.85,
            "response_format": {"type": "json_object"},
        },
        timeout=180,
    )
    print(f"API status: {resp.status_code}")
    if resp.status_code != 200:
        print(resp.text)
        sys.exit(1)
    raw = resp.json()["choices"][0]["message"]["content"].strip()
    raw = re.sub(r"^```\w*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    try:
        article = json.loads(raw.strip())
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}\nRaw: {raw[:500]}")
        sys.exit(1)

slug = article["slug"]

# ── Validation of model-controlled fields ──────────────────────────
ALLOWED_CATEGORIES = {"Poradniki", "Technologia", "Styl i design", "E-commerce", "Optymalizacja"}
if not re.fullmatch(r"[a-z][a-z0-9-]{2,59}", slug):
    print(f"❌ Invalid slug from model: {slug!r}")
    sys.exit(1)
if article.get("category") not in ALLOWED_CATEGORIES:
    print(f"❌ Invalid category from model: {article.get('category')!r}")
    sys.exit(1)
for field_name in ("title", "excerpt", "content"):
    if not str(article.get(field_name, "")).strip():
        print(f"❌ Missing field from model: {field_name}")
        sys.exit(1)
body = article.get("content", "")
# Fabricated "sales grew by 40%" claims are an unfair commercial practice – refuse them unless sourced.
if re.search(r"(wzros|zwiększ|spad|popraw)\w*[^.\n]{0,40}\bo\s+\d{1,3}\s?%", body, flags=re.I) and "źródło" not in body.lower():
    print("❌ Article contains an unsourced percentage claim – rejected.")
    sys.exit(1)
if re.search(r"<\s*/?\s*[a-z]+[^>]*>", body):
    print("❌ Article content contains HTML – rejected (Markdown only).")
    sys.exit(1)

# ── Duplicate guards ────────────────────────────────────────────────
if (articles_dir / f"{slug}.ts").exists():
    print(f"⚠️  Post '{slug}' already exists — skipping to avoid duplicate.")
    sys.exit(0)

STOPWORDS = {"jak", "na", "i", "w", "z", "do", "dla", "o", "a", "sie", "się", "czy", "co",
             "allegro", "miniaturki", "miniaturke", "miniaturka", "miniaturek", "grafiki", "grafik"}


def tokens(text):
    text = re.sub(r"[^a-z0-9ąćęłńóśźż]+", " ", text.lower())
    return {t for t in text.split() if len(t) > 2 and t not in STOPWORDS}


new_tokens = tokens(slug.replace("-", " ") + " " + article["title"])
retired_path = LANDING / "src/data/retired-slugs.json"
retired_entries = []
if retired_path.exists():
    retired_entries = [{"slug": r, "title": r.replace("-", " ")} for r in json.loads(retired_path.read_text(encoding="utf-8"))]
for e in existing + retired_entries:
    old_tokens = tokens(e["slug"].replace("-", " ") + " " + e["title"])
    if not new_tokens or not old_tokens:
        continue
    jaccard = len(new_tokens & old_tokens) / len(new_tokens | old_tokens)
    if jaccard >= 0.5:
        print(f"⚠️  Topic too similar to existing post '{e['slug']}' (similarity {jaccard:.2f}) — skipping.")
        sys.exit(0)

vercel_cfg = json.loads((LANDING / "vercel.json").read_text(encoding="utf-8"))
redirected = {r["source"].removeprefix("/blog/") for r in vercel_cfg.get("redirects", [])}
if slug in redirected:
    print(f"⚠️  Slug '{slug}' is a permanent redirect of a consolidated post — skipping.")
    sys.exit(0)


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
