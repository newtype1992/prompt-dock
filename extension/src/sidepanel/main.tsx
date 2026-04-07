import { createRoot } from "react-dom/client";
import App from "../popup/popup-app";
import "../popup/popup.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Prompt Dock side panel root element is missing.");
}

createRoot(rootElement).render(<App />);
