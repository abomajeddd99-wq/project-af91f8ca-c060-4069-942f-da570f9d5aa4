export type EvidenceOperationStage =
  | "upload"
  | "save"
  | "save_cleanup"
  | "replace_upload"
  | "replace_upload_cleanup"
  | "replace_save"
  | "replace_save_cleanup"
  | "delete_backup"
  | "delete_storage"
  | "delete_record_restored"
  | "delete_record_restore_failed";

const EVIDENCE_OPERATION_MESSAGES: Record<EvidenceOperationStage, string> = {
  upload: "تعذر رفع الملف.",
  save: "تعذر حفظ بيانات الشاهد.",
  save_cleanup: "تعذر حفظ بيانات الشاهد وتعذر حذف نسخة الرفع المؤقتة. يرجى مراجعة الدعم.",
  replace_upload: "تعذر رفع الملف البديل.",
  replace_upload_cleanup: "تعذر رفع الملف البديل وتنظيف النسخة المؤقتة. بقي الملف الأصلي دون تغيير.",
  replace_save: "تعذر حفظ التعديلات. بقي الملف الأصلي دون تغيير.",
  replace_save_cleanup: "تعذر حفظ التعديلات وتعذر تنظيف الملف البديل. يرجى مراجعة الدعم.",
  delete_backup: "تعذر تأمين نسخة احتياطية للملف؛ لم يتم حذف الشاهد.",
  delete_storage: "تعذر حذف الملف؛ بقي الشاهد دون تغيير.",
  delete_record_restored: "تعذر حذف سجل الشاهد؛ تمت استعادة الملف الأصلي.",
  delete_record_restore_failed: "تعذر حذف سجل الشاهد واستعادة الملف. لا تكرر العملية وراجع الدعم.",
};

export class EvidenceOperationError extends Error {
  constructor(readonly stage: EvidenceOperationStage) {
    super(EVIDENCE_OPERATION_MESSAGES[stage]);
    this.name = "EvidenceOperationError";
  }
}

export interface OperationResult<T = unknown> {
  data?: T | null;
  error: unknown | null;
}

export type OperationAction<T = unknown> = () => PromiseLike<OperationResult<T>>;

async function capture<T>(action: OperationAction<T>): Promise<OperationResult<T>> {
  try {
    return await action();
  } catch (error) {
    return { error };
  }
}

export async function saveEvidenceWithFile(actions: {
  upload: OperationAction;
  save: OperationAction;
  removeNewFile: OperationAction;
}): Promise<void> {
  const upload = await capture(actions.upload);
  if (upload.error) throw new EvidenceOperationError("upload");

  const save = await capture(actions.save);
  if (!save.error) return;

  const cleanup = await capture(actions.removeNewFile);
  throw new EvidenceOperationError(cleanup.error ? "save_cleanup" : "save");
}

export async function replaceEvidenceFileSafely(actions: {
  uploadNewFile: OperationAction;
  saveChanges: OperationAction;
  removeNewFile: OperationAction;
  removeOldFile: OperationAction;
}): Promise<{ oldFileCleanupFailed: boolean }> {
  const upload = await capture(actions.uploadNewFile);
  if (upload.error) {
    const cleanup = await capture(actions.removeNewFile);
    throw new EvidenceOperationError(cleanup.error ? "replace_upload_cleanup" : "replace_upload");
  }

  const save = await capture(actions.saveChanges);
  if (save.error) {
    const cleanup = await capture(actions.removeNewFile);
    throw new EvidenceOperationError(cleanup.error ? "replace_save_cleanup" : "replace_save");
  }

  const cleanup = await capture(actions.removeOldFile);
  return { oldFileCleanupFailed: Boolean(cleanup.error) };
}

export async function deleteEvidenceSafely(actions: {
  downloadBackup: OperationAction<Blob>;
  removeStoredFile: OperationAction;
  deleteRecord: OperationAction<{ id: string }>;
  restoreStoredFile: (backup: Blob) => PromiseLike<OperationResult>;
}): Promise<void> {
  const backup = await capture(actions.downloadBackup);
  if (backup.error || !backup.data) throw new EvidenceOperationError("delete_backup");

  const removed = await capture(actions.removeStoredFile);
  if (removed.error) throw new EvidenceOperationError("delete_storage");

  const deleted = await capture(actions.deleteRecord);
  if (deleted.error || !deleted.data) {
    const restored = await capture(() => actions.restoreStoredFile(backup.data!));
    throw new EvidenceOperationError(restored.error ? "delete_record_restore_failed" : "delete_record_restored");
  }
}
