import type { ReactNode } from "react";

// Empty and error states fill the free page height and sit in the middle, like on the students page.
export function PageMessage({ children, role }: { children: ReactNode; role?: "alert" }) {
  return (
    <div role={role} className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      {children}
    </div>
  );
}
