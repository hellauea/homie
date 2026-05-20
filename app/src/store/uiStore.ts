import { create } from 'zustand';

interface TypingIndicator {
  userId: string;
  userName: string;
  timestamp: number;
}

interface UIState {
  typingUsers: Record<string, TypingIndicator[]>; // keyed by conversationId
  onlineUsers: Record<string, boolean>;           // keyed by userId

  // Actions
  setTyping: (conversationId: string, userId: string, userName: string, isTyping: boolean) => void;
  cleanupTyping: (conversationId: string) => void;
  setOnline: (userId: string, isOnline: boolean) => void;
  setBulkOnline: (users: Record<string, boolean>) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  typingUsers: {},
  onlineUsers: {},

  setTyping: (conversationId, userId, userName, isTyping) =>
    set((state) => {
      const current = state.typingUsers[conversationId] ?? [];
      let updated: TypingIndicator[];

      if (isTyping) {
        // Filter out any existing typing entry for this user to update timestamp
        const filtered = current.filter((t) => t.userId !== userId);
        updated = [...filtered, { userId, userName, timestamp: Date.now() }];
      } else {
        updated = current.filter((t) => t.userId !== userId);
      }

      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: updated,
        },
      };
    }),

  cleanupTyping: (conversationId) =>
    set((state) => {
      const current = state.typingUsers[conversationId] ?? [];
      const fiveSecondsAgo = Date.now() - 5000;
      const active = current.filter((t) => t.timestamp > fiveSecondsAgo);

      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: active,
        },
      };
    }),

  setOnline: (userId, isOnline) =>
    set((state) => ({
      onlineUsers: {
        ...state.onlineUsers,
        [userId]: isOnline,
      },
    })),

  setBulkOnline: (users) =>
    set((state) => ({
      onlineUsers: {
        ...state.onlineUsers,
        ...users,
      },
    })),
}));
