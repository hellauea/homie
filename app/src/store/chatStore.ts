import { create } from 'zustand';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'deleted';
  content: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  type: 'dm' | 'group';
  name: string | null;
  avatar_url: string | null;
  last_message?: Message | null;
  unread_count?: number;
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>; // keyed by conversation_id
  activeConversationId: string | null;

  setConversations: (convs: Conversation[]) => void;
  setMessages: (conversationId: string, msgs: Message[]) => void;
  appendMessage: (msg: Message) => void;
  setActiveConversation: (id: string | null) => void;
  updateMessage: (msg: Message) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,

  setConversations: (convs) => set({ conversations: convs }),

  setMessages: (conversationId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: msgs },
    })),

  appendMessage: (msg) =>
    set((state) => {
      const existing = state.messages[msg.conversation_id] ?? [];
      return {
        messages: {
          ...state.messages,
          [msg.conversation_id]: [...existing, msg],
        },
      };
    }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  updateMessage: (msg) =>
    set((state) => {
      const existing = state.messages[msg.conversation_id] ?? [];
      return {
        messages: {
          ...state.messages,
          [msg.conversation_id]: existing.map((m) =>
            m.id === msg.id ? msg : m
          ),
        },
      };
    }),
}));
