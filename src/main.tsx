import { applyInitialTheme } from "./components/ThemeToggle";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { UnlockPage } from "./pages/UnlockPage";
import "./styles.css";
applyInitialTheme();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UnlockPage />
  </StrictMode>,
);
