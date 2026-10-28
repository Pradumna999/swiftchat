const MAX_VISIBLE_MESSAGES = 200;

export function chatReducer(state, action) {
  switch (action.type) {
    case "ADD_LOCAL":
      return [...state, action.message].slice(-MAX_VISIBLE_MESSAGES);

    case "ADD_REMOTE":
      if (state.some((message) => message.id === action.message.id)) {
        return state;
      }

      return [...state, action.message].slice(-MAX_VISIBLE_MESSAGES);

    case "ACK":
      return state.map((message) =>
        message.id === action.id
          ? {
              ...message,
              status: "sent",
              sentAt: action.sentAt ?? message.sentAt,
            }
          : message
      );

    case "CLEAR":
      return [];

    default:
      return state;
  }
}