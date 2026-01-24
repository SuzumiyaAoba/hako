import type { ReactNode } from "react";

export const metadata = {
  title: "Hako Web",
  description: "Hako web UI",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
