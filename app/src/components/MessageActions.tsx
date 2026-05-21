import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Clipboard,
  Alert,
} from 'react-native';
import { Message } from '../types';
import { COLORS, SPACING } from '../utils/constants';
import { useAuthStore } from '../store/authStore';

interface MessageActionsProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
}

// Instagram reaction set
const EMOJIS = ['❤️', '😂', '😮', '😢', '🙏', '🔥'];

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

  const currentUserId = useAuthStoreId();
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
              {/* Emoji reaction row — Instagram style floating bar */}
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
                {/* Plus button for more reactions */}
                <TouchableOpacity
                  style={[styles.emojiButton, styles.plusButton]}
                  onPress={() => {
                    // Could open a full emoji picker in the future
                    onClose();
                  }}
                >
                  <Text style={styles.plusText}>＋</Text>
                </TouchableOpacity>
              </View>

              {/* Action list */}
              <View style={styles.actionList}>
                <TouchableOpacity style={styles.actionButton} onPress={handleReplyClick}>
                  <Text style={styles.actionIcon}>↩</Text>
                  <Text style={styles.actionButtonText}>Reply</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
                  <Text style={styles.actionIcon}>📋</Text>
                  <Text style={styles.actionButtonText}>Copy</Text>
                </TouchableOpacity>

                {isEditable && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleEditClick}>
                    <Text style={styles.actionIcon}>✏️</Text>
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}

                {isDeletable && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleDeleteClick}>
                    <Text style={styles.actionIcon}>🗑️</Text>
                    <Text style={[styles.actionButtonText, styles.deleteAction]}>Unsend</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function useAuthStoreId() {
  return useAuthStore((state) => state.user?.id) || '';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#262626',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // safe area bottom
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#363636',
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#363636',
  },
  emojiText: {
    fontSize: 22,
  },
  plusButton: {
    backgroundColor: '#363636',
  },
  plusText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '300',
  },
  actionList: {
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 14,
    width: 24,
    textAlign: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '400',
  },
  deleteAction: {
    color: '#ed4956',
  },
});
