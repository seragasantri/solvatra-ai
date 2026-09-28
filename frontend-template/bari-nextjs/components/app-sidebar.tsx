"use client";
// bari-nextjs :: sidebar shadcn (dark rail, collapsible=icon)
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
  SidebarMenuSubItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, LayoutDashboard, Database, FileText } from "lucide-react";

type NavItem = { title: string; url: string; items?: { title: string; url: string }[] };
const ICONS: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard />, "Master Data": <Database />, Laporan: <FileText />,
};
const active = (path: string, url: string) => url !== "#" && (path === url || path.startsWith(url + "/"));

export function AppSidebar({ nav, user }: { nav: NavItem[]; user: { name: string; email: string } }) {
  const { state } = useSidebar();
  const path = usePathname() ?? "";
  const expanded = state === "expanded";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="relative overflow-hidden border-b border-sidebar-border/60">
        {/* garis cahaya berjalan */}
        <div className="shell-sweep pointer-events-none absolute inset-x-0 bottom-0 h-px" aria-hidden />
        <Link href="/dashboard" className="group flex items-center gap-2.5 px-1 py-1.5">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary/20">
            <span className="absolute inset-0 rounded-xl bg-sidebar-primary/30 blur-md opacity-60 transition-opacity group-hover:opacity-100" aria-hidden />
            <span className="relative font-black text-sidebar-primary">B</span>
          </span>
          {expanded && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate bg-linear-to-r from-sidebar-foreground to-sidebar-primary bg-clip-text text-base font-bold text-transparent">APP</span>
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/50">Panel Admin</span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="px-2">
          {nav.map((entry) =>
            entry.items ? (
              <Collapsible key={entry.title} asChild defaultOpen={entry.items.some((i) => active(path, i.url))} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={entry.title}>
                      {ICONS[entry.title]}<span>{entry.title}</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {entry.items.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton asChild isActive={active(path, sub.url)}>
                            <Link href={sub.url}>{sub.title}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              <SidebarMenuItem key={entry.title}>
                <SidebarMenuButton asChild tooltip={entry.title} isActive={active(path, entry.url)}>
                  <Link href={entry.url}>{ICONS[entry.title]}<span>{entry.title}</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="grid size-8 place-items-center rounded-lg bg-sidebar-primary/20 font-bold text-sidebar-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          {expanded && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
              <p className="truncate font-mono text-[10px] text-sidebar-foreground/50">{user.email}</p>
            </div>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
