import "./globals.css";
import { Demo } from "@/components/Demo";
import { AppShell } from "@/components/AppShell";

export const metadata = {
  title: "WMS Expert",
  description: "WMS Expert • Telecom",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Demo>
          <AppShell>{children}</AppShell>
        </Demo>
      </body>
    </html>
  );
}