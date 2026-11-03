import { createContext, useContext } from "react";

export const DmCallContext = createContext(null);

export function useDmCall() {
  const context = useContext(DmCallContext);
  if (!context) throw new Error("useDmCall must be used within DmCallProvider");
  return context;
}