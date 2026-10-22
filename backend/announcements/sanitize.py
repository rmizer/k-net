"""Cleans published call sheet HTML down to the markup the sheet uses, so it
can be shown back to everyone safely: no scripts, styles, event handlers,
links or outside images."""

from html import escape
from html.parser import HTMLParser

ALLOWED_TAGS = {
    "article", "div", "section", "header", "footer", "span", "p", "h1", "h2", "h3", "h4",
    "strong", "em", "b", "i", "small", "br", "ul", "ol", "li", "img",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
}  # fmt: skip
VOID_TAGS = {"br", "img", "col"}
# Dropped along with everything inside them.
DROPPED_TAGS = {"script", "style", "template", "iframe", "object", "embed", "svg", "math", "noscript", "textarea"}
ALLOWED_ATTRS = {"class", "aria-label", "colspan", "rowspan", "alt", "scope"}


def _safe_image(src):
    # The sheet's own images: the logo from the site's assets, or one inlined as data.
    src = src.strip()
    return (src.startswith("/") and not src.startswith("//")) or src.startswith("data:image/")


class _Cleaner(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.open = []
        self.dropping = 0

    def handle_starttag(self, tag, attrs):
        if tag in DROPPED_TAGS:
            if tag not in VOID_TAGS:
                self.dropping += 1
            return
        if self.dropping or tag not in ALLOWED_TAGS:
            return
        kept = [(name, value) for name, value in attrs if name in ALLOWED_ATTRS and value is not None]
        if tag == "img":
            src = dict(attrs).get("src") or ""
            if not _safe_image(src):
                return
            kept.append(("src", src.strip()))
        rendered = "".join(f' {name}="{escape(value, quote=True)}"' for name, value in kept)
        self.out.append(f"<{tag}{rendered}>")
        if tag not in VOID_TAGS:
            self.open.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS and self.open and self.open[-1] == tag:
            self.open.pop()
            self.out.append(f"</{tag}>")

    def handle_endtag(self, tag):
        if tag in DROPPED_TAGS:
            self.dropping = max(0, self.dropping - 1)
            return
        if self.dropping or tag not in self.open:
            return
        # Close anything left open inside it, so the output stays well formed.
        while self.open:
            last = self.open.pop()
            self.out.append(f"</{last}>")
            if last == tag:
                break

    def handle_data(self, data):
        if not self.dropping:
            self.out.append(escape(data, quote=False))


def clean_call_sheet(html):
    cleaner = _Cleaner()
    cleaner.feed(html)
    cleaner.close()
    cleaner.out.extend(f"</{tag}>" for tag in reversed(cleaner.open))
    return "".join(cleaner.out)
