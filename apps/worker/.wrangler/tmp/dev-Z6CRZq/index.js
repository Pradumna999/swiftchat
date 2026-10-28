var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/durable-objects/Matchmaker.js
import { DurableObject } from "cloudflare:workers";

// src/lib/matching.js
var VALID_MODES = /* @__PURE__ */ new Set(["random", "interests"]);
function normalizeInterests(interests) {
  if (!Array.isArray(interests)) {
    return [];
  }
  const normalized = /* @__PURE__ */ new Set();
  for (const interest of interests) {
    if (typeof interest !== "string") {
      continue;
    }
    const value = interest.trim().toLowerCase();
    if (value) {
      normalized.add(value);
    }
  }
  return [...normalized];
}
__name(normalizeInterests, "normalizeInterests");
function calculateInterestScore(firstInterests, secondInterests) {
  const first = new Set(normalizeInterests(firstInterests));
  const second = new Set(normalizeInterests(secondInterests));
  if (first.size === 0 || second.size === 0) {
    return 0;
  }
  let sharedCount = 0;
  for (const interest of first) {
    if (second.has(interest)) {
      sharedCount += 1;
    }
  }
  return 2 * sharedCount / (first.size + second.size);
}
__name(calculateInterestScore, "calculateInterestScore");
function areProfilesCompatible(first, second) {
  if (!first || !second || first === second) {
    return false;
  }
  if (!VALID_MODES.has(first.mode) || !VALID_MODES.has(second.mode)) {
    return false;
  }
  if (first.id != null && second.id != null && first.id === second.id) {
    return false;
  }
  const score = calculateInterestScore(
    first.interests,
    second.interests
  );
  if (first.mode === "interests" || second.mode === "interests") {
    return score > 0;
  }
  return true;
}
__name(areProfilesCompatible, "areProfilesCompatible");
function randomIndex(length, random) {
  if (length <= 1) {
    return 0;
  }
  const value = Number(random());
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(
    length - 1,
    Math.max(0, Math.floor(value * length))
  );
}
__name(randomIndex, "randomIndex");
function selectCandidate(requester, waitingProfiles, random = Math.random) {
  if (!requester || !Array.isArray(waitingProfiles)) {
    return null;
  }
  const eligible = waitingProfiles.filter(
    (candidate) => areProfilesCompatible(requester, candidate)
  );
  if (eligible.length === 0) {
    return null;
  }
  if (requester.mode === "random") {
    return eligible[randomIndex(eligible.length, random)];
  }
  const scoredCandidates = eligible.map((candidate) => ({
    candidate,
    score: calculateInterestScore(
      requester.interests,
      candidate.interests
    )
  }));
  const highestScore = Math.max(
    ...scoredCandidates.map((item) => item.score)
  );
  const bestCandidates = scoredCandidates.filter((item) => item.score === highestScore).map((item) => item.candidate);
  return bestCandidates[randomIndex(bestCandidates.length, random)];
}
__name(selectCandidate, "selectCandidate");

// src/lib/validation.js
var ALLOWED_INTERESTS = /* @__PURE__ */ new Set([
  "technology",
  "ai",
  "science",
  "gaming",
  "music",
  "movies",
  "anime",
  "philosophy",
  "books",
  "art",
  "startups",
  "travel",
  "fitness",
  "languages",
  "sports"
]);
var VALID_MODES2 = /* @__PURE__ */ new Set(["random", "interests"]);
function validateJoinPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Invalid preferences." };
  }
  if (typeof payload.preferredName !== "string") {
    return { ok: false, error: "A preferred name is required." };
  }
  const preferredName = payload.preferredName.trim();
  if (preferredName.length === 0 || preferredName.length > 24 || /[\u0000-\u001F\u007F]/.test(preferredName)) {
    return { ok: false, error: "Invalid preferred name." };
  }
  if (!VALID_MODES2.has(payload.mode)) {
    return { ok: false, error: "Invalid matching mode." };
  }
  if (!Array.isArray(payload.interests) || payload.interests.length > 5) {
    return { ok: false, error: "Choose up to five interests." };
  }
  const interests = [];
  for (const item of payload.interests) {
    if (typeof item !== "string") {
      return { ok: false, error: "Invalid interest." };
    }
    const normalized = item.trim().toLowerCase();
    if (!ALLOWED_INTERESTS.has(normalized)) {
      return { ok: false, error: "Unsupported interest." };
    }
    if (!interests.includes(normalized)) {
      interests.push(normalized);
    }
  }
  if (payload.mode === "interests" && interests.length === 0) {
    return {
      ok: false,
      error: "Choose an interest for interest-based matching."
    };
  }
  return {
    ok: true,
    profile: {
      preferredName,
      interests,
      mode: payload.mode
    }
  };
}
__name(validateJoinPayload, "validateJoinPayload");

// src/lib/ticket-auth.js
var encoder = new TextEncoder();
var decoder = new TextDecoder("utf-8", { fatal: true });
function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid base64url value.");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0)
  );
}
__name(base64UrlDecode, "base64UrlDecode");
async function importTicketKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("Room-ticket signing secret is invalid.");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign", "verify"]
  );
}
__name(importTicketKey, "importTicketKey");
async function createRoomTicket({ roomId, slot, exp, profile }, secret) {
  if (typeof roomId !== "string" || !["a", "b"].includes(slot) || !Number.isSafeInteger(exp) || !profile || typeof profile.preferredName !== "string" || !Array.isArray(profile.interests)) {
    throw new Error("Invalid room-ticket claims.");
  }
  const payload = JSON.stringify({
    roomId,
    slot,
    exp,
    profile: {
      preferredName: profile.preferredName,
      interests: profile.interests
    }
  });
  const encodedPayload = base64UrlEncode(
    encoder.encode(payload)
  );
  const key = await importTicketKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encodedPayload)
  );
  return encodedPayload + "." + base64UrlEncode(new Uint8Array(signature));
}
__name(createRoomTicket, "createRoomTicket");
async function verifyRoomTicket(ticket, secret) {
  try {
    if (typeof ticket !== "string" || ticket.length > 2048) {
      return null;
    }
    const parts = ticket.split(".");
    if (parts.length !== 2) {
      return null;
    }
    const [encodedPayload, encodedSignature] = parts;
    const signature = base64UrlDecode(encodedSignature);
    const key = await importTicketKey(secret);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(encodedPayload)
    );
    if (!isValid) {
      return null;
    }
    const payloadBytes = base64UrlDecode(encodedPayload);
    const claims = JSON.parse(decoder.decode(payloadBytes));
    if (typeof claims.roomId !== "string" || !["a", "b"].includes(claims.slot) || !Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1e3) || !claims.profile || typeof claims.profile.preferredName !== "string" || !Array.isArray(claims.profile.interests) || claims.profile.interests.length > 5 || claims.profile.interests.some(
      (interest) => typeof interest !== "string"
    )) {
      return null;
    }
    const preferredName = claims.profile.preferredName.trim();
    if (preferredName.length === 0 || preferredName.length > 24) {
      return null;
    }
    return {
      roomId: claims.roomId,
      slot: claims.slot,
      exp: claims.exp,
      profile: {
        preferredName,
        interests: claims.profile.interests
      }
    };
  } catch {
    return null;
  }
}
__name(verifyRoomTicket, "verifyRoomTicket");

// src/durable-objects/Matchmaker.js
var OPEN = 1;
function sendEvent(ws, type, payload = {}) {
  if (ws.readyState !== OPEN) {
    return;
  }
  ws.send(JSON.stringify({
    v: 1,
    type,
    payload
  }));
}
__name(sendEvent, "sendEvent");
function getAttachment(ws) {
  return ws.deserializeAttachment() ?? {};
}
__name(getAttachment, "getAttachment");
var Matchmaker = class extends DurableObject {
  static {
    __name(this, "Matchmaker");
  }
  async fetch(request) {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", {
        status: 426
      });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({
      connectionId: crypto.randomUUID(),
      status: "connected"
    });
    this.ctx.acceptWebSocket(server);
    return new Response(null, {
      status: 101,
      webSocket: client
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
        message: "Send a valid JSON message."
      });
      return;
    }
    if (event.v !== 1) {
      sendEvent(ws, "error", {
        code: "unsupported_protocol",
        message: "Unsupported protocol version."
      });
      return;
    }
    const attachment = getAttachment(ws);
    if (event.type === "cancel") {
      if (attachment.status === "connected" || attachment.status === "waiting") {
        ws.close(1e3, "Matchmaking cancelled");
      } else {
        sendEvent(ws, "error", {
          code: "cannot_cancel",
          message: "This matchmaking session cannot be cancelled now."
        });
      }
      return;
    }
    if (event.type !== "join") {
      sendEvent(ws, "error", {
        code: "unknown_event",
        message: "Unsupported matchmaking event."
      });
      return;
    }
    if (attachment.status !== "connected") {
      sendEvent(ws, "error", {
        code: "already_joined",
        message: "This connection has already joined matchmaking."
      });
      return;
    }
    const validation = validateJoinPayload(event.payload);
    if (!validation.ok) {
      sendEvent(ws, "error", {
        code: "invalid_join",
        message: validation.error
      });
      return;
    }
    const profile = {
      ...validation.profile,
      id: attachment.connectionId
    };
    const waitingConnections = this.ctx.getWebSockets().filter((candidate) => {
      if (candidate === ws || candidate.readyState !== OPEN) {
        return false;
      }
      return getAttachment(candidate).status === "waiting";
    }).map((candidate) => ({
      ws: candidate,
      attachment: getAttachment(candidate)
    })).filter(({ attachment: candidate }) => candidate.profile);
    const selectedProfile = selectCandidate(
      profile,
      waitingConnections.map(({ attachment: candidate }) => candidate.profile)
    );
    const selectedConnection = waitingConnections.find(
      ({ attachment: candidate }) => candidate.profile.id === selectedProfile?.id
    );
    if (!selectedConnection) {
      ws.serializeAttachment({
        connectionId: attachment.connectionId,
        status: "waiting",
        profile,
        queuedAt: Date.now()
      });
      sendEvent(ws, "queued", {
        waitingCount: this.countWaiting()
      });
      return;
    }
    const peer = selectedConnection.ws;
    const peerAttachment = selectedConnection.attachment;
    const peerProfile = peerAttachment.profile;
    const roomId = crypto.randomUUID();
    const exp = Math.floor(Date.now() / 1e3) + 300;
    ws.serializeAttachment({
      connectionId: attachment.connectionId,
      status: "matching",
      profile,
      pairedConnectionId: peerAttachment.connectionId,
      roomId
    });
    peer.serializeAttachment({
      connectionId: peerAttachment.connectionId,
      status: "matching",
      profile: peerProfile,
      pairedConnectionId: attachment.connectionId,
      roomId
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
              interests: profile.interests
            }
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
              interests: peerProfile.interests
            }
          },
          this.env.ROOM_TICKET_SECRET
        )
      ]);
    } catch {
      this.restoreToWaiting(ws, roomId);
      this.restoreToWaiting(peer, roomId);
      sendEvent(ws, "error", {
        code: "ticket_generation_failed",
        message: "Matching is temporarily unavailable. Please retry."
      });
      sendEvent(peer, "error", {
        code: "ticket_generation_failed",
        message: "Matching is temporarily unavailable. Please retry."
      });
      return;
    }
    if (ws.readyState !== OPEN || peer.readyState !== OPEN) {
      this.restoreToWaiting(ws, roomId);
      this.restoreToWaiting(peer, roomId);
      return;
    }
    const latestA = getAttachment(ws);
    const latestB = getAttachment(peer);
    if (latestA.status !== "matching" || latestB.status !== "matching" || latestA.roomId !== roomId || latestB.roomId !== roomId) {
      return;
    }
    ws.serializeAttachment({
      connectionId: latestA.connectionId,
      status: "matched"
    });
    peer.serializeAttachment({
      connectionId: latestB.connectionId,
      status: "matched"
    });
    sendEvent(ws, "matched", {
      roomId,
      ticket: ticketA,
      expiresAt: exp,
      peer: {
        preferredName: peerProfile.preferredName,
        interests: peerProfile.interests
      }
    });
    sendEvent(peer, "matched", {
      roomId,
      ticket: ticketB,
      expiresAt: exp,
      peer: {
        preferredName: profile.preferredName,
        interests: profile.interests
      }
    });
    ws.close(1e3, "Match found");
    peer.close(1e3, "Match found");
  }
  countWaiting() {
    return this.ctx.getWebSockets().filter((ws) => getAttachment(ws).status === "waiting").length;
  }
  restoreToWaiting(ws, roomId) {
    if (ws.readyState !== OPEN) {
      return;
    }
    const current = getAttachment(ws);
    if (current.status !== "matching" || current.roomId !== roomId || !current.profile) {
      return;
    }
    ws.serializeAttachment({
      connectionId: current.connectionId,
      status: "waiting",
      profile: current.profile,
      queuedAt: current.queuedAt ?? Date.now()
    });
    sendEvent(ws, "queued", {
      waitingCount: this.countWaiting(),
      reason: "partner_disconnected"
    });
  }
  handleDisconnect(ws) {
    const attachment = getAttachment(ws);
    if (attachment.status !== "matching" || !attachment.pairedConnectionId) {
      return;
    }
    const peer = this.ctx.getWebSockets().find((candidate) => {
      if (candidate === ws || candidate.readyState !== OPEN) {
        return false;
      }
      return getAttachment(candidate).connectionId === attachment.pairedConnectionId;
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
};

// src/durable-objects/ChatRoom.js
import { DurableObject as DurableObject2 } from "cloudflare:workers";
var OPEN2 = 1;
var CHAT_PROTOCOL = "swiftchat.v1";
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function getAttachment2(ws) {
  return ws.deserializeAttachment() ?? {};
}
__name(getAttachment2, "getAttachment");
function sendEvent2(ws, type, payload = {}) {
  if (ws.readyState !== OPEN2) {
    return;
  }
  ws.send(JSON.stringify({
    v: 1,
    type,
    payload
  }));
}
__name(sendEvent2, "sendEvent");
function readTicket(request) {
  const offeredProtocols = request.headers.get("Sec-WebSocket-Protocol") ?? "";
  const ticketProtocol = offeredProtocols.split(",").map((protocol) => protocol.trim()).find((protocol) => protocol.startsWith("ticket."));
  return ticketProtocol ? ticketProtocol.slice("ticket.".length) : null;
}
__name(readTicket, "readTicket");
var ChatRoom = class extends DurableObject2 {
  static {
    __name(this, "ChatRoom");
  }
  async fetch(request) {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", {
        status: 426
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
        status: 401
      });
    }
    const currentSockets = this.openConnections();
    if (currentSockets.length >= 2) {
      return new Response("Room is full", { status: 409 });
    }
    const slotAlreadyOccupied = currentSockets.some(
      (socket) => getAttachment2(socket).slot === claims.slot
    );
    if (slotAlreadyOccupied) {
      return new Response("Participant slot is already occupied", {
        status: 409
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
      messageCount: 0
    });
    const participants = this.openConnections();
    if (participants.length === 1) {
      sendEvent2(server, "waiting_for_peer");
    } else if (participants.length === 2) {
      const first = participants[0];
      const second = participants[1];
      const firstProfile = getAttachment2(first).profile;
      const secondProfile = getAttachment2(second).profile;
      sendEvent2(first, "ready", {
        peer: secondProfile
      });
      sendEvent2(second, "ready", {
        peer: firstProfile
      });
    }
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        "Sec-WebSocket-Protocol": CHAT_PROTOCOL
      }
    });
  }
  openConnections() {
    return this.ctx.getWebSockets().filter((socket) => socket.readyState === OPEN2);
  }
  findPeer(ws) {
    return this.openConnections().find(
      (candidate) => candidate !== ws && getAttachment2(candidate).status === "connected"
    );
  }
  allowMessage(ws) {
    const state = getAttachment2(ws);
    const now = Date.now();
    let windowStart = state.rateWindowStart;
    let messageCount = state.messageCount;
    if (!Number.isFinite(windowStart) || now - windowStart >= 5e3) {
      windowStart = now;
      messageCount = 0;
    }
    messageCount += 1;
    ws.serializeAttachment({
      ...state,
      rateWindowStart: windowStart,
      messageCount
    });
    return messageCount <= 15;
  }
  webSocketMessage(ws, rawMessage) {
    const state = getAttachment2(ws);
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
      sendEvent2(ws, "error", {
        code: "invalid_json",
        message: "Send a valid JSON event."
      });
      return;
    }
    if (!event || typeof event !== "object" || event.v !== 1 || typeof event.type !== "string") {
      sendEvent2(ws, "error", {
        code: "invalid_event",
        message: "Invalid chat event."
      });
      return;
    }
    if (event.type === "leave") {
      this.endRoom("left", ws);
      return;
    }
    if (event.type !== "message" && event.type !== "typing") {
      sendEvent2(ws, "error", {
        code: "unknown_event",
        message: "Unsupported chat event."
      });
      return;
    }
    if (!this.allowMessage(ws)) {
      sendEvent2(ws, "error", {
        code: "rate_limited",
        message: "Slow down and try again shortly."
      });
      return;
    }
    const peer = this.findPeer(ws);
    if (!peer) {
      this.endRoom("peer_disconnected", ws);
      return;
    }
    if (event.type === "typing") {
      sendEvent2(peer, "typing", {
        isTyping: event.payload?.isTyping === true,
        senderName: state.profile.preferredName
      });
      return;
    }
    const text = event.payload?.text;
    if (typeof text !== "string") {
      sendEvent2(ws, "error", {
        code: "invalid_message",
        message: "Message text must be a string."
      });
      return;
    }
    const trimmedText = text.trim();
    if (trimmedText.length === 0 || trimmedText.length > 2e3) {
      sendEvent2(ws, "error", {
        code: "invalid_message",
        message: "Messages must contain 1\u20132000 characters."
      });
      return;
    }
    const requestedId = event.payload?.id;
    const messageId = typeof requestedId === "string" && UUID_PATTERN.test(requestedId) ? requestedId : crypto.randomUUID();
    const sentAt = Date.now();
    sendEvent2(peer, "message", {
      id: messageId,
      text: trimmedText,
      senderName: state.profile.preferredName,
      sentAt
    });
    sendEvent2(ws, "message_sent", {
      id: messageId,
      sentAt
    });
  }
  endRoom(reason, initiator = null) {
    const sockets = this.openConnections();
    for (const socket of sockets) {
      const state = getAttachment2(socket);
      if (socket === initiator) {
        sendEvent2(socket, "ended", { reason });
      } else {
        sendEvent2(socket, "peer_left", { reason });
      }
      socket.serializeAttachment({
        ...state,
        status: "closing"
      });
    }
    for (const socket of sockets) {
      if (socket.readyState === OPEN2) {
        socket.close(1e3, "Chat ended");
      }
    }
  }
  webSocketClose(ws) {
    const state = getAttachment2(ws);
    if (state.status === "closing") {
      return;
    }
    this.endRoom("peer_disconnected");
  }
  webSocketError(ws) {
    const state = getAttachment2(ws);
    if (state.status !== "closing") {
      this.endRoom("connection_error");
    }
  }
};

// src/lib/origin-check.js
function isAllowedOrigin(origin, configuredOrigins) {
  if (!origin || typeof configuredOrigins !== "string") {
    return false;
  }
  const allowedOrigins = new Set(
    configuredOrigins.split(",").map((value) => value.trim()).filter(Boolean)
  );
  return allowedOrigins.has(origin);
}
__name(isAllowedOrigin, "isAllowedOrigin");

// src/index.js
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
__name(jsonResponse, "jsonResponse");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return jsonResponse(
          { error: "method_not_allowed" },
          405
        );
      }
      return jsonResponse({
        ok: true,
        service: "swiftchat-api",
        stage: "chat-room"
      });
    }
    const isMatchRoute = url.pathname === "/ws/match";
    const roomMatch = url.pathname.match(
      /^\/ws\/room\/([0-9a-f-]{36})$/i
    );
    if (!isMatchRoute && !roomMatch) {
      return jsonResponse({ error: "not_found" }, 404);
    }
    if (request.method !== "GET") {
      return jsonResponse(
        { error: "method_not_allowed" },
        405
      );
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return jsonResponse(
        { error: "websocket_upgrade_required" },
        426
      );
    }
    if (!isAllowedOrigin(
      request.headers.get("Origin"),
      env.ALLOWED_ORIGINS
    )) {
      return jsonResponse(
        { error: "origin_not_allowed" },
        403
      );
    }
    if (isMatchRoute) {
      const id2 = env.MATCHMAKER.idFromName("main");
      const matchmaker = env.MATCHMAKER.get(id2);
      return matchmaker.fetch(request);
    }
    const roomId = roomMatch[1].toLowerCase();
    const id = env.CHAT_ROOM.idFromName(roomId);
    const room = env.CHAT_ROOM.get(id);
    return room.fetch(request);
  }
};

// ../../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-TMjomO/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-TMjomO/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  ChatRoom,
  Matchmaker,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
