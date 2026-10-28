import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

import { createSocket } from "../../lib/websocket.js";
import { encodeEvent, parseEvent } from "../../lib/protocol.js";
import { validateMessage } from "./validateMessage.js";
import { chatReducer } from "./chatReducer.js";

export function useChatSocket(match, ownName) {
  const [status, setStatus] = useState("idle");
  const [peer, setPeer] = useState(match?.peer ?? null);
  const [notice, setNotice] = useState("");
  const [messages, dispatch] = useReducer(chatReducer, []);

  const socketRef = useRef(null);
  const statusRef = useRef("idle");

  const updateStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  useEffect(() => {
    if (!match?.roomId || !match?.ticket) {
      socketRef.current = null;
      dispatch({ type: "CLEAR" });
      setPeer(null);
      setNotice("");
      updateStatus("idle");
      return;
    }

    let socket;

    dispatch({ type: "CLEAR" });
    setPeer(match.peer ?? null);
    setNotice("");
    updateStatus("connecting");

    try {
      socket = createSocket(
        `/ws/room/${encodeURIComponent(match.roomId)}`,
        ["swiftchat.v1", `ticket.${match.ticket}`]
      );
    } catch {
      updateStatus("error");
      setNotice("Could not start the chat connection.");
      return;
    }

    socketRef.current = socket;

    socket.addEventListener("message", (messageEvent) => {
      const event = parseEvent(messageEvent.data);

      if (!event) {
        setNotice("Received an invalid server event.");
        return;
      }

      const payload = event.payload ?? {};

      switch (event.type) {
        case "waiting_for_peer":
          updateStatus("waiting");
          break;

        case "ready":
          setPeer(payload.peer ?? match.peer ?? null);
          setNotice("");
          updateStatus("connected");
          break;

        case "message":
          dispatch({
            type: "ADD_REMOTE",
            message: {
              id: payload.id,
              text: payload.text,
              senderName: payload.senderName,
              sentAt: payload.sentAt,
              mine: false,
              status: "sent",
            },
          });
          break;

        case "message_sent":
          dispatch({
            type: "ACK",
            id: payload.id,
            sentAt: payload.sentAt,
          });
          break;

        case "peer_left":
        case "ended":
          // The chat history exists only for the live session.
          dispatch({ type: "CLEAR" });
          updateStatus("ended");
          setNotice(
            event.type === "peer_left"
              ? "The other participant has left."
              : "This conversation has ended."
          );
          break;

        case "error":
          if (
            ["rate_limited", "invalid_message"].includes(payload.code)
          ) {
            setNotice(payload.message || "Please check your message.");
          } else {
            dispatch({ type: "CLEAR" });
            updateStatus("error");
            setNotice(payload.message || "The chat connection failed.");
          }
          break;

        default:
          break;
      }
    });

    socket.addEventListener("error", () => {
      if (
        !["ended", "error"].includes(statusRef.current)
      ) {
        updateStatus("error");
        setNotice("Could not connect to the chat room.");
        dispatch({ type: "CLEAR" });
      }
    });

    socket.addEventListener("close", () => {
      socketRef.current = null;

      if (!["ended", "error"].includes(statusRef.current)) {
        updateStatus("ended");
        dispatch({ type: "CLEAR" });
        setNotice("The conversation connection has closed.");
      }
    });

    return () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      if (socket.readyState < WebSocket.CLOSING) {
        socket.close(1000, "Chat view closed");
      }
    };
  }, [
    match?.roomId,
    match?.ticket,
    match?.peer,
    updateStatus,
  ]);

  const sendMessage = useCallback(
    (value) => {
      const socket = socketRef.current;

      if (
        statusRef.current !== "connected" ||
        !socket ||
        socket.readyState !== WebSocket.OPEN
      ) {
        setNotice("The chat is not connected yet.");
        return false;
      }

      const validation = validateMessage(value);

      if (!validation.ok) {
        setNotice(validation.error);
        return false;
      }

      const id = crypto.randomUUID();
      const sentAt = Date.now();

      const message = {
        id,
        text: validation.text,
        senderName: ownName || "You",
        sentAt,
        mine: true,
        status: "sending",
      };

      try {
        socket.send(encodeEvent("message", {
          id,
          text: validation.text,
        }));

        dispatch({
          type: "ADD_LOCAL",
          message,
        });

        setNotice("");
        return true;
      } catch {
        setNotice("Message could not be sent. Please try again.");
        return false;
      }
    },
    [ownName]
  );

  const endChat = useCallback(() => {
    const socket = socketRef.current;

    if (socket && socket.readyState === WebSocket.OPEN) {
      updateStatus("ending");

      try {
        socket.send(encodeEvent("leave"));
      } catch {
        socket.close();
        dispatch({ type: "CLEAR" });
        updateStatus("ended");
      }

      return;
    }

    dispatch({ type: "CLEAR" });
    updateStatus("ended");
  }, [updateStatus]);

  return {
    status,
    peer,
    messages,
    notice,
    sendMessage,
    endChat,
  };
}