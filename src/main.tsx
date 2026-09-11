import { applyInitialTheme } from "./components/ThemeToggle";
import { initializeTitleMotion } from "./components/titleMotion";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { UnlockPage } from "./pages/UnlockPage";
import "./styles.css";
applyInitialTheme();
initializeTitleMotion();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UnlockPage />
  </StrictMode>,
);
