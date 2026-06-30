import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/jetbrains-mono";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { ConfirmProvider } from "./components/ui/confirm";
import "./index.css";
import { queryClient } from "./lib/queryClient";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#181820",
            color: "#ededf1",
            border: "1px solid rgba(255,255,255,0.12)",
            fontFamily: "'Hanken Grotesk Variable', sans-serif",
            fontSize: "0.875rem",
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
