import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Clipboard,
} from 'react-native';
import { Message } from '../types';
import { COLORS, SPACING } from '../utils/constants';

interface MessageActionsProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

export default function MessageActions({
  visible,
  message,
  onClose,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: MessageActionsProps) {
  if (!message) return null;

  const currentUserId = useAuthStoreState();
  const isSelf = message.sender_id === currentUserId;

  // 5-minute edit window check
  const createdAt = new Date(message.created_at).getTime();
  const isEditable = isSelf && (Date.now() - createdAt < 5 * 60 * 1000) && message.type !== 'deleted';
  const isDeletable = isSelf && message.type !== 'deleted';

  function handleCopy() {
    if (message?.content) {
      Clipboard.setString(message.content);
    }
    onClose();
  }

  function handleReplyClick() {
    if (message) {
      onReply(message);
    }
    onClose();
  }

  function handleEditClick() {
    if (message) {
      onEdit(message);
    }
    onClose();
  }

  function handleDeleteClick() {
    if (message) {
      onDelete(message);
    }
    onClose();
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Emojis row */}
              <View style={styles.emojiRow}>
                {EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.emojiButton}
                    onPress={() => {
                      onReact(emoji);
                      onClose();
                    }}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action list */}
              <View style={styles.actionList}>
                <TouchableOpacity style={styles.actionButton} onPress={handleReplyClick}>
                  <Text style={styles.actionButtonText}>💬 Reply & Quote</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
                  <Text style={styles.actionButtonText}>📋 Copy Text</Text>
                </TouchableOpacity>

                {isEditable && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleEditClick}>
                    <Text style={[styles.actionButtonText, styles.editAction]}>✏️ Edit Message</Text>
                  </TouchableOpacity>
                )}

                {isDeletable && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleDeleteClick}>
                    <Text style={[styles.actionButtonText, styles.deleteAction]}>🗑️ Delete for Everyone</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// Inline helper to avoid loading React hooks outside render
import { useAuthStore } from '../store/authStore';
function useAuthStoreState() {
  return useAuthStore((state) => state.user?.id) || '';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#18181b', // slate card
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    marginBottom: SPACING.sm,
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 26,
  },
  actionList: {
    paddingTop: SPACING.sm,
  },
  actionButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  editAction: {
    color: COLORS.secondary,
  },
  deleteAction: {
    color: COLORS.danger,
  },
  cancelButton: {
    marginTop: SPACING.md,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
});
