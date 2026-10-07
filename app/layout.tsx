import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bancada NFS-e",
  description: "Laboratório de estudo para emissão simulada de NFS-e. Sem valor fiscal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
