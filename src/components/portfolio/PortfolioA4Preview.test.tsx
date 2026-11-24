import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioA4Preview } from "./PortfolioA4Preview";
import { EvidenceLayoutControls } from "./EvidenceLayoutControls";
import type { PortfolioExportInput } from "@/lib/portfolio-export";

const { planner } = vi.hoisted(() => ({ planner: vi.fn() }));
vi.mock("@/lib/portfolio-export", () => ({ planPortfolioPages: planner }));
const input: PortfolioExportInput = { profile: null, standards: [], progress: [], attachments: [] };
const page = (text: string, number = 1) => ({
  kind: "generated", content: `<p>${text}</p>`, heading: undefined, images: [],
  frame: { pageNumber: number, totalPages: 2 },
});
describe("live A4 preview and teacher controls", () => {
  beforeEach(() => planner.mockReset());
  afterEach(cleanup);
  it("navigates the shared plan and recalculates immediately after a layout change", async () => {
    planner.mockResolvedValueOnce({ pages: [page("صفحة أولى"), page("صفحة ثانية", 2)], warnings: [] });
    const view = render(<PortfolioA4Preview input={input} />);
    await waitFor(() => expect(screen.getByText("صفحة أولى")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox", { name: "صفحة المعاينة" }), { target: { value: "1" } });
    expect(screen.getByText("صفحة ثانية")).toBeInTheDocument();
    const next = { ...input, evidenceLayout: { defaultItemsPerPage: 4 as const, byStandard: {} } };
    planner.mockResolvedValueOnce({ pages: [page("شبكة أربعة")], warnings: [] });
    view.rerender(<PortfolioA4Preview input={next} />);
    await waitFor(() => expect(screen.getByText("شبكة أربعة")).toBeInTheDocument());
    expect(planner).toHaveBeenLastCalledWith(next);
    expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
  });
  it("ignores stale calculations instead of showing the wrong layout", async () => {
    let resolve!: (value: unknown) => void;
    planner.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = render(<PortfolioA4Preview input={input} />);
    planner.mockResolvedValueOnce({ pages: [page("التخطيط الحالي")], warnings: [] });
    view.rerender(<PortfolioA4Preview input={{ ...input, generatedAt: new Date() }} />);
    await waitFor(() => expect(screen.getByText("التخطيط الحالي")).toBeInTheDocument());
    resolve({ pages: [page("التخطيط السابق")], warnings: [] });
    await waitFor(() => expect(screen.queryByText("التخطيط السابق")).not.toBeInTheDocument());
  });
  it("reports attachment loading and planning failures without showing stale pages", async () => {
    planner.mockRejectedValueOnce(new Error("تعذر قياس المحتوى"));
    const view = render(<PortfolioA4Preview input={input} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("تعذر قياس المحتوى"));
    view.rerender(<PortfolioA4Preview input={input} loadError />);
    expect(screen.getByRole("alert")).toHaveTextContent("تعذر تحميل بيانات المرفقات");
  });
  it("supports global choices, independent overrides, inheritance, and disabled controls", () => {
    const onChange = vi.fn();
    const props = { preferences: { defaultItemsPerPage: 2 as const, byStandard: { s1: 1 as const } }, onChange,
      standards: [{ id: "s1", code: "01", title: "المعيار الأول" }] };
    const view = render(<EvidenceLayoutControls {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /أربعة عناصر/ }));
    expect(onChange).toHaveBeenLastCalledWith({ defaultItemsPerPage: 4, byStandard: { s1: 1 } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "3" } });
    expect(onChange).toHaveBeenLastCalledWith({ defaultItemsPerPage: 2, byStandard: { s1: 3 } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "inherit" } });
    expect(onChange).toHaveBeenLastCalledWith({ defaultItemsPerPage: 2, byStandard: {} });
    view.rerender(<EvidenceLayoutControls {...props} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /أربعة عناصر/ })).toBeDisabled();
  });
});
