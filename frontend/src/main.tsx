import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { CustomersProvider } from "./context/CustomersContext";
import { ProductsProvider } from "./context/ProductsContext";
import { SalesProvider } from "./context/SalesContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ProductsProvider>
        <CustomersProvider>
          <SalesProvider>
            <App />
          </SalesProvider>
        </CustomersProvider>
      </ProductsProvider>
    </BrowserRouter>
  </StrictMode>,
);
