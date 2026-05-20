import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../services/socket';
import * as api from '../services/api';
import MessageBubble from '../components/MessageBubble';
import MessageActions from '../components/MessageActions';
import ChatInput from '../components/ChatInput';
import { COLORS, SPACING } from '../utils/constants';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { conversationId, name } = route.params;

  const currentUserId = useAuthStore((state) => state.user?.id) || '';
  const {
    messages,
    loadMessages,
    isLoadingMessages,
    conversations,
    hasMoreMap,
  } = useChatStore();

  const conversation = conversations.find((c) => c.id === conversationId);
  const isGroup = conversation?.type === 'group';

  const chatMessages = messages[conversationId] ?? [];
  const hasMore = hasMoreMap[conversationId] ?? true;
  const isLoading = isLoadingMessages[conversationId] ?? false;

  const typingUsers = useUIStore((state) => state.typingUsers[conversationId] ?? []);
  // Filter out self if any
  const otherTypingUsers = typingUsers.filter((u) => u.userId !== currentUserId);

  // States for actions, replying, and editing
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);

  // Set up header buttons
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: name,
      headerRight: () =>
        isGroup ? (
          <TouchableOpacity
            style={styles.headerInfoBtn}
            onPress={() => navigation.navigate('GroupInfo', { conversationId })}
          >
            <Text style={styles.headerInfoText}>ℹ️</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, name, isGroup, conversationId]);

  // Connect socket and join room
  useEffect(() => {
    const socket = getSocket();
    if (socket?.connected) {
      console.log('[Chat] Socket joining conversation:', conversationId);
      socket.emit('join_conversation', { conversationId });
    }

    // Load initial messages
    loadMessages(conversationId, false);

    return () => {
      if (socket?.connected) {
        console.log('[Chat] Socket leaving conversation:', conversationId);
        socket.emit('leave_conversation', { conversationId });
      }
    };
  }, [conversationId]);

  // Scroll pagination trigger
  function handleLoadMore() {
    if (hasMore && !isLoading) {
      loadMessages(conversationId, true);
    }
  }

  // Send message or edit message
  async function handleSend(text: string, type: 'text' | 'image' | 'video' | 'file' | 'voice' = 'text') {
    if (editingMessage) {
      // Edit mode (only text editing is supported)
      try {
        await api.api.patch(`/messages/${editingMessage.id}`, { content: text });
      } catch (err) {
        console.error('Failed to edit message:', err);
      } finally {
        setEditingMessage(null);
      }
    } else {
      // Send mode (via socket for instant broadcast)
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('send_message', {
          conversationId,
          content: text,
          type,
          replyToId: replyingTo?.id,
        });
      }
      setReplyingTo(null);
    }
  }

  // Handle reaction toggle
  async function handleReactionPress(messageId: string, emoji: string) {
    const msg = chatMessages.find((m) => m.id === messageId);
    if (!msg) return;

    const existingReaction = msg.reactions?.find(
      (r) => r.emoji === emoji && r.user_id === currentUserId
    );

    try {
      if (existingReaction) {
        // Remove reaction
        await api.removeReaction(messageId, emoji);
      } else {
        // Add reaction
        await api.addReaction(messageId, emoji);
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  }

  // Message long press overlay options
  function handleLongPress(message: any) {
    setSelectedMessage(message);
    setActionsVisible(true);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages List (Inverted for newest at bottom) */}
        <FlatList
          data={chatMessages}
          keyExtractor={(item) => item.id}
          inverted
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            // Determine if we show sender name (only in groups, if sender is different than user, and next message is not from same sender)
            const nextItem = index > 0 ? chatMessages[index - 1] : null;
            const showName = isGroup && item.sender_id !== currentUserId && nextItem?.sender_id !== item.sender_id;

            return (
              <MessageBubble
                message={item}
                showSenderName={showName}
                onLongPress={() => handleLongPress(item)}
                onReactionPress={(emoji) => handleReactionPress(item.id, emoji)}
              />
            );
          }}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.spinner}>
                <ActivityIndicator color={COLORS.primary} size="small" />
              </View>
            ) : null
          }
        />

        {/* Dynamic Typing indicator bubble inside the chat window */}
        {otherTypingUsers.length > 0 && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>
              {otherTypingUsers.map((u) => u.userName.split(' ')[0]).join(', ')}{' '}
              {otherTypingUsers.length === 1 ? 'is' : 'are'} typing...
            </Text>
          </View>
        )}

        {/* Input box */}
        <ChatInput
          conversationId={conversationId}
          onSend={handleSend}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
        />
      </KeyboardAvoidingView>

      {/* Message Options sheet */}
      <MessageActions
        visible={actionsVisible}
        message={selectedMessage}
        onClose={() => {
          setActionsVisible(false);
          setSelectedMessage(null);
        }}
        onReact={(emoji) => handleReactionPress(selectedMessage.id, emoji)}
        onReply={(msg) => setReplyingTo(msg)}
        onEdit={(msg) => setEditingMessage(msg)}
        onDelete={async (msg) => {
          try {
            await api.deleteMessage(msg.id);
          } catch (err) {
            console.error('Failed to delete message:', err);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  listContent: {
    paddingVertical: SPACING.md,
  },
  spinner: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  headerInfoBtn: {
    marginRight: SPACING.md,
    paddingHorizontal: 8,
  },
  headerInfoText: {
    fontSize: 20,
  },
  typingContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    backgroundColor: 'transparent',
  },
  typingText: {
    color: COLORS.primaryLight,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
