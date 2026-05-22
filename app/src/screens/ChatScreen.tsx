import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';

import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../services/socket';
import * as api from '../services/api';
import MessageBubble from '../components/MessageBubble';
import MessageActions from '../components/MessageActions';
import ChatInput from '../components/ChatInput';
import Avatar from '../components/Avatar';
import { COLORS, SPACING } from '../utils/constants';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

const EMPTY_TYPING: any[] = [];

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

  const typingUsers = useUIStore((state) => state.typingUsers[conversationId] ?? EMPTY_TYPING);
  const onlineUsers = useUIStore((state) => state.onlineUsers);

  // Filter out self
  const otherTypingUsers = typingUsers.filter((u) => u.userId !== currentUserId);

  // Determine active status subtitle
  let isOnline = false;
  if (!isGroup && conversation?.type === 'dm') {
    const otherUser = conversation.otherUser;
    if (otherUser) {
      isOnline = onlineUsers[otherUser.id] ?? false;
    }
  }

  // States for actions, replying, and editing
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);

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
      try {
        await api.api.patch(`/messages/${editingMessage.id}`, { content: text });
      } catch (err) {
        console.error('Failed to edit message:', err);
      } finally {
        setEditingMessage(null);
      }
    } else {
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
        await api.removeReaction(messageId, emoji);
      } else {
        await api.addReaction(messageId, emoji);
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  }

  // Double-tap instantly adds ❤️ reaction
  function handleDoubleTap(messageId: string) {
    handleReactionPress(messageId, '❤️');
  }

  // Message long press overlay options
  function handleLongPress(message: any) {
    setSelectedMessage(message);
    setActionsVisible(true);
  }

  // Coming soon alerts
  function handleCallPress(type: 'audio' | 'video') {
    Alert.alert(
      'Coming Soon!',
      `Homie is getting high-quality ${type} calls in a future update! Stay tuned. 🚀`,
      [{ text: 'Cool!' }]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Custom Instagram DMs Header */}
      <View style={styles.customHeader}>
        <View style={styles.headerLeftContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarAndName}
            onPress={() => {
              if (isGroup) {
                navigation.navigate('GroupInfo', { conversationId });
              }
            }}
            activeOpacity={isGroup ? 0.7 : 1}
          >
            <Avatar
              name={name}
              avatarUrl={conversation?.avatar_url ?? conversation?.otherUser?.avatar_url}
              size={36}
              isOnline={!isGroup && isOnline}
            />
            <View style={styles.headerDetails}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.headerSubtitle}>
                {isGroup
                  ? `${conversation?.members?.length ?? 0} members`
                  : isOnline
                  ? 'Active now'
                  : 'Active recently'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Right side icons: Phone, Video */}
        <View style={styles.headerRightContainer}>
          <TouchableOpacity onPress={() => handleCallPress('audio')} style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>📞</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleCallPress('video')} style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>📹</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
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
            const nextItem = index > 0 ? chatMessages[index - 1] : null;
            const showName = isGroup && item.sender_id !== currentUserId && nextItem?.sender_id !== item.sender_id;

            return (
              <MessageBubble
                message={item}
                showSenderName={showName}
                onLongPress={() => handleLongPress(item)}
                onReactionPress={(emoji) => handleReactionPress(item.id, emoji)}
                onDoubleTap={() => handleDoubleTap(item.id)}
                onReply={(msg) => setReplyingTo(msg)}
              />
            );
          }}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.spinner}>
                <ActivityIndicator color={COLORS.accent} size="small" />
              </View>
            ) : null
          }
        />

        {/* Dynamic Typing indicator bubble inside the chat window */}
        {otherTypingUsers.length > 0 && (
          <View style={styles.typingBubbleContainer}>
            <View style={styles.typingAvatarWrapper}>
              <Avatar
                name={otherTypingUsers[0].userName}
                avatarUrl={null}
                size={24}
              />
            </View>
            <View style={styles.typingBubble}>
              <Text style={styles.typingBubbleText}>...</Text>
            </View>
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
    backgroundColor: '#000000', // Pure black
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#262626',
    backgroundColor: '#000000',
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backIcon: {
    fontSize: 34,
    color: '#ffffff',
    fontWeight: '300',
    marginTop: -4,
  },
  avatarAndName: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 4,
  },
  headerDetails: {
    marginLeft: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8e8e8e',
    marginTop: 1,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginRight: 6,
  },
  headerIconBtn: {
    padding: 6,
  },
  headerIcon: {
    fontSize: 18,
  },
  listContent: {
    paddingVertical: SPACING.md,
  },
  spinner: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  typingBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  typingAvatarWrapper: {
    marginBottom: 2,
  },
  typingBubble: {
    backgroundColor: '#1c1c1e',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  typingBubbleText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -4,
  },
});
