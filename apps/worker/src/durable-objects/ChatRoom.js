
import { DurableObject } from "cloudflare:workers";
import { verifyRoomTicket } from "../lib/ticket-auth.js";

const OPEN = 1;
const CHAT_PROTOCOL = "swiftchat.v1";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAttachment(ws) {
  return ws.deserializeAttachment() ?? {};
}

function sendEvent(ws, type, payload = {}) {
  if (ws.readyState !== OPEN) {
    return;
  }

  ws.send(JSON.stringify({
    v: 1,
    type,
    payload,
  }));
}

function readTicket(request) {
  const offeredProtocols =
    request.headers.get("Sec-WebSocket-Protocol") ?? "";

  const ticketProtocol = offeredProtocols
    .split(",")
    .map((protocol) => protocol.trim())
    .find((protocol) => protocol.startsWith("ticket."));

  return ticketProtocol
    ? ticketProtocol.slice("ticket.".length)
    : null;
}

export class ChatRoom extends DurableObject {
  async fetch(request) {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response("WebSocket upgrade required", {
        status: 426,
      });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/ws\/room\/([^/]+)$/);

    if (!match || !UUID_PATTERN.test(match[1])) {
      return new Response("Invalid room ID", { status: 400 });
    }

    const roomId = match[1].toLowerCase();
    const ticket = readTicket(request);

    if (!ticket) {
      return new Response("Room ticket required", { status: 401 });
    }

    const claims = await verifyRoomTicket(
      ticket,
      this.env.ROOM_TICKET_SECRET
    );

    if (!claims || claims.roomId.toLowerCase() !== roomId) {
      return new Response("Invalid or expired room ticket", {
        status: 401,
      });
    }

    // A room accepts no more than two live participants.
    const currentSockets = this.openConnections();

    if (currentSockets.length >= 2) {
      return new Response("Room is full", { status: 409 });
    }

    // Each signed ticket authorizes one specific participant slot.
    const slotAlreadyOccupied = currentSockets.some(
      (socket) => getAttachment(socket).slot === claims.slot
    );

    if (slotAlreadyOccupied) {
      return new Response("Participant slot is already occupied", {
        status: 409,
      });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    server.serializeAttachment({
      roomId,
      slot: claims.slot,
      status: "connected",
      profile: claims.profile,
      rateWindowStart: 0,
      messageCount: 0,
    });

    // The first participant waits. Once the second connects,
    // notify both clients and give each the other participant's profile.
    const participants = this.openConnections();

    if (participants.length === 1) {
      sendEvent(server, "waiting_for_peer");
    } else if (participants.length === 2) {
      const first = participants[0];
      const second = participants[1];

      const firstProfile = getAttachment(first).profile;
      const secondProfile = getAttachment(second).profile;

      sendEvent(first, "ready", {
        peer: secondProfile,
      });

      sendEvent(second, "ready", {
        peer: firstProfile,
      });
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        "Sec-WebSocket-Protocol": CHAT_PROTOCOL,
      },
    });
  }

  openConnections() {
    return this.ctx
      .getWebSockets()
      .filter((socket) => socket.readyState === OPEN);
  }

  findPeer(ws) {
    return this.openConnections().find(
      (candidate) =>
        candidate !== ws &&
        getAttachment(candidate).status === "connected"
    );
  }

  allowMessage(ws) {
    const state = getAttachment(ws);
    const now = Date.now();

    let windowStart = state.rateWindowStart;
    let messageCount = state.messageCount;

    if (
      !Number.isFinite(windowStart) ||
      now - windowStart >= 5000
    ) {
      windowStart = now;
      messageCount = 0;
    }

    messageCount += 1;

    ws.serializeAttachment({
      ...state,
      rateWindowStart: windowStart,
      messageCount,
    });

    return messageCount <= 15;
  }

  webSocketMessage(ws, rawMessage) {
    const state = getAttachment(ws);

    if (state.status !== "connected") {
      return;
    }

    if (typeof rawMessage !== "string") {
      ws.close(1003, "Text messages only");
      return;
    }

    if (rawMessage.length > 8192) {
      ws.close(1009, "Message too large");
      return;
    }

    let event;

    try {
      event = JSON.parse(rawMessage);
    } catch {
      sendEvent(ws, "error", {
        code: "invalid_json",
        message: "Send a valid JSON event.",
      });
      return;
    }

    if (
      !event ||
      typeof event !== "object" ||
      event.v !== 1 ||
      typeof event.type !== "string"
    ) {
      sendEvent(ws, "error", {
        code: "invalid_event",
        message: "Invalid chat event.",
      });
      return;
    }

    if (event.type === "leave") {
      this.endRoom("left", ws);
      return;
    }

    if (event.type !== "message" && event.type !== "typing") {
      sendEvent(ws, "error", {
        code: "unknown_event",
        message: "Unsupported chat event.",
      });
      return;
    }

    if (!this.allowMessage(ws)) {
      sendEvent(ws, "error", {
        code: "rate_limited",
        message: "Slow down and try again shortly.",
      });
      return;
    }

    const peer = this.findPeer(ws);

    if (!peer) {
      this.endRoom("peer_disconnected", ws);
      return;
    }

    if (event.type === "typing") {
      sendEvent(peer, "typing", {
        isTyping: event.payload?.isTyping === true,
        senderName: state.profile.preferredName,
      });

      return;
    }

    const text = event.payload?.text;

    if (typeof text !== "string") {
      sendEvent(ws, "error", {
        code: "invalid_message",
        message: "Message text must be a string.",
      });
      return;
    }

    const trimmedText = text.trim();

    if (trimmedText.length === 0 || trimmedText.length > 2000) {
      sendEvent(ws, "error", {
        code: "invalid_message",
        message: "Messages must contain 1–2000 characters.",
      });
      return;
    }

    const requestedId = event.payload?.id;

const messageId =
  typeof requestedId === "string" &&
  UUID_PATTERN.test(requestedId)
    ? requestedId
    : crypto.randomUUID();

const sentAt = Date.now();

    // Deliver directly. The content is not put in an attachment,
    // database, queue, or history collection.
    sendEvent(peer, "message", {
      id: messageId,
      text: trimmedText,
      senderName: state.profile.preferredName,
      sentAt,
    });

    sendEvent(ws, "message_sent", {
      id: messageId,
      sentAt,
    });
  }

  endRoom(reason, initiator = null) {
    const sockets = this.openConnections();

    // Notify users and mark every connection as closing before
    // initiating close events. This prevents duplicate teardown.
    for (const socket of sockets) {
      const state = getAttachment(socket);

      if (socket === initiator) {
        sendEvent(socket, "ended", { reason });
      } else {
        sendEvent(socket, "peer_left", { reason });
      }

      socket.serializeAttachment({
        ...state,
        status: "closing",
      });
    }

    for (const socket of sockets) {
      if (socket.readyState === OPEN) {
        socket.close(1000, "Chat ended");
      }
    }
  }

  webSocketClose(ws) {
    const state = getAttachment(ws);

    // A normal leave has already notified and closed both sides.
    if (state.status === "closing") {
      return;
    }

    // Unexpected departure: close the other participant's session.
    this.endRoom("peer_disconnected");
  }

  webSocketError(ws) {
    const state = getAttachment(ws);

    if (state.status !== "closing") {
      this.endRoom("connection_error");
    }
  }
}
