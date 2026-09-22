import type { Metadata } from "next";
import "./globals.css";
import "./composition-team.css";

export const metadata: Metadata = {
  title: "Adlips — Make it heard",
  description: "함께 만들고 발견하는 음악 커뮤니티 Adlips",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
