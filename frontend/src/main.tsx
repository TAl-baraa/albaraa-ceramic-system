import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { CustomersProvider } from "./context/CustomersContext";
import { ProductsProvider } from "./context/ProductsContext";
import { SalesProvider } from "./context/SalesContext";
import "./index.css";
import { ApiStartupGate } from "./components/system/ApiStartupGate";
import { BusinessDataGate } from "./components/system/BusinessDataGate";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ApiStartupGate><ProductsProvider>
        <CustomersProvider>
          <SalesProvider>
            <BusinessDataGate><App /></BusinessDataGate>
          </SalesProvider>
        </CustomersProvider>
      </ProductsProvider></ApiStartupGate>
    </BrowserRouter>
  </StrictMode>,
);
