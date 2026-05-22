import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Conversation } from '../types';
import Avatar from './Avatar';
import { COLORS, SPACING, TYPOGRAPHY } from '../utils/constants';
import { formatConversationDate, truncate } from '../utils/format';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

const EMPTY_TYPING: any[] = [];

export default function ConversationItem({ conversation, onPress }: ConversationItemProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const typingUsersList = useUIStore((state) => state.typingUsers[conversation.id] ?? EMPTY_TYPING);
  const onlineUsers = useUIStore((state) => state.onlineUsers);

  // Resolve display info for DM vs group
  let displayName = conversation.name ?? (conversation.type === 'group' ? 'Group' : 'Chat');
  let avatarUrl = conversation.avatar_url;
  let isOnline = false;

  if (conversation.type === 'dm') {
    const otherUser = conversation.otherUser;
    if (otherUser) {
      displayName = otherUser.name;
      avatarUrl = otherUser.avatar_url;
      isOnline = onlineUsers[otherUser.id] ?? false;
    }
  }

  // Build preview text
  let previewText = 'No messages yet';
  let previewTime = '';

  const lastMsg = conversation.last_message;
  const isTyping = typingUsersList.length > 0;

  if (isTyping) {
    previewText = 'typing...';
  } else if (lastMsg) {
    previewTime = formatConversationDate(lastMsg.created_at);

    const isSelf = lastMsg.sender_id === currentUserId;
    const prefix = isSelf ? 'You: ' : '';

    if (lastMsg.type === 'deleted') {
      previewText = 'Deleted message';
    } else if (lastMsg.type === 'text') {
      previewText = prefix + (lastMsg.content ?? '');
    } else {
      previewText = prefix + `Sent a ${lastMsg.type}`;
    }
  }

  const unreadCount = conversation.unread_count ?? 0;
  const hasUnread = unreadCount > 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.6}>
      <Avatar
        name={displayName}
        avatarUrl={avatarUrl}
        isOnline={conversation.type === 'dm' ? isOnline : false}
        size={56}
      />

      <View style={styles.content}>
        {/* Top row: name + timestamp */}
        <View style={styles.topRow}>
          <Text
            style={[styles.name, hasUnread && styles.nameUnread]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {previewTime ? (
            <Text style={styles.timestamp}>{previewTime}</Text>
          ) : null}
        </View>

        {/* Bottom row: preview + unread dot */}
        <View style={styles.bottomRow}>
          <Text
            style={[styles.preview, isTyping && styles.previewTyping]}
            numberOfLines={1}
          >
            {truncate(previewText, 45)}
          </Text>
          {hasUnread && !isTyping ? <View style={styles.unreadDot} /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  nameUnread: {
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  previewTyping: {
    color: COLORS.onlineGreen,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginLeft: 8,
  },
});
