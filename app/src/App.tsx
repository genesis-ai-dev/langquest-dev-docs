import { useEffect, useState } from "react";
import { ThemeProvider } from "./components/ThemeProvider";
import { DatabaseSchema } from "./pages/DatabaseSchema";
import { MigrationProcess } from "./pages/MigrationProcess";
import { CicdPipeline } from "./pages/CicdPipeline";
import { DataSyncFlow } from "./pages/DataSyncFlow";
import { AuthFlow } from "./pages/AuthFlow";
import { TemplateDesign } from "./pages/TemplateDesign";
import { TemplateLifecycle } from "./pages/TemplateLifecycle";
import { WorkflowBuilder } from "./pages/WorkflowBuilder";
import { CombinedSchema } from "./pages/CombinedSchema";

type Page = "schema" | "migration" | "cicd" | "sync" | "auth" | "template" | "lifecycle" | "workflow" | "combined";

function getPage(): Page {
  const h = window.location.hash;
  if (h === "#migration") return "migration";
  if (h === "#cicd") return "cicd";
  if (h === "#sync") return "sync";
  if (h === "#auth") return "auth";
  if (h === "#template") return "template";
  if (h === "#lifecycle") return "lifecycle";
  if (h === "#workflow") return "workflow";
  if (h === "#combined") return "combined";
  return "schema";
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage);

  useEffect(() => {
    const onHash = () => setPage(getPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <ThemeProvider storageKey="lq-docs-theme">
      {page === "migration" ? (
        <MigrationProcess />
      ) : page === "cicd" ? (
        <CicdPipeline />
      ) : page === "sync" ? (
        <DataSyncFlow />
      ) : page === "auth" ? (
        <AuthFlow />
      ) : page === "template" ? (
        <TemplateDesign />
      ) : page === "lifecycle" ? (
        <TemplateLifecycle />
      ) : page === "workflow" ? (
        <WorkflowBuilder />
      ) : page === "combined" ? (
        <CombinedSchema />
      ) : (
        <DatabaseSchema />
      )}
    </ThemeProvider>
  );
}
