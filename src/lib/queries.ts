import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { assignedStandards } from "./career";

export type Standard = Tables<"standards">;
export type Evidence = Tables<"evidences">;
export type Progress = Tables<"standard_progress">;
export type Profile = Tables<"profiles">;

export const standardsQuery = () =>
  queryOptions({
    queryKey: ["standards", "active"],
    queryFn: async (): Promise<Standard[]> => {
      const { data: authData } = await supabase.auth.getUser();
      let roleId: string | null = null;
      if (authData?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("professional_role_id")
          .eq("id", authData.user.id)
          .maybeSingle();
        roleId = prof?.professional_role_id ?? null;
      }

      const { data, error } = await supabase
        .from("standards")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      let vQuery = supabase.from("criteria_versions").select("id,status,professional_role_id,is_official");
      if (roleId) {
        vQuery = vQuery.eq("professional_role_id", roleId);
      }
      const { data: versions, error: versionError } = await vQuery;
      if (versionError) throw versionError;

      const validVersions = versions.filter((v) => v.status === "published" || v.is_official);
      return assignedStandards(data, validVersions.map((v) => ({ id: v.id, status: "published" })));
    },
  });

export const allStandardsQuery = () =>
  queryOptions({
    queryKey: ["standards", "all"],
    queryFn: async (): Promise<Standard[]> => {
      const { data, error } = await supabase
        .from("standards")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export const progressQuery = () =>
  queryOptions({
    queryKey: ["progress"],
    queryFn: async (): Promise<Progress[]> => {
      const { data, error } = await supabase.from("standard_progress").select("*");
      if (error) throw error;
      return data;
    },
  });

export const evidencesQuery = () =>
  queryOptions({
    queryKey: ["evidences"],
    queryFn: async (): Promise<Evidence[]> => {
      const { data, error } = await supabase
        .from("evidences")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const isAdminQuery = () =>
  queryOptions({
    queryKey: ["is-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) return false;
      return data === true;
    },
    staleTime: 60_000,
  });

export const signedUrlQuery = (path: string) =>
  queryOptions({
    queryKey: ["signed-url", path],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage.from("evidence").createSignedUrl(path, 600);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 8 * 60_000,
  });
