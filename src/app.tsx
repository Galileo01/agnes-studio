import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";

const ChatPage = lazy(() => import("@/pages/chat").then((module) => ({ default: module.ChatPage })));

function Loading() { return <div className="flex min-h-screen items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" /></div>; }

export function App() {
  return <BrowserRouter><Suspense fallback={<Loading />}><Routes><Route element={<AppShell />}><Route index element={<ChatPage />} /><Route path="chat" element={<ChatPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></Suspense></BrowserRouter>;
}
