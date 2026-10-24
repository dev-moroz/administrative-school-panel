import { AppSidebar } from "@/features/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SessionGuard } from "./session-guard";

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <SessionGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* TODO: temporary for the MVP, the sidebar is always open. Rework the page template (title and controls layout)
              and bring the toggle back (import SidebarTrigger) so the sidebar can be opened on mobile. */}
          {/* <header className="flex h-12 items-center px-4">
            <SidebarTrigger />
          </header> */}
          <main className="flex-1 p-4">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </SessionGuard>
  );
}
