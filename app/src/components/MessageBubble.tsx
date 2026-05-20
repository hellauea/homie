import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Message } from '../types';
import { COLORS, SPACING } from '../utils/constants';
import { formatMessageTime } from '../utils/format';
import ReactionBar from './ReactionBar';
import { useAuthStore } from '../store/authStore';

interface MessageBubbleProps {
  message: Message;
  onLongPress: () => void;
  onReactionPress: (emoji: string) => void;
  showSenderName?: boolean;
}

export default function MessageBubble({
  message,
  onLongPress,
  onReactionPress,
  showSenderName = false,
}: MessageBubbleProps) {
  const currentUserId = useAuthStore((state) => state.user?.id) || '';
  const isSelf = message.sender_id === currentUserId;

  const isDeleted = message.type === 'deleted';

  // Render quoted reply preview if applicable
  const replyMsg = message.reply_to_message;

  return (
    <View style={[styles.container, isSelf ? styles.alignRight : styles.alignLeft]}>
      <View style={styles.bubbleWrapper}>
        {/* Group Sender Name */}
        {showSenderName && !isSelf && message.sender && (
          <Text style={styles.senderName}>{message.sender.name}</Text>
        )}

        {/* Quoted Message Preview */}
        {replyMsg && (
          <View style={[styles.replyContainer, isSelf ? styles.replySelf : styles.replyOther]}>
            <Text style={styles.replySender} numberOfLines={1}>
              {replyMsg.sender_id === currentUserId ? 'You' : replyMsg.sender?.name ?? 'Someone'}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyMsg.type === 'deleted' ? 'Deleted message' : replyMsg.content}
            </Text>
          </View>
        )}

        {/* Message Content Bubble */}
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={isDeleted ? undefined : onLongPress}
          delayLongPress={200}
          style={[
            styles.bubble,
            isSelf ? styles.bubbleSelf : styles.bubbleOther,
            isDeleted ? styles.bubbleDeleted : null,
          ]}
        >
          {isDeleted ? (
            <Text style={styles.deletedText}>🚫 Message deleted</Text>
          ) : (
            <Text style={[styles.messageText, isSelf ? styles.textSelf : styles.textOther]}>
              {message.content}
            </Text>
          )}

          {/* Time & Edited indicators */}
          <View style={styles.meta}>
            <Text style={[styles.time, isSelf ? styles.timeSelf : styles.timeOther]}>
              {formatMessageTime(message.created_at)}
              {message.is_edited ? ' • Edited' : ''}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <View style={isSelf ? styles.reactionsRight : styles.reactionsLeft}>
            <ReactionBar
              reactions={message.reactions}
              currentUserId={currentUserId}
              onReactionPress={onReactionPress}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    maxWidth: '85%',
  },
  alignRight: {
    alignSelf: 'flex-end',
  },
  alignLeft: {
    alignSelf: 'flex-start',
  },
  bubbleWrapper: {
    flexDirection: 'column',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 2,
    marginLeft: 6,
  },
  replyContainer: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryLight,
    paddingLeft: 8,
    paddingVertical: 4,
    paddingRight: 12,
    marginBottom: -4,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    opacity: 0.8,
  },
  replySelf: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyOther: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  replySender: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryLight,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: '#ddd',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 70,
  },
  bubbleSelf: {
    backgroundColor: COLORS.bubbleSelf,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.bubbleOther,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  bubbleDeleted: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#27272a',
    borderStyle: 'dashed',
  },
  deletedText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textSelf: {
    color: COLORS.textLight,
  },
  textOther: {
    color: COLORS.textPrimary,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 10,
  },
  timeSelf: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  timeOther: {
    color: COLORS.textSecondary,
  },
  reactionsLeft: {
    alignSelf: 'flex-start',
  },
  reactionsRight: {
    alignSelf: 'flex-end',
  },
});
