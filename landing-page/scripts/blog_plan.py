"""
Topic plan of the blog bot (docs/specs/23-blog-bot.md).

The plan (blog-keywords.json) holds researched Polish e-commerce queries grouped in clusters; the ledger
(blog-keywords-used.json) records what was published or skipped. This module validates the plan against the
live site, knows the seasonal calendar and picks the next topic so that the blog stays cross-cutting:

  - never the same cluster twice in a row (when anything else is available),
  - seasonal topics only 6 to 3 weeks before the event (and before everything else in that window),
  - a pillar guide at least every PILLAR_EVERY articles while pillar topics remain,
  - the article type changes from one article to the next when possible,
  - then priority (1 = highest) and the cluster that has the fewest articles so far.

CLI (used by the workflow and the tests):
  python3 blog_plan.py --validate                  plan problems (exit 1) and warnings
  python3 blog_plan.py --next 10 [--today Y-M-D]   the next N topics on the publishing schedule (JSON)
      [--ledger FILE] [--plan FILE] [--no-site]    --no-site skips the cannibalisation checks against the posts
"""
import argparse
import json
import os
import re
import sys
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
LANDING = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))
from blog_similarity import keyword_taken, reserved_by  # noqa: E402

PLAN_FILE = SCRIPTS / "blog-keywords.json"
LEDGER_FILE = SCRIPTS / "blog-keywords-used.json"
# BLOG_POSTS_DIR: tests run the bot against a copy of the posts so parallel test files never race on one directory.
POSTS_DIR = Path(os.environ.get("BLOG_POSTS_DIR") or (LANDING / "src/data/blogPosts"))

ARTICLE_TYPES = ("pillar", "guide", "howto", "comparison", "checklist", "seasonal")
INTENTS = ("informacyjna", "poradnikowa", "porownawcza", "transakcyjna")
CATEGORIES = ("Poradniki", "Technologia", "Styl i design", "E-commerce", "Optymalizacja")
PILLAR_EVERY = 6  # at least one pillar guide in every 6 published articles
SEASON_OPEN_DAYS = 42  # a seasonal topic becomes eligible 6 weeks before the event…
SEASON_CLOSE_DAYS = 21  # …and is not written later than 3 weeks before it
PUBLISH_WEEKDAYS = (0, 2, 4)  # Mon, Wed, Fri – keep in sync with the cron in .github/workflows/daily-blog.yml
MIN_ENTRIES_PER_CLUSTER = 4
UNSUPPORTED = re.compile(r"allegro", re.I)  # spec 10, AC-SEO-012


# ── Seasonal calendar ───────────────────────────────────────────────
def easter(year: int) -> date:
    """Gregorian Easter Sunday (anonymous algorithm)."""
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l_ = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_) // 451
    month = (h + l_ - 7 * m + 114) // 31
    day = ((h + l_ - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def black_friday(year: int) -> date:
    """The day after the fourth Thursday of November."""
    first = date(year, 11, 1)
    first_thursday = first + timedelta(days=(3 - first.weekday()) % 7)
    return first_thursday + timedelta(days=22)


EVENTS = {
    "nowy-rok": ("Nowy Rok", lambda y: date(y, 1, 1)),
    "walentynki": ("Walentynki", lambda y: date(y, 2, 14)),
    "dzien-kobiet": ("Dzień Kobiet", lambda y: date(y, 3, 8)),
    "wielkanoc": ("Wielkanoc", easter),
    "dzien-matki": ("Dzień Matki", lambda y: date(y, 5, 26)),
    "dzien-dziecka": ("Dzień Dziecka", lambda y: date(y, 6, 1)),
    "dzien-ojca": ("Dzień Ojca", lambda y: date(y, 6, 23)),
    "powrot-do-szkoly": ("powrót do szkoły", lambda y: date(y, 9, 1)),
    "black-friday": ("Black Friday", black_friday),
    "mikolajki": ("Mikołajki", lambda y: date(y, 12, 6)),
    "boze-narodzenie": ("Boże Narodzenie", lambda y: date(y, 12, 24)),
}


def next_event(event: str, today: date) -> date:
    when = EVENTS[event][1](today.year)
    return when if when >= today else EVENTS[event][1](today.year + 1)


def days_to_event(event: str, today: date) -> int:
    return (next_event(event, today) - today).days


def in_season_window(event: str, today: date) -> bool:
    return SEASON_CLOSE_DAYS <= days_to_event(event, today) <= SEASON_OPEN_DAYS


# ── Plan, ledger and the live site ──────────────────────────────────
def load_json(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def load_plan(path: Path = PLAN_FILE) -> dict:
    return load_json(path, {"clusters": {}, "sources": {}, "entries": []})


def load_ledger(path: Path = LEDGER_FILE) -> list:
    return load_json(path, [])


def _field(src: str, name: str):
    m = re.search(rf"(?:^|[\s,{{]){name}:\s*'((?:[^'\\]|\\.)*)'", src, re.M) or re.search(rf'(?:^|[\s,{{]){name}:\s*"((?:[^"\\]|\\.)*)"', src, re.M)
    return m.group(1).replace("\\'", "'") if m else None


def site_context() -> dict:
    """Everything the bot needs to know about the live landing page: posts, keyword landing pages, redirects."""
    posts = []
    for f in sorted(POSTS_DIR.glob("*.ts")):
        src = f.read_text(encoding="utf-8")
        content = re.search(r"content:\s*`([\s\S]*?)`\s*,?\s*\n", src)
        posts.append({
            "slug": _field(src, "slug") or f.stem,
            "title": _field(src, "title") or f.stem,
            "category": _field(src, "category") or "",
            "content": content.group(1) if content else "",
        })
    seo_src = (LANDING / "src/data/seoPages.ts").read_text(encoding="utf-8")
    landing_pages = [
        {"path": m.group(1), "h1": m.group(2), "keywords": re.findall(r"'([^']+)'", m.group(3))}
        for m in re.finditer(r"path: '(/[a-z0-9-]+)',.*?h1: '([^']+)',.*?keywords: \[([^\]]*)\]", seo_src, re.S)
    ]
    vercel = load_json(LANDING / "vercel.json", {})
    redirects = {r["source"]: r["destination"] for r in vercel.get("redirects", [])}
    retired = load_json(LANDING / "src/data/retired-slugs.json", [])
    routes = {"/", "/blog", "/regulamin", "/polityka-prywatnosci"}
    routes |= {p["path"] for p in landing_pages}
    routes |= {f"/blog/{p['slug']}" for p in posts}
    reserved = [{"slug": p["path"].strip("/"), "title": kw, "path": p["path"]} for p in landing_pages for kw in p["keywords"]]
    return {"posts": posts, "landing_pages": landing_pages, "redirects": redirects, "retired": retired, "routes": routes, "reserved": reserved}


def resolve_link(path: str, site: dict):
    """The live route a plan link points to (following one 301 from vercel.json), or None."""
    path = "/" + path.strip("/") if path != "/" else "/"
    if path in site["routes"]:
        return path
    target = site["redirects"].get(path)
    return target if target in site["routes"] else None


def link_title(path: str, site: dict) -> str:
    for p in site["posts"]:
        if f"/blog/{p['slug']}" == path:
            return p["title"]
    for p in site["landing_pages"]:
        if p["path"] == path:
            return p["h1"]
    return path


# ── Validation ──────────────────────────────────────────────────────
def validate_plan(plan: dict, site: dict | None = None):
    """(problems, warnings): problems fail the workflow, warnings are shown in the job summary."""
    problems, warnings = [], []
    raw = json.dumps(plan, ensure_ascii=False)
    if UNSUPPORTED.search(raw):
        problems.append("plan mentions Allegro (spec 10, AC-SEO-012)")
    clusters, sources, entries = plan.get("clusters", {}), plan.get("sources", {}), plan.get("entries", [])
    for cid, c in clusters.items():
        if c.get("category") not in CATEGORIES:
            problems.append(f"cluster {cid}: category {c.get('category')!r} is not a blog category")
        if not c.get("label"):
            problems.append(f"cluster {cid}: missing label")
    for sid, s in sources.items():
        if not str(s.get("url", "")).startswith("https://") or not s.get("publisher"):
            problems.append(f"source {sid}: needs an https url and a publisher")
    seen = set()
    for i, e in enumerate(entries):
        where = f"entry {i} ({e.get('keyword', '?')})"
        kw = str(e.get("keyword", "")).strip()
        if not kw:
            problems.append(f"{where}: missing keyword")
        if kw.lower() in seen:
            problems.append(f"{where}: duplicate keyword")
        seen.add(kw.lower())
        if e.get("cluster") not in clusters:
            problems.append(f"{where}: unknown cluster {e.get('cluster')!r}")
        if e.get("intent") not in INTENTS:
            problems.append(f"{where}: intent must be one of {INTENTS}")
        if e.get("type") not in ARTICLE_TYPES:
            problems.append(f"{where}: type must be one of {ARTICLE_TYPES}")
        if e.get("priority") not in (1, 2, 3):
            problems.append(f"{where}: priority must be 1, 2 or 3")
        if not str(e.get("angle", "")).strip():
            problems.append(f"{where}: missing angle")
        if not str(e.get("evidence", "")).strip():
            problems.append(f"{where}: missing evidence (where the query was seen)")
        if e.get("category") and e["category"] not in CATEGORIES:
            problems.append(f"{where}: category {e['category']!r} is not a blog category")
        if e.get("season") and e["season"] not in EVENTS:
            problems.append(f"{where}: unknown season {e['season']!r}")
        if e.get("type") == "seasonal" and not e.get("season"):
            problems.append(f"{where}: a seasonal article needs a season")
        for sid in e.get("sources", []):
            if sid not in sources:
                problems.append(f"{where}: unknown source {sid!r}")
        links = e.get("links", [])
        if len(links) < 2:
            problems.append(f"{where}: needs at least 2 target internal links")
        if site:
            for link in links:
                if not resolve_link(link, site):
                    problems.append(f"{where}: link {link} is not a live page (nor a 301 to one)")
            owner = reserved_by(kw, site["reserved"])
            if owner:
                problems.append(f"{where}: keyword belongs to the landing page {owner['path']} (AC-SEO-008)")
            taken = keyword_taken(kw, site["posts"])
            if taken:
                warnings.append(f"{where}: already covered by /blog/{taken['slug']} – the bot will skip it")
    counts = Counter(e.get("cluster") for e in entries)
    for cid in clusters:
        if counts[cid] < MIN_ENTRIES_PER_CLUSTER:
            problems.append(f"cluster {cid}: only {counts[cid]} entries (minimum {MIN_ENTRIES_PER_CLUSTER})")
    types = Counter(e.get("type") for e in entries)
    for t in ARTICLE_TYPES:
        if not types[t]:
            problems.append(f"no entry of type {t}")
    return problems, warnings


# ── Topic selection ─────────────────────────────────────────────────
def entry_for(keyword: str, plan: dict):
    for e in plan.get("entries", []):
        if e["keyword"] == keyword:
            return e
    return None


def published(ledger: list) -> list:
    return [u for u in ledger if not u.get("covered")]


def _meta(record: dict, plan: dict, key: str):
    if record.get(key):
        return record[key]
    e = entry_for(record.get("keyword", ""), plan)
    return e.get(key) if e else None


def pick_topic(plan: dict, ledger: list, today: date, available=None, exclude=()):
    """The next plan entry to write (with a short `why`), or (None, reason)."""
    used = {u["keyword"] for u in ledger} | set(exclude)
    pub = published(ledger)
    last = pub[-1] if pub else {}
    last_cluster, last_type = _meta(last, plan, "cluster"), _meta(last, plan, "type")
    recent_types = [_meta(u, plan, "type") for u in pub[-(PILLAR_EVERY - 1):]]
    counts = Counter(_meta(u, plan, "cluster") for u in pub)
    candidates = []
    for i, e in enumerate(plan.get("entries", [])):
        if e["keyword"] in used:
            continue
        if e.get("season") and not in_season_window(e["season"], today):
            continue
        candidates.append((i, e))
    if not candidates:
        return None, "plan exhausted – no unused entry is available today (add researched keywords to blog-keywords.json)"
    pillar_left = any(e["type"] == "pillar" for _, e in candidates)
    pillar_due = pillar_left and "pillar" not in recent_types

    def rank(item):
        i, e = item
        return (
            e["cluster"] == last_cluster,
            not e.get("season"),
            days_to_event(e["season"], today) if e.get("season") else 0,
            not (pillar_due and e["type"] == "pillar"),
            e["type"] == last_type,
            e["priority"],
            counts[e["cluster"]],
            i,
        )

    for _, e in sorted(candidates, key=rank):
        if available is None or available(e):
            why = []
            if e.get("season"):
                why.append(f"sezon: {EVENTS[e['season']][0]} za {days_to_event(e['season'], today)} dni")
            if pillar_due and e["type"] == "pillar":
                why.append(f"przewodnik filarowy (brak w ostatnich {PILLAR_EVERY - 1} wpisach)")
            if e["cluster"] == last_cluster:
                why.append("UWAGA: ten sam klaster co poprzednio – brak innych tematów")
            why.append(f"klaster {e['cluster']} (wpisów: {counts[e['cluster']]}), typ {e['type']}, priorytet {e['priority']}")
            return e, "; ".join(why)
    return None, "every remaining entry is already covered by an existing post or reserved for a landing page"


def availability(site: dict):
    """The plan entries the bot may write today: not reserved for a landing page, not already covered by a post."""

    def ok(e):
        return not reserved_by(e["keyword"], site["reserved"]) and not keyword_taken(e["keyword"], site["posts"])

    return ok


def next_publish_day(d: date) -> date:
    d += timedelta(days=1)
    while d.weekday() not in PUBLISH_WEEKDAYS:
        d += timedelta(days=1)
    return d


def simulate(plan: dict, ledger: list, today: date, n: int, available=None) -> list:
    """The next n topics on the publishing schedule, assuming every article gets published."""
    ledger = list(ledger)
    out = []
    day = today if today.weekday() in PUBLISH_WEEKDAYS else next_publish_day(today)
    horizon = today + timedelta(days=400)
    while len(out) < n and day <= horizon:
        e, why = pick_topic(plan, ledger, day, None)
        if e is None:
            # Only out-of-season topics left today – the bot publishes nothing and tries on the next run.
            if not any(x["keyword"] not in {u["keyword"] for u in ledger} for x in plan.get("entries", [])):
                break
            day = next_publish_day(day)
            continue
        if available and not available(e):
            ledger.append({"keyword": e["keyword"], "covered": True})
            continue
        topic = {"date": day.isoformat(), "keyword": e["keyword"], "cluster": e["cluster"], "type": e["type"],
                 "priority": e["priority"], "season": e.get("season"), "why": why}
        if e.get("season"):
            topic["event_date"] = next_event(e["season"], day).isoformat()
            topic["days_before"] = days_to_event(e["season"], day)
        out.append(topic)
        ledger.append({"keyword": e["keyword"], "cluster": e["cluster"], "type": e["type"], "date": day.isoformat()})
        day = next_publish_day(day)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--validate", action="store_true")
    ap.add_argument("--next", type=int, default=0)
    ap.add_argument("--today")
    ap.add_argument("--plan", type=Path, default=PLAN_FILE)
    ap.add_argument("--ledger", type=Path, default=LEDGER_FILE)
    ap.add_argument("--no-site", action="store_true")
    args = ap.parse_args(argv)
    plan = load_plan(args.plan)
    site = None if args.no_site else site_context()
    status = 0
    if args.validate:
        problems, warnings = validate_plan(plan, site)
        for w in warnings:
            print(f"warning: {w}")
        for p in problems:
            print(f"problem: {p}")
        clusters = Counter(e["cluster"] for e in plan["entries"])
        print(f"Plan: {len(plan['entries'])} entries in {len(clusters)} clusters – " + ", ".join(f"{k} {v}" for k, v in sorted(clusters.items())))
        if problems:
            print(f"❌ {len(problems)} problem(s) in the topic plan")
            status = 1
        else:
            print("✅ Topic plan is valid")
    if args.next:
        today = date.fromisoformat(args.today) if args.today else date.today()
        topics = simulate(plan, load_ledger(args.ledger), today, args.next, availability(site) if site else None)
        print(json.dumps(topics, ensure_ascii=False, indent=2))
    return status


if __name__ == "__main__":
    sys.exit(main())
