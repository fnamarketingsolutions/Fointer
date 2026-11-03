import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import DirectCall from "./DirectCall";
import { DmCallContext } from "./DmCallContext";

export function DmCallProvider({ children }) {
  const callRef = useRef(null);
  const [target, setTarget] = useState({ conversationId: "", otherUser: null });
  const [startRequest, setStartRequest] = useState(null);
  const requestIdRef = useRef(0);
  const startedRequestRef = useRef(0);

  const setConversationTarget = useCallback((conversationId, otherUser) => {
    const id = String(conversationId || "");
    if (!id) return;

    setTarget((current) => {
      if (
        callRef.current?.isBusy() &&
        current.conversationId &&
        current.conversationId !== id
      ) {
        return current;
      }
      return {
        conversationId: id,
        otherUser: otherUser ||
          (current.conversationId === id ? current.otherUser : null),
      };
    });
  }, []);

  const startCall = useCallback((conversationId, otherUser, mode) => {
    const id = String(conversationId || "");
    if (!id || callRef.current?.isBusy()) return;

    setTarget({ conversationId: id, otherUser: otherUser || null });
    setStartRequest({
      conversationId: id,
      mode,
      requestId: ++requestIdRef.current,
    });
  }, []);

  useEffect(() => {
    if (
      !startRequest ||
      startRequest.requestId === startedRequestRef.current ||
      target.conversationId !== startRequest.conversationId
    ) {
      return;
    }
    startedRequestRef.current = startRequest.requestId;
    callRef.current?.start(startRequest.mode);
  }, [startRequest, target.conversationId]);

  return (
    <DmCallContext.Provider value={{ setConversationTarget, startCall }}>
      {children}
      <DirectCall
        ref={callRef}
        conversationId={target.conversationId}
        otherUser={target.otherUser}
      />
    </DmCallContext.Provider>
  );
}
