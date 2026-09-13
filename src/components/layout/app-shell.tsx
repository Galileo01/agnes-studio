import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { KeyDialog } from "@/components/key-dialog";
import { getApiKey } from "@/lib/storage";

export function AppShell() {
  const [keyOpen, setKeyOpen] = useState(false);
  const [hasKey, setHasKey] = useState(Boolean(getApiKey()));
  const [dark, setDark] = useState(() => localStorage.getItem("agnes-studio:theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("agnes-studio:theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const sync = () => setHasKey(Boolean(getApiKey()));
    window.addEventListener("agnes:key-change", sync);
    return () => window.removeEventListener("agnes:key-change", sync);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#1f1f1d] dark:bg-[#1d1d1b] dark:text-neutral-100">
      <Outlet context={{ openKeyDialog: () => setKeyOpen(true), hasKey, dark, setDark }} />
      <KeyDialog open={keyOpen} onOpenChange={setKeyOpen} />
    </div>
  );
}
