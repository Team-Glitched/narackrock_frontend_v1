import { createRoot } from "react-dom/client";
import App from "./app/App";
import PreviewPage from "./app/preview/PreviewPage";
import PrivacyPage from "./app/privacy/PrivacyPage";
import "./app/globals.css";
import "./app/composition-team.css";
import "./app/design-system.css";
import "./app/v3.css";
import "./app/readability.css";
import "./app/usability.css";
import "./app/button-typography.css";
import "./app/reference-palette.css";
import "./app/typography.css";

const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

function renderPage() {
  if (pathname === "/") return <App />;
  if (pathname === "/preview") return <PreviewPage />;
  if (pathname === "/privacy") {
    document.title = "개인정보처리방침 | Narackrock";
    document.querySelector('meta[name="description"]')?.setAttribute(
      "content", "Narackrock 서비스의 개인정보 처리 기준을 안내합니다.",
    );
    return <PrivacyPage />;
  }
  document.title = "페이지를 찾을 수 없습니다 | Narackrock";
  return <main><h1>페이지를 찾을 수 없습니다.</h1><a href="/">홈으로 돌아가기</a></main>;
}

createRoot(document.getElementById("root")!).render(renderPage());
