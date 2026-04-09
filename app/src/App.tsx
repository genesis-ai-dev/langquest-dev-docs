import { useEffect, useState } from "react";
import { ThemeProvider } from "./components/ThemeProvider";
import { DatabaseSchema } from "./pages/DatabaseSchema";
import { MigrationProcess } from "./pages/MigrationProcess";
import { CicdPipeline } from "./pages/CicdPipeline";
import { DataSyncFlow } from "./pages/DataSyncFlow";

type Page = "schema" | "migration" | "cicd" | "sync";

function getPage(): Page {
  const h = window.location.hash;
  if (h === "#migration") return "migration";
  if (h === "#cicd") return "cicd";
  if (h === "#sync") return "sync";
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
      ) : (
        <DatabaseSchema />
      )}
    </ThemeProvider>
  );
}
