import { ThemeProvider } from "./components/ThemeProvider";
import { DatabaseSchema } from "./pages/DatabaseSchema";

export default function App() {
  return (
    <ThemeProvider storageKey="lq-docs-theme">
      <DatabaseSchema />
    </ThemeProvider>
  );
}
