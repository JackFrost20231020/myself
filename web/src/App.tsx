import { Route, Routes } from "react-router";
import type { Content } from "../content/schema.ts";
import { Layout } from "./components/Layout.tsx";
import { todayInShanghai } from "./lib/dates.ts";
import { AboutPage } from "./pages/AboutPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";

// today 可以从外面传进来，测试时用固定日期
export function App({ content, today = todayInShanghai() }: { content: Content; today?: string }) {
  return (
    <Routes>
      <Route element={<Layout content={content} />}>
        <Route index element={<HomePage content={content} today={today} />} />
        <Route path="about" element={<AboutPage about={content.about} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
