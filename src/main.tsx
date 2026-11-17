import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./global.css";

// A deploy replaces every hashed chunk, so a tab opened before it fails to load lazy routes.
// Reload once to pick up the new build; the timestamp stops a loop when the chunk is truly missing.
const chunkReloadKey = "narackrock.chunk-reload-at";
window.addEventListener("vite:preloadError", () => {
  const last = Number(sessionStorage.getItem(chunkReloadKey) ?? 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem(chunkReloadKey, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
