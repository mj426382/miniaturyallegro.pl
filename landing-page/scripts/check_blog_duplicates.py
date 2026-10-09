"""
Build guard (spec 10, AC-SEO-006): no two blog posts may duplicate each other (topic or content) –
duplicates compete for the same query and hurt the whole blog in Google. Exit 1 lists the pairs.
Run: python3 landing-page/scripts/check_blog_duplicates.py
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from blog_similarity import duplicate_reason  # noqa: E402

POSTS = Path(__file__).resolve().parents[1] / "src/data/blogPosts"


def load_posts():
    posts = []
    for f in sorted(POSTS.glob("*.ts")):
        text = f.read_text(encoding="utf-8")
        title = re.search(r"title:\s*'((?:[^'\\]|\\.)*)'", text) or re.search(r'title:\s*"((?:[^"\\]|\\.)*)"', text)
        content = re.search(r"content:\s*`([\s\S]*?)`\s*,?\s*\n", text)
        posts.append({"slug": f.stem, "title": title.group(1) if title else f.stem, "content": content.group(1) if content else ""})
    return posts


def main():
    posts = load_posts()
    problems = []
    for i, post in enumerate(posts):
        reason = duplicate_reason(post, posts[:i])
        if reason:
            problems.append(f"{post['slug']}: {reason}")
    if problems:
        print("❌ Duplicate blog posts – merge them and add a 301 redirect in vercel.json:")
        for p in problems:
            print("  - " + p)
        sys.exit(1)
    print(f"✅ No duplicate blog posts ({len(posts)} checked)")


if __name__ == "__main__":
    main()
