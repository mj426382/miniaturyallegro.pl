"""
Quality gates of the blog bot (docs/specs/23-blog-bot.md).

normalize() fixes in code what a model reliably gets slightly wrong (meta title/description length, links to
merged posts, numbered lists, the closing link, read time); problems() returns every remaining reason to reject
the draft – the generator sends them back to the model and asks for a new version.

CLI (used by the tests):
  python3 blog_quality.py --check article.json [--type guide] [--keyword "fraza"] [--links /a,/b]
prints {"problems": [...], "fixes": [...], "title": ..., "excerpt": ..., "words": n, "internal_links": [...]}
and exits 1 when there are problems.
"""
import argparse
import json
import re
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
from blog_plan import load_plan, site_context  # noqa: E402
from blog_similarity import stems  # noqa: E402

HOME_LINK = "[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)"
REGISTER_URL = "https://app.allgrafika.pl/register"
TITLE_MIN, TITLE_MAX = 30, 60
EXCERPT_MIN, EXCERPT_MAX = 110, 158
FREE_GRAPHICS = 5  # spec 02/19: new accounts get 5 free graphics

ARTICLE_TYPES = {
    "pillar": {
        "label": "przewodnik filarowy (pillar) – kompletny, przekrojowy poradnik, hub linkujący do szczegółowych wpisów",
        "min_words": 1800, "words": "2000–2600", "min_h2": 7, "min_h3": 4, "min_links": 4, "faq": 5, "max_tokens": 12000,
        "structure": (
            "- 7–10 sekcji H2 obejmujących temat od podstaw do zaawansowanych decyzji; każda sekcja kończy się praktycznym wnioskiem.\n"
            "- W co najmniej 4 sekcjach link do pogłębiającego wpisu lub strony z listy linków wewnętrznych (hub & spoke).\n"
            "- Sekcja porównująca warianty/kanały w formie list (bez tabel), sekcja z typowymi błędami i checklista końcowa.\n"
            "- Na początku krótka odpowiedź na zapytanie (2–3 zdania) i lista 'Z tego przewodnika dowiesz się'."
        ),
    },
    "guide": {
        "label": "poradnik (guide) – wyczerpująca odpowiedź na jedno pytanie",
        "min_words": 1000, "words": "1100–1500", "min_h2": 4, "min_h3": 2, "min_links": 2, "faq": 3, "max_tokens": 6000,
        "structure": (
            "- Problem → wyjaśnienie → rozwiązanie krok po kroku → typowe błędy → checklista.\n"
            "- Jedna sekcja z przykładem wyraźnie oznaczonym jako hipotetyczny."
        ),
    },
    "howto": {
        "label": "instrukcja krok po kroku (how-to)",
        "min_words": 1000, "words": "1100–1400", "min_h2": 4, "min_h3": 3, "min_links": 2, "faq": 3, "max_tokens": 6000,
        "structure": (
            "- Sekcja 'Czego potrzebujesz' (lista), potem kroki jako nagłówki H3 'Krok 1: …', 'Krok 2: …' (min. 3 kroki).\n"
            "- Sekcja 'Najczęstsze błędy' i krótka checklista do zastosowania od razu."
        ),
    },
    "comparison": {
        "label": "porównanie (comparison) – rzetelne zestawienie opcji z rekomendacją 'kiedy co'",
        "min_words": 1000, "words": "1100–1500", "min_h2": 4, "min_h3": 2, "min_links": 2, "faq": 3, "max_tokens": 6000,
        "structure": (
            "- Jedna sekcja H2 na każdą opcję (H3: zalety, ograniczenia, dla kogo), potem sekcja 'Porównanie w skrócie' "
            "jako listy według kryteriów (BEZ tabel Markdown) i sekcja 'Kiedy wybrać którą opcję'.\n"
            "- Uczciwie i neutralnie: żadnej opcji nie oczerniaj, nie twórz rankingów 'najlepszy'."
        ),
    },
    "checklist": {
        "label": "checklista – lista kontrolna do wykonania punkt po punkcie",
        "min_words": 900, "words": "1000–1300", "min_h2": 4, "min_h3": 2, "min_links": 2, "faq": 3, "max_tokens": 6000,
        "structure": (
            "- Sekcje H2 grupują punkty (np. przed, w trakcie, po); co najmniej 15 punktów listy '- ' z krótkim uzasadnieniem.\n"
            "- Sekcja 'Najczęstsze błędy' i podsumowanie, od czego zacząć dziś."
        ),
    },
    "seasonal": {
        "label": "artykuł sezonowy – plan przygotowań przed konkretnym wydarzeniem handlowym",
        "min_words": 900, "words": "1000–1300", "min_h2": 4, "min_h3": 2, "min_links": 2, "faq": 3, "max_tokens": 6000,
        "structure": (
            "- Sekcja H2 'Harmonogram' z H3 dla etapów (np. 6 tygodni, 4 tygodnie, 2 tygodnie, ostatni tydzień przed).\n"
            "- Zdjęcia i grafiki sezonowe, oferta, logistyka, komunikacja promocji zgodna z prawem, checklista."
        ),
    },
}

PLATFORMS = {
    "amazon": r"\bamazon", "ebay": r"\bebay", "vinted": r"\bvinted", "olx": r"\bolx\b", "etsy": r"\betsy",
    "shopify": r"\bshopify", "woocommerce": r"\bwoocommerce", "prestashop": r"\bprestashop", "shoper": r"\bshoper\b",
    "idosell": r"\bidosell", "empik": r"\bempik", "erli": r"\berli\b", "google": r"\bgoogle (merchant|zakup)",
}
PLATFORM_FACT = re.compile(
    r"\d+\s?(px|pikseli|piks|mpx|megapiks|mb|kb|%|proc|znak|zdję|zdjec)|\d+\s?[x×]\s?\d+|"
    r"\b(wymaga|wymagają|zabrania|zabraniają|zabronion\w*|zakazuj\w*|nie pozwala|nie dopuszcza|musi|muszą)\b",
    re.I,
)
PERCENT = re.compile(r"\d+(?:[.,]\d+)?\s?(?:%|proc\.|procent)", re.I)
DISCOUNT_BADGE = re.compile(r"[-−–]\s?\d+\s?%")
GROWTH = re.compile(r"(wzros|wzrós|zwiększ|spad|popraw|podnios|obniż)\w*[^.\n]{0,40}\bo\s+\d{1,3}(?:[.,]\d+)?\s?(%|proc|procent)", re.I)
RESEARCH = re.compile(
    r"(według|wg|jak pokazują|jak wynika z)\s+(badań|badania|raportu|raportów|danych|statystyk|ankiety)|"
    r"badani[ae]\s+(pokazuj|wykazał|wskazuj|dowodz|potwierdz)\w*|(statystyki|dane|raporty?)\s+(pokazują|wskazują|mówią|potwierdzają)|\bnaukowcy\b",
    re.I,
)
RATIO = re.compile(
    r"\b\d+\s+na\s+\d+\s+(kupując|klient|konsument|osób|sprzedawc|użytkownik)|"
    r"\b(\d+|dwa|dwie|trzy|cztery|pięć|kilka)\s*(razy|-krotnie|krotnie)\s+(więcej|częściej|szybciej|lepiej|wyżej|większ|chętniej)",
    re.I,
)
CASE_STUDY = re.compile(r"case stud|studium przypadku|nasz(?:ego|ym|ych|i|a)? klien|klienci allgrafik|użytkownicy allgrafik\w*\s+(zwiększ|osiąg|sprzeda)", re.I)
HYPOTHETICAL = re.compile(r"hipotetyczn|przykładow|załóżmy|wyobraź sobie", re.I)
NEGATION = re.compile(r"\b(nie|bez|zakaz\w*|zabrani\w*|wyłącznie|tylko|własn\w*|oryginaln\w*|nieedytowan\w*|unikaj)\b", re.I)
VINTED_AI = re.compile(r"\b(ai|allgrafik\w*|wygeneruj\w*|wygenerowan\w*|generator\w*|scen\w* (ai|z ai)|tło (ai|z ai))\b", re.I)
EBAY_OVERLAY = re.compile(r"znak\w* wodn|\bnapis(y|ów|ami|em)?\b|\bramk[aęiąo]\w*|plakietk|tekst\w* na zdj", re.I)
AMAZON_MAIN_BAD = re.compile(r"lifestyle|scen|kolorow\w* tł|gradient|ciemn\w* tł|plakietk|napis", re.I)
COMPETITORS = re.compile(
    r"\b(photoroom|remove\.?bg|canva|pebblely|claid|picsart|pixelcut|fotor|mokker|flair\.ai|booth\.ai|clipdrop|firefly|photoshop|lightroom|snapseed|pincel)\b", re.I
)
NEGATIVE = re.compile(r"gorsz|słab|kiepsk|beznadziejn|nie polecam|unikaj|oszuk|naciąg|bubel|fataln|tragiczn|przestarzał|bezużyteczn|nie umie|nie potrafi|przegrywa|lepsz\w* (niż|od)", re.I)
SUPERLATIVE = re.compile(r"allgrafik\w*[^.\n]{0,80}\b(najlepsz\w*|numer 1|nr 1|jedyn\w*|najtańsz\w*|gwarantuj\w*)", re.I)
FALSE_PROMISE = re.compile(r"allgrafik\w*[^.\n]{0,120}\b(integruj\w*|integracj\w*|połącz\w* z kont\w*|publikuje|opublikuje|wystawi\w*|import\w* ofert|automatycznie doda\w*)", re.I)
GUARANTEE = re.compile(r"gwarant\w*[^.\n]{0,40}(sprzeda|wzrost|więcej|konwersj|klient)", re.I)
OWN_MODEL = re.compile(r"allgrafik\w*[^.\n]{0,80}(własn\w*|dedykowan\w*) model\w*", re.I)
FREE_CLAIM = re.compile(r"(\d+)\s+(darmow\w*|bezpłatn\w*)\s+(grafik|generacj|kredyt)|(\d+)\s+(grafik|generacj)\w*\s+(gratis|za darmo)", re.I)
FAQ_HEADING = re.compile(r"^##\s+(najczęstsze pytania|często zadawane pytania|faq|pytania i odpowiedzi)", re.I)
LINK = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+)\)")
IRREGULAR_SPACE = re.compile("[   -   　]")
ZERO_WIDTH = re.compile("[​﻿]")
DANGLING = {"i", "a", "o", "w", "z", "na", "do", "od", "po", "dla", "oraz", "lub", "czy", "jak", "nie", "to", "we", "ze"}


def word_count(text: str) -> int:
    text = LINK.sub(lambda m: m.group(1), text or "")
    return len(re.sub(r"[#*>\-]+", " ", text).split())


def shorten(text: str, limit: int) -> str:
    """Cut at a separator or word boundary within the limit, without a dangling separator or conjunction."""
    text = text.strip()
    if len(text) <= limit:
        return text
    for sep in (" – ", " — ", ": ", "? ", " - "):
        head = text.split(sep)[0].strip()
        if limit * 0.55 <= len(head) <= limit:
            return head + ("?" if sep == "? " else "")
    words = text[: limit + 1].rsplit(" ", 1)[0].split()
    while len(words) > 3 and words[-1].lower().strip(",;:") in DANGLING:
        words.pop()
    return re.sub(r"[\s,;:–—-]+$", "", " ".join(words))


def _norm_url(url: str) -> str:
    return url.split("#")[0].rstrip("/")


def _internal_path(url: str):
    m = re.match(r"https?://(?:www\.)?allgrafika\.pl(/[^\s?#]*)?", url)
    if not m:
        return None
    path = (m.group(1) or "/").rstrip("/") or "/"
    return path


def normalize(article: dict, site: dict) -> list:
    """Fix in place what code can fix; returns a list of human-readable fixes."""
    fixes = []
    for field in ("title", "excerpt", "content"):
        value = article.get(field)
        if isinstance(value, str):
            clean = ZERO_WIDTH.sub("", IRREGULAR_SPACE.sub(" ", value)).strip()
            if field != "content":
                clean = clean.strip("\"'„”«» ")
            article[field] = clean
    content = article.get("content", "")
    if not isinstance(content, str):
        return fixes
    lines = content.replace("\r\n", "\n").split("\n")
    out = []
    for line in lines:
        new = re.sub(r"^(\s*)\d+[.)]\s+", r"\1- ", line)
        new = re.sub(r"^#{4,6}\s+", "### ", new)
        new = re.sub(r"^\*\s+", "- ", new)
        if new != line:
            fixes.append(f"lista/nagłówek znormalizowany: {line.strip()[:40]!r}")
        out.append(new)
    content = "\n".join(out)

    def relink(m):
        text, url = m.group(1), m.group(2)
        path = _internal_path(url)
        if path is None:
            return m.group(0)
        target = site["redirects"].get(path)
        if target and target in site["routes"]:
            fixes.append(f"link {path} → {target} (wpis połączony, 301)")
            path = target
        canonical = "https://allgrafika.pl" + ("/" if path == "/" else path)
        return f"[{text}]({canonical})"

    content = LINK.sub(relink, content)
    # The closing link is always the last line (and only there).
    body = [ln for ln in content.split("\n") if ln.strip() != HOME_LINK]
    while body and not body[-1].strip():
        body.pop()
    if content.strip().split("\n")[-1].strip() != HOME_LINK:
        fixes.append("dodano link końcowy do strony głównej")
    article["content"] = "\n".join(body) + "\n\n" + HOME_LINK
    if len(article.get("title", "")) > TITLE_MAX:
        fixes.append(f"tytuł skrócony z {len(article['title'])} do ≤ {TITLE_MAX} znaków")
        article["title"] = shorten(article["title"], TITLE_MAX)
    if len(article.get("excerpt", "")) > EXCERPT_MAX:
        fixes.append(f"opis meta skrócony z {len(article['excerpt'])} do ≤ {EXCERPT_MAX} znaków")
        article["excerpt"] = shorten(article["excerpt"], EXCERPT_MAX - 1)
        if not article["excerpt"].endswith((".", "!", "?", "…")):
            article["excerpt"] += "."
    article["readTime"] = max(3, round(word_count(article["content"]) / 200))
    return fixes


def sections(content: str):
    """[(h2 heading or '', [lines])]"""
    out = [("", [])]
    for line in content.split("\n"):
        if line.startswith("## "):
            out.append((line[3:].strip(), []))
        else:
            out[-1][1].append(line)
    return out


def _sentences(text: str):
    return re.split(r"(?<=[.!?])\s+", text)


def problems(article: dict, type_key: str, site: dict, plan: dict, keyword: str | None = None, planned_links=()) -> list:
    """Every reason to reject the draft (empty list = publishable)."""
    spec = ARTICLE_TYPES.get(type_key) or ARTICLE_TYPES["guide"]
    out = []
    title, excerpt, content = article.get("title", ""), article.get("excerpt", ""), article.get("content", "")
    slug = article.get("slug", "")

    # Meta
    if len(title) < TITLE_MIN:
        out.append(f"tytuł ma {len(title)} znaków – wymagane {TITLE_MIN}–{TITLE_MAX}")
    if len(excerpt) < EXCERPT_MIN:
        out.append(f"opis meta (excerpt) ma {len(excerpt)} znaków – wymagane {EXCERPT_MIN}–{EXCERPT_MAX}")
    if keyword:
        k = set(stems(keyword))
        if k and len(k & set(stems(title))) / len(k) < 0.5:
            out.append(f"tytuł nie zawiera frazy głównej „{keyword}” (odmiana dozwolona)")

    # Structure
    words = word_count(content)
    if words < spec["min_words"]:
        out.append(f"za krótka treść ({words} słów) – {type_key} wymaga min. {spec['min_words']} (cel {spec['words']})")
    lines = content.split("\n")
    h2 = [ln for ln in lines if ln.startswith("## ")]
    h3 = [ln for ln in lines if ln.startswith("### ")]
    if len(h2) < spec["min_h2"]:
        out.append(f"za mało sekcji H2 ({len(h2)}) – {type_key} wymaga min. {spec['min_h2']} (z sekcją FAQ)")
    if len(h3) < spec["min_h3"]:
        out.append(f"za mało nagłówków H3 ({len(h3)}) – wymagane min. {spec['min_h3']}")
    if any(re.match(r"^#\s", ln) for ln in lines):
        out.append("treść zawiera nagłówek H1 ('# ') – tytuł jest H1, w treści tylko ## i ###")
    if any(re.match(r"^\s*\|", ln) for ln in lines):
        out.append("treść zawiera tabelę Markdown – strona jej nie wyświetli; zamień ją na listy")
    if "```" in content:
        out.append("treść zawiera blok kodu – tylko Markdown tekstowy")
    if re.search(r"<\s*/?\s*[a-z]+[^>]*>", content):
        out.append("treść zawiera HTML – tylko Markdown")
    faq_q = 0
    faq_found = False
    for heading, body in sections(content):
        if not heading:
            continue
        if FAQ_HEADING.match("## " + heading):
            faq_found = True
            questions = [i for i, ln in enumerate(body) if ln.startswith("### ") and ln.rstrip().endswith("?")]
            for i in questions:
                answer = next((ln for ln in body[i + 1:] if ln.strip()), "")
                if answer and not answer.startswith("#"):
                    faq_q += 1
        elif word_count("\n".join(body)) < 30:
            out.append(f"sekcja „{heading}” jest pusta lub zbyt krótka (< 30 słów)")
    if not faq_found:
        out.append("brak sekcji '## Najczęstsze pytania'")
    elif faq_q < spec["faq"]:
        out.append(f"sekcja FAQ ma {faq_q} pytań z odpowiedzią – wymagane min. {spec['faq']} (### Pytanie? + odpowiedź)")
    if type_key == "checklist" and sum(1 for ln in lines if ln.startswith("- ")) < 15:
        out.append("checklista wymaga co najmniej 15 punktów listy")
    if type_key == "howto" and sum(1 for ln in h3 if re.match(r"^###\s+krok\s*\d", ln, re.I)) < 3:
        out.append("instrukcja wymaga co najmniej 3 kroków jako '### Krok 1: …'")
    if type_key == "comparison" and not any(re.search(r"porówna|kiedy wybra|co wybra|różnic|\bvs\b|czy\b", ln, re.I) for ln in h2):
        out.append("porównanie wymaga sekcji 'Porównanie w skrócie' lub 'Kiedy wybrać którą opcję'")
    if type_key == "seasonal" and not any(re.search(r"harmonogram|kalendarz|tydz|termin|plan", ln, re.I) for ln in h2):
        out.append("artykuł sezonowy wymaga sekcji '## Harmonogram …' z etapami przygotowań")
    if content.strip().split("\n")[-1].strip() != HOME_LINK:
        out.append("ostatnia linia musi być linkiem do strony głównej")

    # Links: internal must be live pages, external only official sources from the plan.
    registry = {_norm_url(s["url"]): s for s in plan.get("sources", {}).values()}
    internal, has_cta = set(), False
    for text, url in LINK.findall(content):
        path = _internal_path(url)
        if url.startswith("https://app.allgrafika.pl"):
            if _norm_url(url) != REGISTER_URL:
                out.append(f"link do aplikacji tylko na {REGISTER_URL} (jest {url})")
            has_cta = True
        elif path is not None:
            if path in ("/", "/blog"):
                continue
            if path not in site["routes"]:
                out.append(f"link wewnętrzny do nieistniejącej strony: {path}")
            elif path != f"/blog/{slug}":
                internal.add(path)
                if not path.startswith("/blog/"):
                    has_cta = True
        elif _norm_url(url) not in registry:
            out.append(f"link zewnętrzny spoza listy oficjalnych źródeł: {url}")
    if len(internal) < spec["min_links"]:
        out.append(f"za mało linków wewnętrznych ({len(internal)}) – {type_key} wymaga min. {spec['min_links']} do istniejących wpisów/stron")
    planned = [p for p in planned_links if p in site["routes"]]
    if planned and not internal & set(planned):
        out.append("brak linku do żadnej z zaplanowanych stron: " + ", ".join(planned))
    if not has_cta:
        out.append(f"brak uczciwego CTA – co najmniej jeden link do {REGISTER_URL} albo strony narzędzia")

    # Claims: numbers and platform rules need an official source; no invented results.
    for heading, body in sections(content):
        section_text = "\n".join(body)
        section_sources = {registry[_norm_url(u)]["platform"] for _, u in LINK.findall(section_text) if _norm_url(u) in registry}
        for raw_line in body:
            if not raw_line.strip() or raw_line.startswith("#"):
                continue
            line_has_source = any(_norm_url(u) in registry for _, u in LINK.findall(raw_line))
            # Heuristics read what the reader sees: link text, not URLs (slugs contain "vinted", "ai", …).
            line = re.sub(r"https?://\S+", " ", LINK.sub(lambda m: m.group(1), raw_line))
            low = line.lower()
            snippet = line.strip()[:70]
            platforms_in_line = {p for p, pattern in PLATFORMS.items() if re.search(pattern, low)}
            sourced_rule = bool(platforms_in_line & section_sources)
            if GROWTH.search(line) and not line_has_source:
                out.append(f"procentowy wzrost/spadek bez źródła: „{snippet}…” – usuń liczby")
            elif (
                PERCENT.search(DISCOUNT_BADGE.sub(" ", line))
                and not (line_has_source or sourced_rule or HYPOTHETICAL.search(line))
            ):
                out.append(f"liczba procentowa bez oficjalnego źródła w tym samym akapicie: „{snippet}…”")
            if (RESEARCH.search(line) or RATIO.search(line)) and not line_has_source:
                out.append(f"powołanie się na badania/statystyki bez źródła: „{snippet}…” – usuń albo podaj źródło z listy")
            if CASE_STUDY.search(line) and not HYPOTHETICAL.search(line):
                out.append(f"case study lub wyniki klientów przedstawione jako prawdziwe: „{snippet}…”")
            for platform in sorted(platforms_in_line):
                if PLATFORM_FACT.search(line) and platform not in section_sources:
                    if any(s.get("platform") == platform for s in plan.get("sources", {}).values()):
                        out.append(f"zasada/liczba platformy {platform} bez linku do oficjalnego źródła w tej sekcji: „{snippet}…”")
                    else:
                        out.append(f"fakt o platformie {platform}, dla której nie mamy oficjalnego źródła – usuń go: „{snippet}…”")
            if re.search(PLATFORMS["vinted"], low) and VINTED_AI.search(line) and not NEGATION.search(line):
                out.append(f"Vinted wymaga własnych, nieedytowanych zdjęć – nie polecaj tam AI ani scen generowanych: „{snippet}…”")
            if re.search(PLATFORMS["ebay"], low) and EBAY_OVERLAY.search(line) and not NEGATION.search(line):
                out.append(f"eBay zabrania dodanych napisów, ramek i znaków wodnych na zdjęciach: „{snippet}…”")
            if re.search(PLATFORMS["amazon"], low) and re.search(r"zdjęci\w* główn", low) and AMAZON_MAIN_BAD.search(line) and not NEGATION.search(line):
                out.append(f"zdjęcie główne na Amazon: czyste białe tło, produkt ≥ 85% kadru, bez scen i napisów: „{snippet}…”")
            for sentence in _sentences(line):
                if COMPETITORS.search(sentence) and NEGATIVE.search(sentence):
                    out.append(f"nie oceniaj negatywnie innych narzędzi/firm: „{sentence.strip()[:70]}…”")
            if SUPERLATIVE.search(line) or GUARANTEE.search(line):
                out.append(f"nieuczciwa obietnica lub superlatyw o AllGrafika: „{snippet}…”")
            if FALSE_PROMISE.search(line) and not re.search(r"\bnie\b", low):
                out.append(f"AllGrafika nie łączy się z platformami i niczego nie publikuje: „{snippet}…”")
            if OWN_MODEL.search(line):
                out.append("AllGrafika nie ma własnego modelu AI (korzysta z modeli Google Gemini i OpenAI)")
            for m in FREE_CLAIM.finditer(line):
                n = int(m.group(1) or m.group(4))
                if n != FREE_GRAPHICS:
                    out.append(f"nowe konto ma {FREE_GRAPHICS} darmowych grafik (nie {n})")
    # Each reason once, in order.
    return list(dict.fromkeys(out))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", type=Path, required=True)
    ap.add_argument("--type", default=None)
    ap.add_argument("--keyword", default=None)
    ap.add_argument("--links", default="")
    args = ap.parse_args(argv)
    article = json.loads(args.check.read_text(encoding="utf-8"))
    site, plan = site_context(), load_plan()
    fixes = normalize(article, site)
    type_key = args.type or article.get("type") or "guide"
    found = problems(article, type_key, site, plan, args.keyword or article.get("keyword"), [p for p in args.links.split(",") if p])
    internal = sorted({p for _, u in LINK.findall(article["content"]) if (p := _internal_path(u)) and p not in ("/", "/blog")})
    print(json.dumps({"problems": found, "fixes": fixes, "title": article["title"], "excerpt": article["excerpt"],
                      "words": word_count(article["content"]), "internal_links": internal}, ensure_ascii=False, indent=2))
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
