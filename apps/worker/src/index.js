
import { Matchmaker } from "./durable-objects/Matchmaker.js";
import { ChatRoom } from "./durable-objects/ChatRoom.js";
import { isAllowedOrigin } from "./lib/origin-check.js";

export { Matchmaker, ChatRoom };

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default {
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
        stage: "chat-room",
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

    if (
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return jsonResponse(
        { error: "websocket_upgrade_required" },
        426
      );
    }

    if (
      !isAllowedOrigin(
        request.headers.get("Origin"),
        env.ALLOWED_ORIGINS
      )
    ) {
      return jsonResponse(
        { error: "origin_not_allowed" },
        403
      );
    }

    if (isMatchRoute) {
      const id = env.MATCHMAKER.idFromName("main");
      const matchmaker = env.MATCHMAKER.get(id);

      return matchmaker.fetch(request);
    }

    const roomId = roomMatch[1].toLowerCase();
    const id = env.CHAT_ROOM.idFromName(roomId);
    const room = env.CHAT_ROOM.get(id);

    return room.fetch(request);
  },
};
