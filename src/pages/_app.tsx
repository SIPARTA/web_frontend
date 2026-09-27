import "@/styles/globals.css";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";

const Web3Provider = dynamic(() => import("../components/Web3Provider"), { ssr: false });

const WEB3_ROUTES = new Set(["/blockchain"]);
const themeKey = "siparta_theme";

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
    <path d="M21 12.79A9 9 0 0111.21 3 7 7 0 0012 21a9 9 0 009-8.21z" />
  </svg>
);

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(themeKey, theme);
  }, [theme]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const stored = window.localStorage.getItem(themeKey);
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
      }
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const content = (
    <>
      <button type="button" onClick={toggleTheme} className="theme-toggle">
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  );

  return <Web3Provider>{content}</Web3Provider>;
}
