"use client";

import { useState } from "react";

/** Preserve local edits until a fresh server snapshot arrives. */
export function useServerState<T>(serverValue: T) {
  const [value, setValue] = useState(serverValue);
  const [snapshot, setSnapshot] = useState(serverValue);
  if (snapshot !== serverValue) {
    setSnapshot(serverValue);
    setValue(serverValue);
  }
  return [value, setValue] as const;
}
