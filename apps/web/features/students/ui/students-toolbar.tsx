import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ViewToggle } from "@/components/view-toggle";
import type { ViewMode } from "@/hooks/use-view-mode";

export type StatusFilter = "active" | "inactive" | "all";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  view: ViewMode;
  onViewChange: (value: ViewMode) => void;
  canCreate: boolean;
  onCreate: () => void;
};

export function StudentsToolbar(props: Props) {
  const t = useTranslations("Students");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="search"
        className="w-full sm:max-w-xs"
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchLabel")}
        value={props.search}
        onChange={(e) => props.onSearchChange(e.target.value)}
      />
      <ToggleGroup
        type="single"
        variant="outline"
        value={props.status}
        onValueChange={(next) => next && props.onStatusChange(next as StatusFilter)}
      >
        <ToggleGroupItem value="active">{t("statusActive")}</ToggleGroupItem>
        <ToggleGroupItem value="inactive">{t("statusInactive")}</ToggleGroupItem>
        <ToggleGroupItem value="all">{t("statusAll")}</ToggleGroupItem>
      </ToggleGroup>
      <ViewToggle value={props.view} onChange={props.onViewChange} />
      {props.canCreate && (
        <Button className="ml-auto" onClick={props.onCreate}>
          {t("newStudent")}
        </Button>
      )}
    </div>
  );
}
