import { AppSidebar } from "@/features/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SessionGuard } from "./session-guard";

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <SessionGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 items-center px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-4">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </SessionGuard>
  );
}
