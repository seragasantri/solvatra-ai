"use client";
// bari-nextjs :: header sticky blur
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";

export function PanelHeader({ title = "Dashboard" }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 overflow-hidden border-b border-border/60 bg-background/70 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      {/* garis cahaya berjalan di tepi bawah */}
      <div className="shell-sweep pointer-events-none absolute inset-x-0 bottom-0 h-px" aria-hidden />
      <div className="flex min-w-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1 transition-colors hover:text-primary" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 px-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
