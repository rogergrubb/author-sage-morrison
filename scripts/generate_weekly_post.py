#!/usr/bin/env python3
"""
Generate one weekly blog post in Sage Morrison's voice using the Anthropic API.

Reads the voice rules from scripts/sage_voice_system_prompt.md, prompts Claude
for a single blog post (returned as JSON), and writes:
  - /blog/posts/YYYY-MM-DD-{slug}.html   (the post)
  - /blog/index.html                      (regenerated index)
  - /sitemap.xml                          (regenerated)

Requires environment variable ANTHROPIC_API_KEY (set as a GitHub Actions secret).

Idempotent: if a post for today's date already exists, exits 0 without writing.
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib import request, error

REPO_ROOT  = Path(__file__).resolve().parent.parent
BLOG_DIR   = REPO_ROOT / "blog"
POSTS_DIR  = BLOG_DIR / "posts"
INDEX_HTML = BLOG_DIR / "index.html"
SITEMAP    = REPO_ROOT / "sitemap.xml"
SYS_PROMPT = REPO_ROOT / "scripts" / "sage_voice_system_prompt.md"

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL   = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")


def slugify(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60]


def call_claude(system_prompt, user_prompt):
    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(2)

    body = {
        "model"      : ANTHROPIC_MODEL,
        "max_tokens" : 2500,
        "system"     : system_prompt,
        "messages"   : [{"role": "user", "content": user_prompt}],
    }
    req = request.Request(
        "https://api.anthropic.com/v1/messages",
        data    = json.dumps(body).encode("utf-8"),
        headers = {
            "x-api-key"        : ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type"     : "application/json",
        },
        method  = "POST",
    )
    try:
        with request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read())
    except error.HTTPError as e:
        print(f"ERROR calling Claude: {e.code} {e.read().decode()[:500]}", file=sys.stderr)
        sys.exit(3)

    text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    return text


def parse_post_json(raw):
    """Pull a JSON object out of Claude's reply, tolerating code fences."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            print("ERROR: no JSON in Claude reply:", raw[:500], file=sys.stderr)
            sys.exit(4)
        return json.loads(m.group(0))


def render_post_html(post, date_str):
    title = post["title"]
    dek   = post["dek"]
    body  = post["body_html"]
    slug  = slugify(post.get("slug") or title)
    read  = post.get("read_minutes", 4)

    filename  = f"{date_str}-{slug}.html"
    canonical = f"https://www.authorsagemorrison.com/blog/posts/{filename}"
    pretty_date = datetime.strptime(date_str, "%Y-%m-%d").strftime("%B %-d, %Y") \
                  if hasattr(datetime, "strptime") else date_str

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{escape(title)} — Sage Morrison</title>
    <meta name="description" content="{escape(dek)}">
    <link rel="canonical" href="{canonical}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="{escape(title)}">
    <meta property="og:description" content="{escape(dek)}">
    <meta property="og:url" content="{canonical}">
    <meta property="og:image" content="https://www.authorsagemorrison.com/sage-morrison.png">
    <meta property="article:author" content="Sage Morrison">
    <meta property="article:published_time" content="{date_str}T08:00:00Z">
    <link rel="icon" type="image/png" href="/sage-morrison.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    <style>
        .post-shell {{ max-width: 720px; margin: 0 auto; padding: 7rem 2rem 4rem; }}
        .post-meta {{ color: rgba(0,0,0,0.55); font-size: 0.9rem; letter-spacing: 1.5px; text-transform: uppercase; }}
        .post-shell h1 {{ font-family: 'Playfair Display', serif; font-size: 2.6rem; margin: 0.4rem 0 0.5rem; line-height: 1.15; }}
        .post-shell .dek {{ font-style: italic; color: rgba(0,0,0,0.65); font-size: 1.1rem; margin-bottom: 2.5rem; }}
        .post-body p {{ line-height: 1.78; font-size: 1.07rem; margin-bottom: 1.3rem; }}
        .post-body p.lead {{ font-size: 1.18rem; }}
        .post-body em {{ color: #5C3414; }}
        .post-pullquote {{
            font-family: 'Playfair Display', serif; font-style: italic;
            font-size: 1.5rem; line-height: 1.4;
            border-left: 3px solid #C66B1A; padding: 0.4rem 0 0.4rem 1.4rem;
            margin: 2.2rem 0; color: #5C3414;
        }}
        .post-cta {{ margin-top: 3.5rem; padding-top: 2rem; border-top: 1px solid rgba(0,0,0,0.12); }}
        .post-cta a {{ color: #C66B1A; }}
        .post-back {{ display: inline-block; margin-top: 2rem; padding: 0.6rem 1.3rem; border: 1px solid currentColor; text-decoration: none; }}
    </style>
</head>
<body>
    <div class="noise-overlay"></div>
    <nav class="nav">
        <div class="nav-content">
            <a href="/" class="logo">Sage Morrison</a>
            <div class="nav-links">
                <a href="/#books">Books</a>
                <a href="/blog/">Blog</a>
                <a href="/#about">About</a>
                <a href="/newsletter.html">Newsletter</a>
                <a href="/#contact">Contact</a>
            </div>
        </div>
    </nav>
    <main class="post-shell">
        <div class="post-meta">{pretty_date} · {read} min read</div>
        <h1>{escape(title)}</h1>
        <p class="dek">{escape(dek)}</p>
        <div class="post-body">
{body}
        </div>
        <div class="post-cta">
            <p><em>If this landed for you, the <a href="/newsletter.html">monthly reflections</a> are notes like this, sent once or twice a month. Short, uplifting, no spam, unsubscribe whenever.</em></p>
        </div>
        <a href="/blog/" class="post-back">← All posts</a>
    </main>
    <footer class="footer">
        <div class="footer-content">
            <p class="footer-text">© {datetime.now(timezone.utc).year} Sage Morrison. All rights reserved.</p>
            <div class="footer-links">
                <a href="/privacy.html">Privacy Policy</a>
                <a href="#">Terms of Use</a>
            </div>
        </div>
    </footer>
</body>
</html>
"""
    return filename, html


def escape(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def rebuild_index():
    """Scan posts directory, build index in date-desc order."""
    posts = []
    for f in sorted(POSTS_DIR.glob("*.html"), reverse=True):
        m = re.match(r"(\d{4}-\d{2}-\d{2})-", f.name)
        if not m:
            continue
        date_str = m.group(1)
        text = f.read_text(encoding="utf-8")
        title_m = re.search(r"<h1>(.*?)</h1>", text, re.DOTALL)
        dek_m   = re.search(r'<p class="dek">(.*?)</p>', text, re.DOTALL)
        read_m  = re.search(r"·\s*(\d+)\s*min read", text)
        if not title_m or not dek_m:
            continue
        pretty_date = datetime.strptime(date_str, "%Y-%m-%d").strftime("%B %-d, %Y")
        posts.append({
            "file" : f.name,
            "date" : date_str,
            "pretty_date": pretty_date,
            "title": re.sub(r"<.*?>", "", title_m.group(1)).strip(),
            "dek"  : re.sub(r"<.*?>", "", dek_m.group(1)).strip(),
            "read" : read_m.group(1) if read_m else "4",
        })

    cards = "\n".join(f"""        <a class="post-card" href="/blog/posts/{p['file']}">
            <div class="post-meta">{p['pretty_date']} · {p['read']} min read</div>
            <h2>{escape(p['title'])}</h2>
            <p class="post-dek">{escape(p['dek'])}</p>
        </a>""" for p in posts)

    idx = INDEX_HTML.read_text(encoding="utf-8")
    idx = re.sub(
        r"<!-- POSTS_LIST_START -->.*?<!-- POSTS_LIST_END -->",
        f"<!-- POSTS_LIST_START -->\n{cards}\n        <!-- POSTS_LIST_END -->",
        idx, count=1, flags=re.DOTALL,
    )
    INDEX_HTML.write_text(idx, encoding="utf-8")
    return posts


def rebuild_sitemap(posts):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls = [
        ("https://www.authorsagemorrison.com/",                today, "weekly",  "1.0"),
        ("https://www.authorsagemorrison.com/blog/",           today, "weekly",  "0.9"),
        ("https://www.authorsagemorrison.com/newsletter.html", today, "monthly", "0.6"),
        ("https://www.authorsagemorrison.com/privacy.html",    today, "yearly",  "0.3"),
    ]
    for p in posts:
        urls.append((
            f"https://www.authorsagemorrison.com/blog/posts/{p['file']}",
            p["date"], "monthly", "0.7",
        ))

    body = "\n".join(
        f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{lm}</lastmod>\n    <changefreq>{cf}</changefreq>\n    <priority>{pr}</priority>\n  </url>"
        for loc, lm, cf, pr in urls
    )
    SITEMAP.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n"
        "</urlset>\n",
        encoding="utf-8",
    )


def main():
    system_prompt = SYS_PROMPT.read_text(encoding="utf-8")

    user_prompt = (
        "Write the next weekly blog post for the Sage Morrison blog. "
        "Pick a topic the reader needs this week — something small, specific, and "
        "uplifting. Avoid topics that overlap with the post 'The Quiet Victory of "
        "the Honest Pause' if at all possible.\n\n"
        "Return ONLY a valid JSON object with these keys (no surrounding text, no "
        "code fences):\n"
        '  "title": string (6-9 words, not a question)\n'
        '  "slug":  string (lowercase, hyphenated, ≤60 chars)\n'
        '  "dek":   string (one sentence, gives the reader a reason to read)\n'
        '  "read_minutes": integer (3-6)\n'
        '  "body_html": string (the body, in <p>...</p> paragraphs; include at most '
        'one <div class=\\"post-pullquote\\">...</div> for the strongest single line; '
        '500-900 words; ends on a steady, warm forward move; no <h1>, <h2>, or '
        '<h3> tags — only <p> with optional <em> and the one pullquote div)\n'
    )

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Idempotency: if today already has a post, skip.
    if any(p.name.startswith(today) for p in POSTS_DIR.glob("*.html")):
        print(f"Post for {today} already exists. Nothing to do.")
        return

    raw  = call_claude(system_prompt, user_prompt)
    post = parse_post_json(raw)

    filename, html = render_post_html(post, today)
    out = POSTS_DIR / filename
    out.write_text(html, encoding="utf-8")
    print(f"Wrote {out.relative_to(REPO_ROOT)} ({len(html)} bytes)")

    posts = rebuild_index()
    rebuild_sitemap(posts)
    print(f"Rebuilt blog index ({len(posts)} posts) and sitemap.")


if __name__ == "__main__":
    main()
