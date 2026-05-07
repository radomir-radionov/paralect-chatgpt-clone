"use client";

import { useQuery } from "@tanstack/react-query";

import { meQueryOptions } from "./clientAuthFetchers";

export const currentUserQueryOptions = meQueryOptions;

export function useCurrentUser() {
  // keep the old public API, but share the implementation
  const result = useQuery(meQueryOptions());

  return {
    user: result.data ?? null,
    isLoading: result.isLoading,
  };
}
