"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMe } from "@/features/auth";
import { useViewMode } from "@/hooks/use-view-mode";
import { useDebouncedValue } from "@/features/students/model/use-debounced-value";
import { useStudents } from "@/features/students/model/use-students";
import { StudentsGrid } from "@/features/students/ui/students-grid";
import { StudentSheet, type SheetTarget } from "@/features/students/ui/student-sheet";
import { StudentsPagination } from "@/features/students/ui/students-pagination";
import { StudentsToolbar, type StatusFilter } from "@/features/students/ui/students-toolbar";

const PAGE_SIZE = 12;
const IS_ACTIVE: Record<StatusFilter, boolean | undefined> = { active: true, inactive: false, all: undefined };

export default function StudentsPage() {
  const t = useTranslations("Students");
  const { data: me } = useMe();
  const [view, setView] = useViewMode("students.view");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [target, setTarget] = useState<SheetTarget>({ kind: "closed" });
  const search = useDebouncedValue(searchInput, 300);

  // The page belongs to the filters it was chosen under; a new search or status falls back to page 1.
  const filterKey = `${search}|${status}`;
  const [pageState, setPageState] = useState({ page: 1, filterKey });
  const page = pageState.filterKey === filterKey ? pageState.page : 1;

  const students = useStudents({ q: search, page, pageSize: PAGE_SIZE, isActive: IS_ACTIVE[status] });
  const totalPages = Math.max(1, Math.ceil((students.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <StudentsToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        status={status}
        onStatusChange={setStatus}
        view={view}
        onViewChange={setView}
        canCreate={!!me?.permissions.includes("students.create")}
        onCreate={() => setTarget({ kind: "create" })}
      />
      <StudentsGrid
        view={view}
        students={students.data?.items}
        isLoading={students.isLoading}
        isError={students.isError}
        onRetry={() => students.refetch()}
        onSelect={(id) => setTarget({ kind: "view", id })}
      />
      {!!students.data?.total && (
        <StudentsPagination
          page={page}
          totalPages={totalPages}
          onPageChange={(next) => setPageState({ page: next, filterKey })}
        />
      )}
      <StudentSheet target={target} onTargetChange={setTarget} />
    </div>
  );
}
