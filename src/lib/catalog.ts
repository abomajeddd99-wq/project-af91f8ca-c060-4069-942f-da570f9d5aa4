import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const careerPathsQuery = () => queryOptions({
  queryKey: ["career-paths"],
  queryFn: async () => {
    const { data, error } = await supabase.from("professional_roles").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const criteriaVersionsQuery = () => queryOptions({
  queryKey: ["criteria-versions"],
  queryFn: async () => {
    const { data, error } = await supabase.from("criteria_versions").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const categoriesQuery = () => queryOptions({
  queryKey: ["criteria-categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("criteria_categories").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});