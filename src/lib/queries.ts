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
      const { data, error } = await supabase
        .from("standards")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const { data: versions, error: versionError } = await supabase.from("criteria_versions").select("id,status");
      if (versionError) throw versionError;
      return assignedStandards(data, versions);
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
