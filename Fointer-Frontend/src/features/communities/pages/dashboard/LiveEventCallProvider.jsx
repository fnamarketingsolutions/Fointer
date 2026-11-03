import { useCallback, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import EventCall from "./EventCall";
import { LiveEventCallContext } from "./LiveEventCallContext";

export function LiveEventCallProvider({ children }) {
  const location = useLocation();
  const [activeEvent, setActiveEvent] = useState(null);
  const inCallRef = useRef(false);

  const registerEvent = useCallback((event) => {
    setActiveEvent((current) => {
      if (
        inCallRef.current &&
        current?.eventId &&
        String(current.eventId) !== String(event.eventId)
      ) {
        return current;
      }
      return event;
    });
  }, []);

  const handleCallStateChange = useCallback((inCall) => {
    inCallRef.current = inCall;
  }, []);

  const isRouteActive =
    activeEvent &&
    location.pathname === `/live-events/${activeEvent.eventId}`;

  return (
    <LiveEventCallContext.Provider value={{ registerEvent }}>
      {children}
      {activeEvent ? (
        <EventCall
          key={activeEvent.eventId}
          {...activeEvent}
          isRouteActive={isRouteActive}
          onCallStateChange={handleCallStateChange}
        />
      ) : null}
    </LiveEventCallContext.Provider>
  );
}
