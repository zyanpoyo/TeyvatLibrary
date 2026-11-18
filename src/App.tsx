import { useEffect, useMemo } from "react";
import { RouterProvider } from "react-router";
import { createAppRouter, normalizeLegacyHash } from "./router/routes";

export function App() {
  const router = useMemo(() => createAppRouter(), []);

  useEffect(() => {
    const handleHashChange = () => normalizeLegacyHash();
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return <RouterProvider router={router} />;
}
