"""
Duplicate / cannibalisation detection for blog posts (shared by the daily bot and the build check).

Polish is heavily inflected ("zdjęcie", "zdjęcia", "zdjęć"), so words are folded to ASCII and cut to a
short stem before comparing. Three signals:
  - topic:   stems of slug + title (+ H2 headings) – catches the same subject in other words
  - content: overlapping 3-stem shingles of the body – catches rewritten copies of an article
  - keyword: share of a target keyword's stems already present in an existing title – cannibalisation
"""
import re
import unicodedata

STEM = 6
STOPWORDS = {
    "jak", "na", "i", "w", "z", "do", "dla", "o", "a", "sie", "czy", "co", "to", "ze", "od", "po", "przy", "bez",
    "jest", "sa", "nie", "tak", "oraz", "lub", "czyli", "ktory", "ktora", "ktore", "twoj", "twoje", "twoja",
    "allegro", "miniat", "grafik", "allgra", "porad", "krok", "2025", "2026", "sposob", "najlep",
}


def fold(text: str) -> str:
    text = text.replace("ł", "l").replace("Ł", "L")
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c)).lower()


def stems(text: str) -> list:
    words = re.findall(r"[a-z0-9]+", fold(text))
    out = []
    for w in words:
        s = w[:STEM]
        if len(w) > 2 and s not in STOPWORDS:
            out.append(s)
    return out


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def headings(markdown: str) -> str:
    return " ".join(re.findall(r"^#{2,3}\s+(.+)$", markdown or "", flags=re.M))


def topic_set(slug: str, title: str, content: str = "") -> set:
    # Headings add the sub-topics; FAQ headings are generic and would only add noise.
    hs = " ".join(h for h in re.findall(r"^##\s+(.+)$", content or "", flags=re.M) if "pytani" not in fold(h))
    return set(stems(slug.replace("-", " ") + " " + title + " " + hs))


def shingles(content: str, n: int = 3) -> set:
    words = stems(re.sub(r"\[[^\]]*\]\([^)]*\)", " ", content or ""))  # links are boilerplate
    return {" ".join(words[i : i + n]) for i in range(len(words) - n + 1)}


# Thresholds tuned on the existing corpus (70 posts, 2026-10-09): different category guides reach
# topic 0.47 with content 0.03, so the topic alone may only block very close titles; together with
# overlapping content a lower topic score is enough.
TOPIC_LIMIT = 0.6
TOPIC_WITH_CONTENT = (0.35, 0.06)
CONTENT_LIMIT = 0.15
KEYWORD_LIMIT = 0.75


def compare(new: dict, old: dict) -> dict:
    return {
        "topic": jaccard(topic_set(new["slug"], new["title"], new.get("content", "")), topic_set(old["slug"], old["title"], old.get("content", ""))),
        "content": jaccard(shingles(new.get("content", "")), shingles(old.get("content", ""))),
    }


def duplicate_reason(new: dict, corpus: list):
    """The first existing post the new one duplicates, as a human-readable reason – or None."""
    for old in corpus:
        if old["slug"] == new["slug"]:
            return f"DUPLICATE: post '{new['slug']}' already exists"
        score = compare(new, old)
        if score["topic"] >= TOPIC_LIMIT or (score["topic"] >= TOPIC_WITH_CONTENT[0] and score["content"] >= TOPIC_WITH_CONTENT[1]):
            return f"temat zbyt podobny do istniejącego wpisu '{old['slug']}' ({old['title']}) – wybierz inny temat"
        if score["content"] >= CONTENT_LIMIT:
            return f"treść zbyt podobna do wpisu '{old['slug']}' ({old['title']}) – napisz inny artykuł"
    return None


def keyword_taken(keyword: str, corpus: list):
    """An existing post that already targets this keyword (cannibalisation), or None."""
    k = set(stems(keyword))
    if len(k) < 2:  # one generic stem ("produkt") would match half of the blog – leave it to the article check
        return None
    for old in corpus:
        title = set(stems(old["slug"].replace("-", " ") + " " + old["title"]))
        if len(k & title) / len(k) >= KEYWORD_LIMIT:
            return old
    return None


def reserved_by(keyword: str, reserved: list):
    """The landing-page phrase that owns this keyword (spec 10, AC-SEO-008), or None.

    Both directions must overlap: a shared generic stem ("zdjęcia", "produkt") alone does not take a guide topic away
    from the blog, only a phrase that is essentially the same query does.
    """
    k = set(stems(keyword))
    if len(k) < 2:
        return None
    for item in reserved:
        r = set(stems(item["title"]))
        if r and len(k & r) / len(k) >= KEYWORD_LIMIT and len(k & r) / len(r) >= KEYWORD_LIMIT:
            return item
    return None
