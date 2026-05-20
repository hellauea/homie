import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Message } from '../types';
import { COLORS, SPACING } from '../utils/constants';
import { getSocket } from '../services/socket';

interface ChatInputProps {
  conversationId: string;
  onSend: (text: string) => void;
  replyingTo: Message | null;
  onCancelReply: () => void;
  editingMessage: Message | null;
  onCancelEdit: () => void;
}

export default function ChatInput({
  conversationId,
  onSend,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Focus input automatically on edit/reply modes
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content ?? '');
      inputRef.current?.focus();
    } else {
      setText('');
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  // Clean up typing timers on unmount
  useEffect(() => {
    return () => {
      stopTypingIndicator();
    };
  }, [conversationId]);

  function startTypingIndicator() {
    const socket = getSocket();
    if (!socket?.connected) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing_start', { conversationId });
    }

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTypingIndicator();
    }, 3000);
  }

  function stopTypingIndicator() {
    const socket = getSocket();
    if (socket?.connected && isTypingRef.current) {
      socket.emit('typing_stop', { conversationId });
      isTypingRef.current = false;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }

  function handleTextChange(newText: string) {
    setText(newText);
    if (newText.trim().length > 0) {
      startTypingIndicator();
    } else {
      stopTypingIndicator();
    }
  }

  function handleSend() {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    onSend(trimmed);
    setText('');
    stopTypingIndicator();
  }

  return (
    <View style={styles.container}>
      {/* Replying indicator panel */}
      {replyingTo && (
        <View style={styles.stateBar}>
          <View style={styles.stateLeft}>
            <Text style={styles.stateLabel}>Replying to {replyingTo.sender?.name ?? 'Someone'}</Text>
            <Text style={styles.statePreview} numberOfLines={1}>
              {replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onCancelReply}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Editing indicator panel */}
      {editingMessage && (
        <View style={styles.stateBar}>
          <View style={styles.stateLeft}>
            <Text style={[styles.stateLabel, styles.editLabel]}>Editing message</Text>
            <Text style={styles.statePreview} numberOfLines={1}>
              {editingMessage.content}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onCancelEdit}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input textbox row */}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Send a message..."
          placeholderTextColor={COLORS.textMuted}
          style={styles.textInput}
          multiline
          maxLength={1000}
        />
        
        <TouchableOpacity
          style={[styles.sendButton, text.trim().length === 0 ? styles.sendButtonDisabled : null]}
          disabled={text.trim().length === 0}
          onPress={handleSend}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#18181b',
    padding: SPACING.sm,
  },
  stateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  stateLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  stateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryLight,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  editLabel: {
    color: COLORS.secondary,
  },
  statePreview: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#18181b',
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  textInput: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 28,
    paddingTop: Platform.OS === 'ios' ? 4 : 0,
    paddingBottom: Platform.OS === 'ios' ? 4 : 0,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
