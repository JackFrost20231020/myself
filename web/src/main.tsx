import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App.tsx";
import { content } from "./content.ts";
import { loadHandFont } from "./fonts.ts";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <App content={content} />
      </BrowserRouter>
    </StrictMode>,
  );
}
loadHandFont();
