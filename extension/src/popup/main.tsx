import { createRoot } from "react-dom/client";
import App from "./popup-app";
import "./popup.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Prompt Dock popup root element is missing.");
}

createRoot(rootElement).render(<App />);

