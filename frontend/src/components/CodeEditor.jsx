import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { EditorView } from "@codemirror/view";

const LANG_EXTENSIONS = {
  python: python(),
  javascript: javascript(),
  java: java(),
  cpp: cpp(),
};

const baseTheme = EditorView.theme({
  "&": { backgroundColor: "transparent" },
  ".cm-scroller": { fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace", fontSize: "13px" },
  ".cm-gutters": { backgroundColor: "#111827", borderRight: "1px solid #1f2937" },
  ".cm-lineNumbers .cm-gutterElement": { color: "#4b5563", minWidth: "2.5rem", padding: "0 8px 0 4px" },
  ".cm-activeLine": { backgroundColor: "rgba(99, 102, 241, 0.07)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(99, 102, 241, 0.12)" },
  ".cm-cursor": { borderLeftColor: "#34d399" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(99, 102, 241, 0.3) !important" },
  ".cm-focused": { outline: "none" },
  ".cm-content": { padding: "8px 0" },
});

export const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
];

export function LanguageSelector({ language, onChange, className = "" }) {
  return (
    <select
      value={language}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1
                  focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors ${className}`}
    >
      {LANGUAGES.map((l) => (
        <option key={l.value} value={l.value}>{l.label}</option>
      ))}
    </select>
  );
}

export default function CodeEditor({
  value,
  onChange,
  language = "python",
  minHeight = "200px",
  maxHeight = "500px",
  disabled = false,
  placeholder = "# Write your code here...",
}) {
  const langExt = LANG_EXTENSIONS[language] || LANG_EXTENSIONS.python;

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={vscodeDark}
      extensions={[langExt, baseTheme]}
      editable={!disabled}
      placeholder={placeholder}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
        tabSize: 4,
      }}
      style={{ minHeight, maxHeight, overflow: "auto" }}
    />
  );
}
