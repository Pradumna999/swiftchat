
import { DurableObject } from "cloudflare:workers";
import { consumeRateLimit } from "../lib/rate-limit.js";
import { selectCandidate } from "../lib/matching.js";
import { validateJoinPayload } from "../lib/validation.js";
import { createRoomTicket } from "../lib/ticket-auth.js";

const OPEN = 1;
// Initial capacity safeguard for the single matchmaking Durable Object.
// Raise only after load testing.
const MAX_ACTIVE_MATCHMAKER_CONNECTIONS = 500;

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

function getAttachment(ws) {
  return ws.deserializeAttachment() ?? {};
}

export class Matchmaker extends DurableObject {
  async fetch(request) {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", {
        status: 426,
      });
    }
const activeConnections = this.ctx
  .getWebSockets()
  .filter((socket) => socket.readyState === OPEN)
  .length;

if (activeConnections >= MAX_ACTIVE_MATCHMAKER_CONNECTIONS) {
  return new Response("Matchmaking is busy. Try again shortly.", {
    status: 503,
    headers: {
      "Retry-After": "5",
      "Cache-Control": "no-store",
    },
  });
}
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.serializeAttachment({
      connectionId: crypto.randomUUID(),
      status: "connected",
    });

    // Use the hibernation API rather than server.accept().
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== "string" || message.length > 8192) {
      ws.close(1009, "Message too large or invalid");
      return;
    }

    let event;

    try {
      event = JSON.parse(message);
    } catch {
      sendEvent(ws, "error", {
        code: "invalid_json",
        message: "Send a valid JSON message.",
      });
      return;
    }

    if (event.v !== 1) {
      sendEvent(ws, "error", {
        code: "unsupported_protocol",
        message: "Unsupported protocol version.",
      });
      return;
    }

    const attachment = getAttachment(ws);

    if (event.type === "cancel") {
      if (
        attachment.status === "connected" ||
        attachment.status === "waiting"
      ) {
        ws.close(1000, "Matchmaking cancelled");
      } else {
        sendEvent(ws, "error", {
          code: "cannot_cancel",
          message: "This matchmaking session cannot be cancelled now.",
        });
      }

      return;
    }

    if (event.type !== "join") {
      sendEvent(ws, "error", {
        code: "unknown_event",
        message: "Unsupported matchmaking event.",
      });
      return;
    }

    if (attachment.status !== "connected") {
      sendEvent(ws, "error", {
        code: "already_joined",
        message: "This connection has already joined matchmaking.",
      });
      return;
    }

    const validation = validateJoinPayload(event.payload);

    if (!validation.ok) {
      sendEvent(ws, "error", {
        code: "invalid_join",
        message: validation.error,
      });
      return;
    }

    const profile = {
      ...validation.profile,
      id: attachment.connectionId,
    };

    // Build a temporary candidate list from active WebSockets.
    // A connection is eligible only if its attachment says waiting.
    const waitingConnections = this.ctx
      .getWebSockets()
      .filter((candidate) => {
        if (candidate === ws || candidate.readyState !== OPEN) {
          return false;
        }

        return getAttachment(candidate).status === "waiting";
      })
      .map((candidate) => ({
        ws: candidate,
        attachment: getAttachment(candidate),
      }))
      .filter(({ attachment: candidate }) => candidate.profile);

    const selectedProfile = selectCandidate(
      profile,
      waitingConnections.map(({ attachment: candidate }) => candidate.profile)
    );

    const selectedConnection = waitingConnections.find(
      ({ attachment: candidate }) =>
        candidate.profile.id === selectedProfile?.id
    );

    // Nobody compatible is waiting: keep this connection in the queue.
    if (!selectedConnection) {
      ws.serializeAttachment({
        connectionId: attachment.connectionId,
        status: "waiting",
        profile,
        queuedAt: Date.now(),
      });

      sendEvent(ws, "queued", {
        waitingCount: this.countWaiting(),
      });

      return;
    }

    const peer = selectedConnection.ws;
    const peerAttachment = selectedConnection.attachment;
    const peerProfile = peerAttachment.profile;
    const roomId = crypto.randomUUID();
    const exp = Math.floor(Date.now() / 1000) + 300;

    // Reserve both participants synchronously before awaiting signing.
    // This prevents another join event from choosing either participant.
    ws.serializeAttachment({
      connectionId: attachment.connectionId,
      status: "matching",
      profile,
      pairedConnectionId: peerAttachment.connectionId,
      roomId,
    });

    peer.serializeAttachment({
      connectionId: peerAttachment.connectionId,
      status: "matching",
      profile: peerProfile,
      pairedConnectionId: attachment.connectionId,
      roomId,
    });

    let ticketA;
    let ticketB;

    try {
      
[ticketA, ticketB] = await Promise.all([
  createRoomTicket(
    {
      roomId,
      slot: "a",
      exp,
      profile: {
        preferredName: profile.preferredName,
        interests: profile.interests,
      },
    },
    this.env.ROOM_TICKET_SECRET
  ),

  createRoomTicket(
    {
      roomId,
      slot: "b",
      exp,
      profile: {
        preferredName: peerProfile.preferredName,
        interests: peerProfile.interests,
      },
    },
    this.env.ROOM_TICKET_SECRET
  ),
]);

    } catch {
      this.restoreToWaiting(ws, roomId);
      this.restoreToWaiting(peer, roomId);

      sendEvent(ws, "error", {
        code: "ticket_generation_failed",
        message: "Matching is temporarily unavailable. Please retry.",
      });

      sendEvent(peer, "error", {
        code: "ticket_generation_failed",
        message: "Matching is temporarily unavailable. Please retry.",
      });

      return;
    }

    // A participant might have disconnected while tickets were signed.
    if (ws.readyState !== OPEN || peer.readyState !== OPEN) {
      this.restoreToWaiting(ws, roomId);
      this.restoreToWaiting(peer, roomId);
      return;
    }

    const latestA = getAttachment(ws);
    const latestB = getAttachment(peer);

    if (
      latestA.status !== "matching" ||
      latestB.status !== "matching" ||
      latestA.roomId !== roomId ||
      latestB.roomId !== roomId
    ) {
      return;
    }

    // Remove profile data from the matchmaking connections.
    // The matched users will establish new connections to the room.
    ws.serializeAttachment({
      connectionId: latestA.connectionId,
      status: "matched",
    });

    peer.serializeAttachment({
      connectionId: latestB.connectionId,
      status: "matched",
    });

    sendEvent(ws, "matched", {
      roomId,
      ticket: ticketA,
      expiresAt: exp,
      peer: {
        preferredName: peerProfile.preferredName,
        interests: peerProfile.interests,
      },
    });

    sendEvent(peer, "matched", {
      roomId,
      ticket: ticketB,
      expiresAt: exp,
      peer: {
        preferredName: profile.preferredName,
        interests: profile.interests,
      },
    });
    ws.close(1000, "Match found");
peer.close(1000, "Match found");
  }
  countWaiting() {
    return this.ctx
      .getWebSockets()
      .filter((ws) => getAttachment(ws).status === "waiting")
      .length;
  }

  restoreToWaiting(ws, roomId) {
    if (ws.readyState !== OPEN) {
      return;
    }

    const current = getAttachment(ws);

    if (
      current.status !== "matching" ||
      current.roomId !== roomId ||
      !current.profile
    ) {
      return;
    }

    ws.serializeAttachment({
      connectionId: current.connectionId,
      status: "waiting",
      profile: current.profile,
      queuedAt: current.queuedAt ?? Date.now(),
    });

    sendEvent(ws, "queued", {
      waitingCount: this.countWaiting(),
      reason: "partner_disconnected",
    });
  }

  handleDisconnect(ws) {
    const attachment = getAttachment(ws);

    if (
      attachment.status !== "matching" ||
      !attachment.pairedConnectionId
    ) {
      return;
    }

    const peer = this.ctx.getWebSockets().find((candidate) => {
      if (candidate === ws || candidate.readyState !== OPEN) {
        return false;
      }

      return (
        getAttachment(candidate).connectionId ===
        attachment.pairedConnectionId
      );
    });

    if (peer) {
      this.restoreToWaiting(peer, attachment.roomId);
    }
  }

  webSocketClose(ws) {
    this.handleDisconnect(ws);
  }

  webSocketError(ws) {
    this.handleDisconnect(ws);
  }
}
