import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
// Side-effect import: initialises Web3Modal once at app startup so its
// React hooks (useWeb3Modal*, used by our useWallet wrappers) are wired.
import "./config/web3modal";
import { I18nProvider } from "./i18n/I18nContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
