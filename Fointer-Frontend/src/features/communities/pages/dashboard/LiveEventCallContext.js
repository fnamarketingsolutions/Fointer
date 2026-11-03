import { createContext, useContext } from "react";

export const LiveEventCallContext = createContext(null);

export function useLiveEventCall() {
  const context = useContext(LiveEventCallContext);
  if (!context) {
    throw new Error("useLiveEventCall must be used within LiveEventCallProvider");
  }
  return context;
}
