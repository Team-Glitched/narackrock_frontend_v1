import { useEffect, type ReactNode } from "react";
import { Link, Route, Routes } from "react-router";
import App from "./App";
import PreviewPage from "./preview/PreviewPage";
import PrivacyPage from "./privacy/PrivacyPage";

function RoutePage({
  title = "Narackrock — Make it heard",
  description = "함께 만들고 발견하는 음악 커뮤니티 Narackrock",
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);

  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoutePage><App /></RoutePage>} />
      <Route path="/preview" element={<RoutePage><PreviewPage /></RoutePage>} />
      <Route path="/privacy" element={
        <RoutePage
          title="개인정보처리방침 | Narackrock"
          description="Narackrock 서비스의 개인정보 처리 기준을 안내합니다."
        >
          <PrivacyPage />
        </RoutePage>
      } />
      <Route path="*" element={
        <RoutePage title="페이지를 찾을 수 없습니다 | Narackrock">
          <main>
            <h1>페이지를 찾을 수 없습니다.</h1>
            <Link to="/">홈으로 돌아가기</Link>
          </main>
        </RoutePage>
      } />
    </Routes>
  );
}
