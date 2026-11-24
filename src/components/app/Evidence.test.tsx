import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EvidenceCard, EvidenceUploader } from "./Evidence";
import type { Evidence, Standard } from "@/lib/queries";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
  createSignedUrl: vi.fn(),
  storageFrom: vi.fn(),
  from: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  queryResult: null as unknown,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: (...args: unknown[]) => mocks.storageFrom(...args) },
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess, warning: mocks.toastWarning },
}));

function renderUploader() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EvidenceUploader userId="qa-teacher-a" standardId="standard-1" indicators={["بند المتابعة الأول", "بند المتابعة الثاني"]} />
    </QueryClientProvider>,
  );
}

const standards = [
  { id: "standard-1", code: "S1", title: "المعيار الأول", indicators: ["بند المتابعة الأول", "بند المتابعة الثاني"] },
  { id: "standard-2", code: "S2", title: "المعيار الثاني", indicators: ["بند آخر"] },
] as Standard[];
const currentStandard = standards[0]!;

function evidenceFixture(): Evidence {
  return {
    id: "evidence-1",
    user_id: "qa-teacher-a",
    standard_id: "standard-1",
    indicator_index: null,
    indicator_text: null,
    title: "شاهد تجريبي",
    description: "وصف تجريبي",
    evidence_date: "2026-01-15",
    file_path: "qa-teacher-a/original.png",
    file_name: "original.png",
    mime_type: "image/png",
    file_size: 8,
    created_at: "2026-01-15T00:00:00.000Z",
  } as Evidence;
}

function renderCard(evidence = evidenceFixture()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EvidenceCard evidence={evidence} standards={standards} currentStandard={currentStandard} />
    </QueryClientProvider>,
  );
}

function selectFile(container: HTMLElement, file: File) {
  const input =
    container.querySelector<HTMLInputElement>('input[type="file"]') ??
    document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Expected the evidence file input");
  fireEvent.change(input, { target: { files: [file] } });
}

describe("evidence uploader with mocked Supabase calls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.queryResult = { data: { id: "evidence-1" }, error: null };
    mocks.remove.mockResolvedValue({ error: null });
    mocks.download.mockResolvedValue({ data: new Blob(["synthetic"]), error: null });
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://example.invalid/signed" }, error: null });
    mocks.storageFrom.mockReturnValue({
      upload: mocks.upload,
      remove: mocks.remove,
      download: mocks.download,
      createSignedUrl: mocks.createSignedUrl,
    });
    const queryBuilder: any = {};
    queryBuilder.insert = mocks.insert.mockImplementation(() => queryBuilder);
    queryBuilder.update = mocks.update.mockImplementation(() => queryBuilder);
    queryBuilder.delete = mocks.delete.mockImplementation(() => queryBuilder);
    queryBuilder.upsert = mocks.upsert.mockImplementation(() => queryBuilder);
    queryBuilder.eq = mocks.eq.mockImplementation(() => queryBuilder);
    queryBuilder.select = mocks.select.mockImplementation(() => queryBuilder);
    queryBuilder.maybeSingle = mocks.maybeSingle.mockImplementation(() => Promise.resolve(mocks.queryResult));
    queryBuilder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(mocks.queryResult).then(resolve, reject);
    mocks.from.mockReturnValue(queryBuilder);
  });

  it("rejects unsupported files before making any storage or database call", () => {
    const { container } = renderUploader();
    selectFile(container, new File(["not an image"], "unsafe.txt", { type: "text/plain" }));

    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("links a valid upload to the selected teacher and standard using mocks", async () => {
    const { container } = renderUploader();
    selectFile(container, new File(["synthetic"], "sample.png", { type: "image/png" }));
    fireEvent.change(screen.getByLabelText("بند المتابعة المرتبط بهذا الشاهد"), { target: { value: "0" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledOnce());
    expect(mocks.storageFrom).toHaveBeenCalledWith("evidence");
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^qa-teacher-a\/.+\.png$/),
      expect.any(File),
      { contentType: "image/png", upsert: false },
    );
    expect(mocks.from).toHaveBeenCalledWith("evidences");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "qa-teacher-a",
        standard_id: "standard-1",
        mime_type: "image/png",
        file_name: "sample.png",
      }),
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("persists the selected follow-up item with the evidence record", async () => {
    const { container } = renderUploader();
    selectFile(container, new File(["synthetic"], "sample.png", { type: "image/png" }));
    fireEvent.change(screen.getByLabelText("بند المتابعة المرتبط بهذا الشاهد"), { target: { value: "1" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledOnce());
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      standard_id: "standard-1",
      indicator_index: 1,
      indicator_text: "بند المتابعة الثاني",
    }));
  });

  it("removes the mocked storage object when saving its evidence row fails", async () => {
    mocks.queryResult = { data: null, error: new Error("simulated insert failure") };
    const { container } = renderUploader();
    selectFile(container, new File(["synthetic"], "sample.png", { type: "image/png" }));
    fireEvent.change(screen.getByLabelText("بند المتابعة المرتبط بهذا الشاهد"), { target: { value: "0" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledOnce());
    expect(mocks.remove).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringMatching(/^qa-teacher-a\/.+\.png$/)]),
    );
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it("safely relinks evidence and updates metadata without touching progress", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "تعديل" }));
    fireEvent.change(screen.getByLabelText("المعيار المرتبط بالشاهد"), {
      target: { value: "standard-2" },
    });
    fireEvent.change(screen.getByLabelText("عنوان الشاهد"), { target: { value: "عنوان محدث" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        standard_id: "standard-2",
        title: "عنوان محدث",
      }),
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("allows an existing evidence record to be linked to an individual item", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "تعديل" }));
    fireEvent.change(screen.getByLabelText("بند المتابعة المرتبط بالشاهد"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      indicator_index: 1,
      indicator_text: "بند المتابعة الثاني",
    }));
  });

  it("keeps the original evidence association when relinking fails", async () => {
    mocks.queryResult = { data: null, error: new Error("synthetic update failure") };
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "تعديل" }));
    fireEvent.change(screen.getByLabelText("المعيار المرتبط بالشاهد"), {
      target: { value: "standard-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("تعذر حفظ التعديلات."));
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("replaces a file only after the new upload is saved", async () => {
    const { container } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "تعديل" }));
    fireEvent.click(screen.getByRole("button", { name: "استبدال الملف" }));
    selectFile(container, new File(["synthetic pdf"], "replacement.pdf", { type: "application/pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(["qa-teacher-a/original.png"]));
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^qa-teacher-a\/.+\.pdf$/),
      expect.any(File),
      { contentType: "application/pdf", upsert: false },
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ file_name: "replacement.pdf", mime_type: "application/pdf" }),
    );
  });

  it("warns when a saved replacement cannot clean up the old private file", async () => {
    mocks.remove.mockResolvedValue({ data: null, error: new Error("synthetic cleanup failure") });
    const { container } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "تعديل" }));
    fireEvent.click(screen.getByRole("button", { name: "استبدال الملف" }));
    selectFile(container, new File(["replacement"], "replacement.png", { type: "image/png" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("deletes storage before the row and restores the file when row deletion fails", async () => {
    mocks.queryResult = { data: null, error: new Error("synthetic database failure") };
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "حذف الشاهد" }));
    const alert = screen.getByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "حذف" }));

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith(
      "qa-teacher-a/original.png",
      expect.any(Blob),
      { contentType: "image/png", upsert: true },
    ));
    expect(mocks.download).toHaveBeenCalledWith("qa-teacher-a/original.png");
    expect(mocks.remove).toHaveBeenCalledWith(["qa-teacher-a/original.png"]);
    expect(mocks.toastError).toHaveBeenCalledWith("تعذر حذف سجل الشاهد؛ تمت استعادة الملف الأصلي.");
  });

  it("deletes the row only after a successful backup and storage removal", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "حذف الشاهد" }));
    const alert = screen.getByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "حذف" }));

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("تم حذف الشاهد وملفه."));
    expect(mocks.download).toHaveBeenCalledWith("qa-teacher-a/original.png");
    expect(mocks.remove).toHaveBeenCalledWith(["qa-teacher-a/original.png"]);
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.download.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]!);
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.delete.mock.invocationCallOrder[0]!);
  });

  it("keeps both the evidence row and file when its backup cannot be read", async () => {
    mocks.download.mockResolvedValue({ data: null, error: new Error("synthetic download failure") });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "حذف الشاهد" }));
    const alert = screen.getByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "حذف" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(
      "تعذر تأمين نسخة احتياطية للملف؛ لم يتم حذف الشاهد.",
    ));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
