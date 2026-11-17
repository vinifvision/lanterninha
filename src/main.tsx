import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { cloud } from "./lib/cloud";
import { setupNative } from "./native";
import "./styles/app.css";

cloud.init();
setupNative();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
