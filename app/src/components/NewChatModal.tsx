import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { User } from '../types';
import { getUsers, createConversation } from '../services/api';
import Avatar from './Avatar';
import { COLORS, SPACING } from '../utils/constants';

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
  onChatCreated: (conversationId: string, name: string) => void;
}

export default function NewChatModal({ visible, onClose, onChatCreated }: NewChatModalProps) {
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch users on mount/open
  useEffect(() => {
    if (visible) {
      loadUsers();
      // Reset states
      setGroupName('');
      setSearchQuery('');
      setSelectedUserIds(new Set());
      setMode('dm');
    }
  }, [visible]);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const allUsers = await getUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error('Failed to load users for modal:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleStartDM(userId: string, userName: string) {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const conv = await createConversation('dm', [userId]);
      onChatCreated(conv.id, userName);
      onClose();
    } catch (err) {
      console.error('Failed to create DM conversation:', err);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCreateGroup() {
    if (isCreating) return;
    if (groupName.trim().length === 0) return;
    if (selectedUserIds.size === 0) return;

    setIsCreating(true);
    try {
      const memberIds = Array.from(selectedUserIds);
      const conv = await createConversation('group', memberIds, groupName.trim());
      onChatCreated(conv.id, groupName.trim());
      onClose();
    } catch (err) {
      console.error('Failed to create group conversation:', err);
    } finally {
      setIsCreating(false);
    }
  }

  function toggleUserSelection(userId: string) {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedUserIds(next);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>New Chat</Text>
            
            {mode === 'group' ? (
              <TouchableOpacity
                onPress={handleCreateGroup}
                disabled={groupName.trim().length === 0 || selectedUserIds.size === 0 || isCreating}
                style={[
                  styles.headerButton,
                  (groupName.trim().length === 0 || selectedUserIds.size === 0 || isCreating)
                    ? styles.disabledButton
                    : null,
                ]}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={[styles.headerButtonText, styles.activeActionText]}>Create</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.headerPlaceholder} />
            )}
          </View>

          {/* Mode Switcher Tab */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, mode === 'dm' ? styles.tabButtonActive : null]}
              onPress={() => setMode('dm')}
            >
              <Text style={[styles.tabButtonText, mode === 'dm' ? styles.tabButtonTextActive : null]}>
                Direct Message
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tabButton, mode === 'group' ? styles.tabButtonActive : null]}
              onPress={() => setMode('group')}
            >
              <Text style={[styles.tabButtonText, mode === 'group' ? styles.tabButtonTextActive : null]}>
                Group Chat
              </Text>
            </TouchableOpacity>
          </View>

          {/* Group Info (if mode is Group) */}
          {mode === 'group' && (
            <View style={styles.groupForm}>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Group Name"
                placeholderTextColor={COLORS.textMuted}
                style={styles.groupInput}
                maxLength={50}
              />
              <Text style={styles.selectedCount}>
                {selectedUserIds.size} member{selectedUserIds.size !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}

          {/* Search bar */}
          <View style={styles.searchBar}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search people..."
              placeholderTextColor={COLORS.textMuted}
              style={styles.searchInput}
            />
          </View>

          {/* Users List */}
          {isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = selectedUserIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => {
                      if (mode === 'dm') {
                        handleStartDM(item.id, item.name);
                      } else {
                        toggleUserSelection(item.id);
                      }
                    }}
                  >
                    <Avatar name={item.name} avatarUrl={item.avatar_url} size={40} />
                    
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.name}</Text>
                    </View>
                    
                    {mode === 'group' && (
                      <View style={[styles.checkbox, isSelected ? styles.checkboxChecked : null]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No matching users found</Text>
              }
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  headerButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerButtonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  activeActionText: {
    color: COLORS.primaryLight,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerPlaceholder: {
    width: 60,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 8,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: 2,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#27272a',
  },
  tabButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  groupForm: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  groupInput: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textLight,
  },
  selectedCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    marginLeft: 4,
  },
  searchBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  searchInput: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.textLight,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  userInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 48,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
  },
});
