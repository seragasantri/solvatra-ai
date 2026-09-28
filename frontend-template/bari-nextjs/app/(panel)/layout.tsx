// bari-nextjs :: shell panel (App Router group route (panel))
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/app-sidebar";
import { PanelHeader } from "@/components/panel-header";

// Ganti dengan konfigurasi nav program-mu (atau muat dari server/permission).
const NAV = [
  { title: "Dashboard", url: "/dashboard" },
  {
    title: "Master Data",
    url: "#",
    items: [
      { title: "Pengguna", url: "/users" },
      { title: "Peran", url: "/roles" },
    ],
  },
  { title: "Laporan", url: "/laporan" },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar nav={NAV} user={{ name: "User", email: "user@example.com" }} />
          <SidebarInset>
            <PanelHeader />
            {/* min-w-0: konten selebar apa pun tak melebarkan <main> */}
            <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
