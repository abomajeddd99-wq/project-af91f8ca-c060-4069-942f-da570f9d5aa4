import { createElement, type ComponentType } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  createPortfolioPdf: vi.fn(),
  downloadBlob: vi.fn(),
  upsert: vi.fn(),
  toastError: vi.fn(),
  data: {
    standards: [] as Array<Record<string, unknown>>,
    progress: [] as Array<Record<string, unknown>>,
    evidences: [] as Array<Record<string, unknown>>,
    profile: {} as Record<string, unknown>,
  },
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: Record<string, unknown>) => ({
      options,
      useRouteContext: () => ({ user: { id: "qa-teacher" } }),
      useParams: () => ({ standardId: "standard-1" }),
    }),
    Link: ({
      to,
      children,
      ...props
    }: {
      to?: unknown;
      children: unknown;
      [key: string]: unknown;
    }) =>
      React.createElement(
        "a",
        { href: typeof to === "string" ? to : "#", ...props },
        children as React.ReactNode,
      ),
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useSuspenseQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: fixture.data[queryKey[0] as keyof typeof fixture.data],
  }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: fixture.data[queryKey[0] as keyof typeof fixture.data],
    isLoading: false,
    isPending: false,
    refetch: async () => ({ data: [], error: null }),
  }),
}));

vi.mock("@/lib/queries", () => ({
  standardsQuery: () => ({ queryKey: ["standards"] }),
  allStandardsQuery: () => ({ queryKey: ["standards"] }),
  progressQuery: () => ({ queryKey: ["progress"] }),
  evidencesQuery: () => ({ queryKey: ["evidences"] }),
  profileQuery: () => ({ queryKey: ["profile"] }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ upsert: fixture.upsert }),
    storage: { from: () => ({ createSignedUrls: vi.fn(), download: vi.fn() }) },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: fixture.toastError, success: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/portfolio-export", () => ({
  createPortfolioPdf: fixture.createPortfolioPdf,
}));
vi.mock("@/components/portfolio/PortfolioA4Preview", () => ({
  PortfolioA4Preview: () => null,
}));

vi.mock("@/lib/download", () => ({
  downloadBlob: fixture.downloadBlob,
}));

import { Route as DashboardRoute } from "@/routes/_authenticated/dashboard";
import { Route as PortfolioRoute } from "@/routes/_authenticated/portfolio";
import { Route as StandardDetailRoute } from "@/routes/_authenticated/standards.$standardId";

function standardsFixture(count = 11) {
  return Array.from({ length: count }, (_, index) => ({
    id: `standard-${index + 1}`,
    code: `S${index + 1}`,
    title: `Standard ${index + 1}`,
    description: `Description ${index + 1}`,
    indicators: [`Indicator ${index + 1}`],
    weight: 1,
    sort_order: index + 1,
    is_placeholder: false,
  }));
}

function routeComponent(
  route: typeof DashboardRoute | typeof PortfolioRoute | typeof StandardDetailRoute,
) {
  return (route.options as { component: ComponentType }).component;
}

describe("teacher dashboard and portfolio with mocked query data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fixture.upsert.mockResolvedValue({ error: null });
    fixture.createPortfolioPdf.mockResolvedValue({
      bytes: new Uint8Array([1]),
      warnings: [],
      pageCount: 3,
    });
    fixture.data = {
      standards: standardsFixture(),
      progress: [],
      evidences: [],
      profile: {
        full_name: "Synthetic Teacher",
        school: "Test School",
        subject: "Test Subject",
        onboarding_completed_at: "2026-01-01",
      },
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the 11-standard dashboard total and its four-card next preview", () => {
    render(createElement(routeComponent(DashboardRoute)));

    expect(
      screen.getByText((_, element) => element?.textContent?.replace(/\s/g, "") === "0/11"),
    ).toBeInTheDocument();
    expect(screen.getByText("Standard 1")).toBeInTheDocument();
    expect(screen.getByText("Standard 4")).toBeInTheDocument();
    expect(screen.queryByText("Standard 5")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "كل المعايير" })).toHaveAttribute("href", "/standards");
  });

  it("shows manual completion separately from evidence coverage", () => {
    fixture.data.progress = [{ standard_id: "standard-1", status: "completed" }];
    fixture.data.evidences = [{ standard_id: "standard-2" }];
    render(createElement(routeComponent(DashboardRoute)));

    expect(screen.getByText("المعايير التي حدّدت اكتمالها")).toBeInTheDocument();
    expect(screen.getByText(/تغطية الشواهد: 1 من 11 معيار/)).toBeInTheDocument();
    expect(screen.getByText("مكتمل يدويًا")).toBeInTheDocument();
  });

  it("saves teacher-selected status explicitly and reports failed saves", async () => {
    fixture.upsert.mockResolvedValue({ error: new Error("synthetic save failure") });
    render(createElement(routeComponent(StandardDetailRoute)));

    fireEvent.click(screen.getByRole("radio", { name: "مكتمل" }));
    await waitFor(() => expect(fixture.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ standard_id: "standard-1", status: "completed" }),
      { onConflict: "user_id,standard_id" },
    ));
    await waitFor(() => expect(fixture.toastError).toHaveBeenCalledWith("تعذر الحفظ."));
    expect(screen.getByRole("radio", { name: "لم يبدأ" })).toBeEnabled();
  });

  it("persists a teacher-selected status without depending on evidence", async () => {
    fixture.data.evidences = [];
    render(createElement(routeComponent(StandardDetailRoute)));

    fireEvent.click(screen.getByRole("radio", { name: "مكتمل" }));
    await waitFor(() => expect(fixture.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ standard_id: "standard-1", status: "completed" }),
      { onConflict: "user_id,standard_id" },
    ));
    expect(fixture.toastError).not.toHaveBeenCalled();
  });

  it("renders all 11 standards and downloads the generated portfolio PDF", async () => {
    render(createElement(routeComponent(PortfolioRoute)));

    expect(screen.getAllByRole("row")).toHaveLength(12);
    expect(screen.getAllByText("Standard 11")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /تنزيل ملف PDF/ }));
    await waitFor(() => expect(fixture.createPortfolioPdf).toHaveBeenCalledOnce());
    expect(fixture.downloadBlob).toHaveBeenCalledOnce();
    expect(fixture.createPortfolioPdf.mock.calls[0]![0].evidenceLayout.defaultItemsPerPage).toBe(2);
  });

  it("exports global and per-standard choices and keeps preferences browser-local", async () => {
    render(createElement(routeComponent(PortfolioRoute)));
    fireEvent.click(screen.getByRole("button", { name: /أربعة عناصر/ }));
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /تنزيل ملف PDF/ }));
    await waitFor(() => expect(fixture.createPortfolioPdf).toHaveBeenCalledOnce());
    expect(fixture.createPortfolioPdf.mock.calls[0]![0].evidenceLayout)
      .toEqual({ defaultItemsPerPage: 4, byStandard: { "standard-1": 1 } });
    expect(JSON.parse(localStorage.getItem("injazi:portfolio-layout:qa-teacher")!))
      .toEqual({ defaultItemsPerPage: 4, byStandard: { "standard-1": 1 } });
    expect(fixture.upsert).not.toHaveBeenCalled();
    cleanup();
    render(createElement(routeComponent(PortfolioRoute)));
    await waitFor(() => expect(screen.getByRole("button", { name: /أربعة عناصر/ })).toHaveAttribute("aria-pressed", "true"));
  });
});
