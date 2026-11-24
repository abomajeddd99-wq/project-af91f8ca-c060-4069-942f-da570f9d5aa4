import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("is_admin");
    if (roleError || allowed !== true) throw new Error("غير مصرح بالدخول إلى الإدارة");
    const { data, error } = await context.supabase.rpc("admin_list_personal_accounts");
    if (error) throw new Error("تعذر تحميل الحسابات");
    return data;
  });