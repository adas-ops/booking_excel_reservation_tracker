<<<<<<< HEAD
"use client";
import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");
    document.documentElement.className = theme;
    document.documentElement.style.colorScheme = theme;
  }, []);
  return <>{children}</>;
=======
"use client"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
>>>>>>> fa34384e1cef5292bbb0845ec029f08b83676c9b
}
