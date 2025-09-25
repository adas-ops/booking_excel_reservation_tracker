"use client";

export function ThemeToggle() {
  function toggleTheme() {
    const current = document.documentElement.className;
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.className = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("theme", next);
  }

  return (
    <button onClick={toggleTheme} style={{margin:8,padding:8}}>
      Toggle Theme
    </button>
  );
} 