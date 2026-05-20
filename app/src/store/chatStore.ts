import { create } from 'zustand';
import { Conversation, Message, MessageReaction, User } from '../types';
import * as api from '../services/api';
import { useAuthStore } from './authStore';

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>; // keyed by conversation_id
  activeConversationId: string | null;
  
  // Paging metadata per conversation
  nextCursors: Record<string, string | null>;
  hasMoreMap: Record<string, boolean>;
  isLoadingConversations: boolean;
  isLoadingMessages: Record<string, boolean>;

  // Actions
  setConversations: (convs: Conversation[]) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string, loadMore?: boolean) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  
  // Real-time Event Mutation Helpers
  appendMessage: (msg: Message) => void;
  updateMessage: (msg: Message) => void;
  removeMessage: (conversationId: string, msgId: string) => void;
  updateConversationLastMessage: (conversationId: string, msg: Message) => void;
  addLocalReaction: (messageId: string, userId: string, emoji: string) => void;
  removeLocalReaction: (messageId: string, userId: string, emoji: string) => void;
  markConversationRead: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  nextCursors: {},
  hasMoreMap: {},
  isLoadingConversations: false,
  isLoadingMessages: {},

  setConversations: (convs) => set({ conversations: convs }),

  loadConversations: async () => {
    if (get().isLoadingConversations) return;
    set({ isLoadingConversations: true });
    try {
      const convs = await api.getConversations();
      const currentUserId = useAuthStore.getState().user?.id;
      
      // Post-process conversations to resolve "otherUser" for DM conversations
      const enrichedConvs = convs.map((conv) => {
        let otherUser: User | undefined;
        if (conv.type === 'dm' && conv.members) {
          const otherMember = conv.members.find((m) => m.user_id !== currentUserId);
          if (otherMember) {
            otherUser = otherMember.user;
          }
        }
        return {
          ...conv,
          otherUser,
        };
      });

      // Sort conversations by last message timestamp or creation timestamp
      enrichedConvs.sort((a, b) => {
        const timeA = new Date(a.last_message?.created_at ?? a.created_at).getTime();
        const timeB = new Date(b.last_message?.created_at ?? b.created_at).getTime();
        return timeB - timeA;
      });

      set({ conversations: enrichedConvs });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (conversationId, loadMore = false) => {
    const isAlreadyLoading = get().isLoadingMessages[conversationId];
    if (isAlreadyLoading) return;

    const hasMore = get().hasMoreMap[conversationId] ?? true;
    if (loadMore && !hasMore) return;

    set((state) => ({
      isLoadingMessages: { ...state.isLoadingMessages, [conversationId]: true },
    }));

    try {
      const cursor = loadMore ? (get().nextCursors[conversationId] ?? undefined) : undefined;
      const { messages: fetchedMsgs, nextCursor: responseNextCursor } = await api.getMessages(conversationId, cursor);
      
      set((state) => {
        const existing = state.messages[conversationId] ?? [];
        
        // Merge & Deduplicate messages
        let merged: Message[];
        if (loadMore) {
          // Prepend older messages (fetchedMsgs are in descending order)
          const existingIds = new Set(existing.map((m) => m.id));
          const newUnique = fetchedMsgs.filter((m) => !existingIds.has(m.id));
          merged = [...existing, ...newUnique];
        } else {
          merged = fetchedMsgs;
        }

        // Sort descending (newest first) for inversion lists
        merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Track pagination
        const hasMoreForThis = fetchedMsgs.length === 30 && responseNextCursor !== null;

        return {
          messages: {
            ...state.messages,
            [conversationId]: merged,
          },
          nextCursors: {
            ...state.nextCursors,
            [conversationId]: responseNextCursor,
          },
          hasMoreMap: {
            ...state.hasMoreMap,
            [conversationId]: hasMoreForThis,
          },
        };
      });
    } catch (err) {
      console.error(`Failed to load messages for conversation ${conversationId}:`, err);
    } finally {
      set((state) => ({
        isLoadingMessages: { ...state.isLoadingMessages, [conversationId]: false },
      }));
    }
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  appendMessage: (msg) =>
    set((state) => {
      const existing = state.messages[msg.conversation_id] ?? [];
      
      // Deduplicate checks
      if (existing.some((m) => m.id === msg.id)) {
        return state;
      }
      
      const updatedMessages = [msg, ...existing]; // Newest first (descending)
      
      // Update last message in the conversation row
      const updatedConversations = state.conversations.map((conv) => {
        if (conv.id === msg.conversation_id) {
          const isCurrentActive = state.activeConversationId === conv.id;
          return {
            ...conv,
            last_message: msg,
            unread_count: isCurrentActive ? 0 : (conv.unread_count ?? 0) + 1,
          };
        }
        return conv;
      });

      // Re-sort conversation list by active timestamp
      updatedConversations.sort((a, b) => {
        const timeA = new Date(a.last_message?.created_at ?? a.created_at).getTime();
        const timeB = new Date(b.last_message?.created_at ?? b.created_at).getTime();
        return timeB - timeA;
      });

      return {
        messages: {
          ...state.messages,
          [msg.conversation_id]: updatedMessages,
        },
        conversations: updatedConversations,
      };
    }),

  updateMessage: (msg) =>
    set((state) => {
      const existing = state.messages[msg.conversation_id] ?? [];
      const updated = existing.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
      
      // Also update last message in conversation row if applicable
      const updatedConversations = state.conversations.map((conv) => {
        if (conv.id === msg.conversation_id && conv.last_message?.id === msg.id) {
          return {
            ...conv,
            last_message: { ...conv.last_message, ...msg },
          };
        }
        return conv;
      });

      return {
        messages: {
          ...state.messages,
          [msg.conversation_id]: updated,
        },
        conversations: updatedConversations,
      };
    }),

  removeMessage: (conversationId, msgId) =>
    set((state) => {
      const existing = state.messages[conversationId] ?? [];
      const updated = existing.map((m) => 
        m.id === msgId ? { ...m, type: 'deleted' as const, content: null } : m
      );

      const updatedConversations = state.conversations.map((conv) => {
        if (conv.id === conversationId && conv.last_message?.id === msgId) {
          return {
            ...conv,
            last_message: { ...conv.last_message, type: 'deleted' as const, content: null } as Message,
          };
        }
        return conv;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: updated,
        },
        conversations: updatedConversations,
      };
    }),

  updateConversationLastMessage: (conversationId, msg) =>
    set((state) => {
      const updatedConversations = state.conversations.map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            last_message: msg,
          };
        }
        return conv;
      });
      
      updatedConversations.sort((a, b) => {
        const timeA = new Date(a.last_message?.created_at ?? a.created_at).getTime();
        const timeB = new Date(b.last_message?.created_at ?? b.created_at).getTime();
        return timeB - timeA;
      });

      return { conversations: updatedConversations };
    }),

  addLocalReaction: (messageId, userId, emoji) =>
    set((state) => {
      const messagesRecord = { ...state.messages };
      
      for (const convId of Object.keys(messagesRecord)) {
        const list = messagesRecord[convId] ?? [];
        const index = list.findIndex((m) => m.id === messageId);
        if (index !== -1) {
          const msg = list[index];
          const reactions = msg.reactions ? [...msg.reactions] : [];
          
          if (!reactions.some((r) => r.user_id === userId && r.emoji === emoji)) {
            reactions.push({ emoji, user_id: userId });
          }
          
          const updatedMsg = { ...msg, reactions };
          const updatedList = [...list];
          updatedList[index] = updatedMsg;
          messagesRecord[convId] = updatedList;
          break; // Stop looking, found it
        }
      }

      return { messages: messagesRecord };
    }),

  removeLocalReaction: (messageId, userId, emoji) =>
    set((state) => {
      const messagesRecord = { ...state.messages };
      
      for (const convId of Object.keys(messagesRecord)) {
        const list = messagesRecord[convId] ?? [];
        const index = list.findIndex((m) => m.id === messageId);
        if (index !== -1) {
          const msg = list[index];
          const reactions = msg.reactions
            ? msg.reactions.filter((r) => !(r.user_id === userId && r.emoji === emoji))
            : [];
          
          const updatedMsg = { ...msg, reactions };
          const updatedList = [...list];
          updatedList[index] = updatedMsg;
          messagesRecord[convId] = updatedList;
          break;
        }
      }

      return { messages: messagesRecord };
    }),

  markConversationRead: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
      ),
    })),
}));
