"use client";

import { useMemo } from "react";
import { useTheme } from "./ThemeProvider";
import { getAccents, type NodeAccents } from "@/lib/colors";

export function useNodeAccents(): NodeAccents {
  const { theme } = useTheme();
  return useMemo(() => getAccents(theme), [theme]);
}
