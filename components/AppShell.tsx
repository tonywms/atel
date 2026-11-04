"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Nav";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isCollector = pathname.startsWith("/coletor");

  if (isCollector) {
    return <>{children}</>;
  }

  return (
    <div className="shell">
      <Sidebar />

      <div className="work">
        <main>{children}</main>
      </div>
    </div>
  );
}