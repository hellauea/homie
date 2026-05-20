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

export default function ConversationItem({ conversation, onPress }: ConversationItemProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const typingUsersList = useUIStore((state) => state.typingUsers[conversation.id] ?? []);
  
  // Resolve conversation title and avatar
  let displayName = conversation.name ?? 'Chat';
  let avatarUrl = conversation.avatar_url;
  let isOnline = false;

  if (conversation.type === 'dm') {
    const otherUser = conversation.otherUser;
    if (otherUser) {
      displayName = otherUser.name;
      avatarUrl = otherUser.avatar_url;
      isOnline = useUIStore((state) => state.onlineUsers[otherUser.id] ?? false);
    }
  }

  // Determine message preview text
  let previewText = 'No messages yet';
  let previewTime = '';
  
  const lastMsg = conversation.last_message;

  if (typingUsersList.length > 0) {
    const names = typingUsersList.map((u) => u.userName.split(' ')[0]);
    previewText = `${names.join(', ')} typing...`;
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

  const isTyping = typingUsersList.length > 0;
  const unreadCount = conversation.unread_count ?? 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Avatar
        name={displayName}
        avatarUrl={avatarUrl}
        isOnline={conversation.type === 'dm' ? isOnline : false}
        size={50}
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {previewTime ? <Text style={styles.time}>{previewTime}</Text> : null}
        </View>
        
        <View style={styles.footer}>
          <Text
            style={[
              styles.preview,
              isTyping ? styles.typingText : null,
              unreadCount > 0 && !isTyping ? styles.unreadText : null,
            ]}
            numberOfLines={1}
          >
            {truncate(previewText, 45)}
          </Text>
          
          {unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#09090b', // Deep zinc black
    borderBottomWidth: 1,
    borderBottomColor: '#18181b', // Slight zinc divider
  },
  content: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  typingText: {
    color: COLORS.primaryLight,
    fontWeight: '500',
  },
  unreadText: {
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
