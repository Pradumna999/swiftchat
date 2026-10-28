
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Health check: confirms that the backend is responding.
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
        stage: "health-check"
      });
    }

    // Unknown routes should not pretend to succeed.
    return jsonResponse(
      {
        error: "not_found",
        message: "This API route does not exist yet."
      },
      404
    );
  }
};
