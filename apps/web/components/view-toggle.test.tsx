import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ViewToggle } from "./view-toggle";

describe("ViewToggle", () => {
  it("marks the current view as selected", () => {
    renderWithProviders(<ViewToggle value="list" onChange={() => {}} />);
    expect(screen.getByLabelText("List")).toHaveAttribute("data-state", "on");
    expect(screen.getByLabelText("Cards")).toHaveAttribute("data-state", "off");
  });

  it("calls onChange with the chosen view", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ViewToggle value="cards" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("List"));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("does not call onChange with an empty value when the active item is clicked again", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ViewToggle value="cards" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Cards"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
