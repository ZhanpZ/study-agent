"""Tests for LeetCode fetcher utilities."""

from backend.services.leetcode_fetcher import _resolve_tag, _html_to_text


# ── _resolve_tag ──────────────────────────────────────────────────

class TestResolveTag:
    def test_direct_match(self):
        assert _resolve_tag("binary search") == "binary-search"

    def test_alias_dp(self):
        assert _resolve_tag("dp") == "dynamic-programming"

    def test_alias_arrays(self):
        assert _resolve_tag("arrays") == "array"

    def test_alias_bst(self):
        assert _resolve_tag("bst") == "binary-search-tree"

    def test_case_insensitive(self):
        assert _resolve_tag("Binary Search") == "binary-search"
        assert _resolve_tag("DYNAMIC PROGRAMMING") == "dynamic-programming"

    def test_substring_fallback(self):
        assert _resolve_tag("advanced binary search techniques") == "binary-search"

    def test_substring_longest_match(self):
        # "sliding window" is longer than "sliding" so should match "sliding-window"
        assert _resolve_tag("sliding window maximum") == "sliding-window"

    def test_unknown_defaults_to_array(self):
        assert _resolve_tag("quantum computing") == "array"


# ── _html_to_text ─────────────────────────────────────────────────

class TestHtmlToText:
    def test_strong_tags(self):
        assert "**bold**" in _html_to_text("<strong>bold</strong>")

    def test_bold_tags(self):
        assert "**bold**" in _html_to_text("<b>bold</b>")

    def test_code_tags(self):
        assert "`code`" in _html_to_text("<code>code</code>")

    def test_br_tags(self):
        result = _html_to_text("line1<br/>line2")
        assert "line1" in result
        assert "line2" in result

    def test_html_entities(self):
        # &lt;/&gt; become < and > which then get stripped as tags by the final regex
        result = _html_to_text("5 &amp; 10 &quot;quotes&quot; &#39;apos&#39;")
        assert "&" in result
        assert '"quotes"' in result
        assert "'apos'" in result

    def test_nbsp(self):
        assert " " in _html_to_text("hello&nbsp;world")

    def test_sup_tags(self):
        assert "^2" in _html_to_text("<sup>2</sup>")

    def test_sub_tags(self):
        assert "_i" in _html_to_text("<sub>i</sub>")

    def test_li_tags(self):
        assert "- item" in _html_to_text("<li>item</li>")

    def test_strips_remaining_tags(self):
        result = _html_to_text('<div class="x">text</div>')
        assert "text" in result
        assert "<div" not in result

    def test_collapses_excessive_newlines(self):
        result = _html_to_text("<p>a</p><p></p><p></p><p></p><p>b</p>")
        # Should not have more than 2 consecutive newlines
        assert "\n\n\n" not in result
