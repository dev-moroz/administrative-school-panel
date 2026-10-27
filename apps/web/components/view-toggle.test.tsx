import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LayoutGrid, List, Table2 } from "lucide-react";
import { renderWithProviders } from "@/test/render";
import { ViewToggle } from "./view-toggle";

const OPTIONS = [
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
];

describe("ViewToggle", () => {
  it("renders one button per option, labelled by the option", () => {
    renderWithProviders(<ViewToggle value="cards" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByLabelText("Cards")).toBeInTheDocument();
    expect(screen.getByLabelText("List")).toBeInTheDocument();
  });

  it("marks the current view as selected", () => {
    renderWithProviders(<ViewToggle value="list" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByLabelText("List")).toHaveAttribute("data-state", "on");
    expect(screen.getByLabelText("Cards")).toHaveAttribute("data-state", "off");
  });

  it("calls onChange with the chosen view", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ViewToggle value="cards" options={OPTIONS} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("List"));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("does not call onChange with an empty value when the active item is clicked again", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ViewToggle value="cards" options={OPTIONS} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Cards"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("works with other options", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ViewToggle
        value="feed"
        options={[
          { value: "feed", label: "Feed", icon: List },
          { value: "table", label: "Table", icon: Table2 },
        ]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByLabelText("Table"));
    expect(onChange).toHaveBeenCalledWith("table");
  });
});
