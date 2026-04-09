import { useEffect, useState } from "react";
import { ThemeProvider } from "./components/ThemeProvider";
import { DatabaseSchema } from "./pages/DatabaseSchema";
import { MigrationProcess } from "./pages/MigrationProcess";

type Page = "schema" | "migration";

function getPage(): Page {
  return window.location.hash === "#migration" ? "migration" : "schema";
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
      {page === "migration" ? <MigrationProcess /> : <DatabaseSchema />}
    </ThemeProvider>
  );
}
