"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIME_ZONE } from "@/lib/time-zone";

const FamilyRuntime = createContext({ familyId: "", timeZone: DEFAULT_TIME_ZONE });
export function useFamilyRuntime() { return useContext(FamilyRuntime); }
export default function FamilyRuntimeProvider({ familyId, timeZone, children }: {
  familyId: string; timeZone: string; children: React.ReactNode;
}) {
  return <FamilyRuntime.Provider value={{ familyId, timeZone }}>{children}</FamilyRuntime.Provider>;
}
