"""Tests for backend/utils.py JSON extraction helper."""

from backend.utils import extract_json


class TestExtractJson:
    def test_plain_object(self):
        assert extract_json('{"a": 1}') == {"a": 1}

    def test_plain_array(self):
        assert extract_json('[1, 2, 3]') == [1, 2, 3]

    def test_object_wrapped_in_markdown_fence(self):
        text = '```json\n{"score": 80, "gaps": ["x"]}\n```'
        assert extract_json(text) == {"score": 80, "gaps": ["x"]}

    def test_object_with_surrounding_prose(self):
        text = 'Here is the result:\n{"ok": true}\nHope that helps!'
        assert extract_json(text) == {"ok": True}

    def test_nested_object(self):
        text = '{"outer": {"inner": [1, 2]}}'
        assert extract_json(text) == {"outer": {"inner": [1, 2]}}

    def test_no_json_returns_none(self):
        assert extract_json("no json here at all") is None

    def test_malformed_json_returns_none(self):
        assert extract_json("{not: valid json,}") is None

    def test_empty_string_returns_none(self):
        assert extract_json("") is None

    def test_array_preferred_when_object_braces_absent(self):
        text = 'result: [{"a": 1}, {"b": 2}]'
        assert extract_json(text) == [{"a": 1}, {"b": 2}]
