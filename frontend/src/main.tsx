import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/noto-naskh-arabic/wght.css";

import App from "./App";
import "./index.css";
import { ApiStartupGate } from "./components/system/ApiStartupGate";
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ApiStartupGate><AuthProvider><App /></AuthProvider></ApiStartupGate>
    </BrowserRouter>
  </StrictMode>,
);
