"use client";

import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message ?? "خطا در دریافت اطلاعات.");
  }

  return data as T;
}

/**
 * Thin wrapper around React Query for GET endpoints — replaces the
 * fetch-in-useEffect-then-setState pattern with a properly cached,
 * de-duplicated, revalidatable query (and satisfies the
 * react-hooks/set-state-in-effect rule, which flags manual data-fetching
 * effects for good reason: they don't dedupe, cache, or race-guard).
 */
export function useApiQuery<T>(key: QueryKey, url: string) {
  return useQuery({
    queryKey: key,
    queryFn: () => fetchJson<T>(url),
  });
}

interface MutationOptions {
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  invalidateKeys?: QueryKey[];
}

export function useApiMutation<TResponse, TBody = unknown>(
  url: string | ((body: TBody) => string),
  options: MutationOptions = {},
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: TBody): Promise<TResponse> => {
      const resolvedUrl = typeof url === "function" ? url(body) : url;
      const res = await fetch(resolvedUrl, {
        method: options.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message ?? "عملیات ناموفق بود.");
      }

      return data as TResponse;
    },
    onSuccess: () => {
      options.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}
