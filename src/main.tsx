import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Defensive null guard. The non-null assertion would crash with a
// useless "Cannot read properties of null (reading 'render')" if the
// `#root` element is ever missing — easy to introduce via an
// index.html template edit, an SSR mismatch, or a hosting platform
// that rewrites the body. Throwing a clear, named error makes the
// failure debuggable from the browser console + any error-tracking
// pipeline that later attaches.
const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error(
    '[main] Could not find #root element to mount the app. Check that index.html still contains <div id="root"></div>.',
  );
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
