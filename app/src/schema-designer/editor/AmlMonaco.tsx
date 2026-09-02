import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useEffect, useRef } from "react";
import { useTheme } from "../../components/ThemeProvider";
import { registerAmlLanguage } from "../aml/monacoSetup";
import { useDesignerStore } from "../state/store";

export default function AmlMonaco() {
  const { theme } = useTheme();
  const amlText = useDesignerStore((s) => s.amlText);
  const textVersion = useDesignerStore((s) => s.textVersion);
  const lastEditSource = useDesignerStore((s) => s.lastEditSource);
  const parseErrors = useDesignerStore((s) => s.parseErrors);
  const readOnly = useDesignerStore((s) => s.readOnly);
  const viewMode = useDesignerStore((s) => s.viewMode);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const applying = useRef(false);

  const onMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    registerAmlLanguage(monaco);
    ed.onDidChangeModelContent(() => {
      if (applying.current) return;
      useDesignerStore.getState().setAmlTextFromEditor(ed.getValue());
    });
  };

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    if (lastEditSource !== "editor") {
      const current = ed.getValue();
      if (current !== amlText) {
        applying.current = true;
        const model = ed.getModel();
        if (model) {
          ed.executeEdits("store", [{ range: model.getFullModelRange(), text: amlText }]);
        }
        applying.current = false;
      }
    }
    const model = ed.getModel();
    if (model) {
      monaco.editor.setModelMarkers(
        model,
        "aml",
        parseErrors.map((e) => ({
          startLineNumber: e.line,
          startColumn: e.column,
          endLineNumber: e.line,
          endColumn: e.column + 2,
          message: e.message,
          severity:
            e.severity === "error"
              ? monaco.MarkerSeverity.Error
              : monaco.MarkerSeverity.Warning,
        })),
      );
    }
  }, [amlText, textVersion, lastEditSource, parseErrors]);

  return (
    <Editor
      language="aml"
      theme={theme === "light" ? "vs" : "vs-dark"}
      defaultValue={amlText}
      onMount={onMount}
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        fontFamily: "IBM Plex Mono, monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        readOnly: readOnly || viewMode === "compare",
        wordWrap: "on",
      }}
    />
  );
}
