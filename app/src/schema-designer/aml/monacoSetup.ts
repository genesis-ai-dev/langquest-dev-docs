import { monaco as amlMonaco } from "@azimutt/aml";

type MonacoNs = typeof import("monaco-editor");

let registered = false;

export function registerAmlLanguage(monaco: MonacoNs): void {
  if (registered) return;
  registered = true;
  monaco.languages.register({ id: "aml" });
  monaco.languages.setMonarchTokensProvider("aml", amlMonaco.language() as never);
  monaco.languages.registerCompletionItemProvider("aml", amlMonaco.completion() as never);
  monaco.languages.registerCodeActionProvider("aml", amlMonaco.codeAction() as never);
  monaco.languages.registerCodeLensProvider("aml", amlMonaco.codeLens() as never);
}
