import { describe, expect, it, vi } from "vitest";
import {
  deleteEvidenceSafely,
  EvidenceOperationError,
  replaceEvidenceFileSafely,
  saveEvidenceWithFile,
} from "./evidence-operations";

function ok(data?: unknown) {
  return { data: data ?? null, error: null };
}

function failed() {
  return { data: null, error: new Error("synthetic failure") };
}

describe("safe evidence storage/database operations", () => {
  it("removes a just-uploaded file when saving its row fails", async () => {
    const upload = vi.fn().mockResolvedValue(ok());
    const save = vi.fn().mockResolvedValue(failed());
    const removeNewFile = vi.fn().mockResolvedValue(ok());

    await expect(saveEvidenceWithFile({ upload, save, removeNewFile })).rejects.toMatchObject({
      stage: "save",
    });
    expect(upload).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
    expect(removeNewFile).toHaveBeenCalledOnce();
  });

  it("reports when an upload rollback also fails", async () => {
    const removeNewFile = vi.fn().mockResolvedValue(failed());

    await expect(
      saveEvidenceWithFile({
        upload: vi.fn().mockResolvedValue(ok()),
        save: vi.fn().mockResolvedValue(failed()),
        removeNewFile,
      }),
    ).rejects.toMatchObject({ stage: "save_cleanup" });
  });

  it("does not save or clean up when the initial upload fails", async () => {
    const save = vi.fn();
    const removeNewFile = vi.fn();

    await expect(
      saveEvidenceWithFile({
        upload: vi.fn().mockResolvedValue(failed()),
        save,
        removeNewFile,
      }),
    ).rejects.toBeInstanceOf(EvidenceOperationError);
    expect(save).not.toHaveBeenCalled();
    expect(removeNewFile).not.toHaveBeenCalled();
  });

  it("saves a replacement before cleaning up the original", async () => {
    const order: string[] = [];
    const result = await replaceEvidenceFileSafely({
      uploadNewFile: vi.fn(async () => {
        order.push("upload");
        return ok();
      }),
      saveChanges: vi.fn(async () => {
        order.push("save");
        return ok();
      }),
      removeNewFile: vi.fn(),
      removeOldFile: vi.fn(async () => {
        order.push("remove-old");
        return ok();
      }),
    });

    expect(order).toEqual(["upload", "save", "remove-old"]);
    expect(result.oldFileCleanupFailed).toBe(false);
  });

  it("keeps the replacement when cleanup of the old copy fails and reports it", async () => {
    const removeNewFile = vi.fn();
    const result = await replaceEvidenceFileSafely({
      uploadNewFile: vi.fn().mockResolvedValue(ok()),
      saveChanges: vi.fn().mockResolvedValue(ok()),
      removeNewFile,
      removeOldFile: vi.fn().mockResolvedValue(failed()),
    });

    expect(result.oldFileCleanupFailed).toBe(true);
    expect(removeNewFile).not.toHaveBeenCalled();
  });

  it("cleans up the new copy if saving replacement metadata fails", async () => {
    const removeNewFile = vi.fn().mockResolvedValue(ok());

    await expect(
      replaceEvidenceFileSafely({
        uploadNewFile: vi.fn().mockResolvedValue(ok()),
        saveChanges: vi.fn().mockResolvedValue(failed()),
        removeNewFile,
        removeOldFile: vi.fn(),
      }),
    ).rejects.toMatchObject({ stage: "replace_save" });
    expect(removeNewFile).toHaveBeenCalledOnce();
  });

  it("does not remove the file or record if a backup cannot be read", async () => {
    const removeStoredFile = vi.fn();
    const deleteRecord = vi.fn();

    await expect(
      deleteEvidenceSafely({
        downloadBackup: vi.fn().mockResolvedValue(failed()),
        removeStoredFile,
        deleteRecord,
        restoreStoredFile: vi.fn(),
      }),
    ).rejects.toMatchObject({ stage: "delete_backup" });
    expect(removeStoredFile).not.toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it("leaves the record intact if storage deletion fails", async () => {
    const deleteRecord = vi.fn();

    await expect(
      deleteEvidenceSafely({
        downloadBackup: vi.fn().mockResolvedValue(ok(new Blob(["synthetic"]))),
        removeStoredFile: vi.fn().mockResolvedValue(failed()),
        deleteRecord,
        restoreStoredFile: vi.fn(),
      }),
    ).rejects.toMatchObject({ stage: "delete_storage" });
    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it("restores the original file if deleting its database row fails", async () => {
    const backup = new Blob(["synthetic"]);
    const restoreStoredFile = vi.fn().mockResolvedValue(ok());

    await expect(
      deleteEvidenceSafely({
        downloadBackup: vi.fn().mockResolvedValue(ok(backup)),
        removeStoredFile: vi.fn().mockResolvedValue(ok()),
        deleteRecord: vi.fn().mockResolvedValue(failed()),
        restoreStoredFile,
      }),
    ).rejects.toMatchObject({ stage: "delete_record_restored" });
    expect(restoreStoredFile).toHaveBeenCalledWith(backup);
  });

  it("reports if the file cannot be restored after a database delete failure", async () => {
    await expect(
      deleteEvidenceSafely({
        downloadBackup: vi.fn().mockResolvedValue(ok(new Blob(["synthetic"]))),
        removeStoredFile: vi.fn().mockResolvedValue(ok()),
        deleteRecord: vi.fn().mockResolvedValue(failed()),
        restoreStoredFile: vi.fn().mockResolvedValue(failed()),
      }),
    ).rejects.toMatchObject({ stage: "delete_record_restore_failed" });
  });
});
