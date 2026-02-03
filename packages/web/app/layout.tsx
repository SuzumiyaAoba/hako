import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Hako Web",
  description: "Hako web UI",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="ja">
      <body className="bg-white text-slate-900">{children}</body>
    </html>
  );
}
