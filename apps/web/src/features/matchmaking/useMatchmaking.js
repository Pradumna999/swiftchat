import { useCallback, useRef, useState } from "react";

import { createSocket } from "../../lib/websocket.js";
import { encodeEvent, parseEvent } from "../../lib/protocol.js";

export function useMatchmaking() {
  const [status, setStatus] = useState("idle");
  const [match, setMatch] = useState(null);
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const statusRef = useRef("idle");
  const sessionRef = useRef(0);

  const updateStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const startMatching = useCallback(
    (profile) => {
      sessionRef.current += 1;
      const sessionId = sessionRef.current;

      if (
        socketRef.current &&
        socketRef.current.readyState < WebSocket.CLOSING
      ) {
        socketRef.current.close(1000, "Replacing session");
      }

      setMatch(null);
      setError("");
      updateStatus("connecting");

      let socket;

      try {
        socket = createSocket("/ws/match");
      } catch {
        updateStatus("error");
        setError("Could not create a connection. Please try again.");
        return;
      }

      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (sessionRef.current !== sessionId) {
          socket.close();
          return;
        }

        socket.send(encodeEvent("join", {
          preferredName: profile.preferredName,
          interests: profile.interests,
          mode: profile.mode,
        }));
      });

      socket.addEventListener("message", (messageEvent) => {
        if (sessionRef.current !== sessionId) {
          return;
        }

        const event = parseEvent(messageEvent.data);

        if (!event) {
          setError("The server sent an invalid response.");
          return;
        }

        if (event.type === "queued") {
          updateStatus("waiting");
          return;
        }

        if (event.type === "matched") {
          if (
            typeof event.payload?.roomId !== "string" ||
            typeof event.payload?.ticket !== "string"
          ) {
            updateStatus("error");
            setError("The server returned an invalid match.");
            return;
          }

          setMatch(event.payload);
          updateStatus("matched");
          return;
        }

        if (event.type === "error") {
          updateStatus("error");
          setError(
            event.payload?.message || "Matchmaking failed."
          );
        }
      });

      socket.addEventListener("error", () => {
        if (
          sessionRef.current === sessionId &&
          ["connecting", "waiting"].includes(statusRef.current)
        ) {
          updateStatus("error");
          setError("Could not connect to the matchmaking server.");
        }
      });

      socket.addEventListener("close", () => {
        if (sessionRef.current !== sessionId) {
          return;
        }

        // The server closes this socket after a successful match.
        // Do not mistake that expected close for a failed match.
        if (["connecting", "waiting"].includes(statusRef.current)) {
          updateStatus("error");
          setError("The matchmaking connection closed. Please retry.");
        }

        if (socketRef.current === socket) {
          socketRef.current = null;
        }
      });
    },
    [updateStatus]
  );

  const cancelMatching = useCallback(() => {
    sessionRef.current += 1;

    const socket = socketRef.current;
    socketRef.current = null;

    updateStatus("idle");
    setMatch(null);
    setError("");

    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "Matchmaking cancelled");
    }
  }, [updateStatus]);

  return {
    status,
    match,
    error,
    startMatching,
    cancelMatching,
    resetSession: cancelMatching,
  };
}