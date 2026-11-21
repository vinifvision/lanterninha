import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { cloud } from "./lib/cloud";
import { setupNative } from "./native";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./styles/app.css";
import './styles/v2-avaliar.css';
import './styles/v2-voce.css';
import './styles/v2-inicio.css';
import './styles/v2-descobrir.css';
import './styles/v2-boasvindas.css';
import './styles/v2-novidades.css';
import './styles/v2-pessoa.css';

cloud.init();
setupNative();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
