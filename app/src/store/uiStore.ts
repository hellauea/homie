import { create } from 'zustand';

interface TypingState {
  [conversationId: string]: string[]; // array of user IDs typing
}

interface UIState {
  typingUsers: TypingState;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  typingUsers: {},

  setTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const current = state.typingUsers[conversationId] ?? [];
      const updated = isTyping
        ? [...new Set([...current, userId])]
        : current.filter((id) => id !== userId);
      return {
        typingUsers: { ...state.typingUsers, [conversationId]: updated },
      };
    }),
}));
