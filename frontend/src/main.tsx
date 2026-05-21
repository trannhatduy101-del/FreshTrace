import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
// IMPORTANT: initialise Web3Modal BEFORE rendering any component that uses
// its hooks. Calling the function explicitly (rather than relying on a
// side-effect import) guarantees the bundler cannot tree-shake it away.
import { initWeb3Modal } from "./config/web3modal";
import { I18nProvider } from "./i18n/I18nContext";

initWeb3Modal();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
