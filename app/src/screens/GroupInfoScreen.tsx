import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

import * as api from '../services/api';
import { Conversation, User } from '../types';
import Avatar from '../components/Avatar';
import { COLORS, SPACING } from '../utils/constants';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

type GroupInfoRouteProp = RouteProp<RootStackParamList, 'GroupInfo'>;
type GroupInfoNavigationProp = StackNavigationProp<RootStackParamList, 'GroupInfo'>;

export default function GroupInfoScreen() {
  const route = useRoute<GroupInfoRouteProp>();
  const navigation = useNavigation<GroupInfoNavigationProp>();
  const { conversationId } = route.params;

  const currentUserId = useAuthStore((state) => state.user?.id) || '';
  const { loadConversations } = useChatStore();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Edit fields
  const [editMode, setEditMode] = useState(false);
  const [groupName, setGroupName] = useState('');

  // Add members modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    fetchGroupDetails();
  }, [conversationId]);

  async function fetchGroupDetails() {
    setIsLoading(true);
    try {
      const data = await api.getConversationDetails(conversationId);
      setConversation(data);
      setGroupName(data.name ?? '');
    } catch (err) {
      console.error('Failed to fetch conversation details:', err);
      Alert.alert('Error', 'Failed to load group details.');
    } finally {
      setIsLoading(false);
    }
  }

  // Check if current user is admin
  const selfMember = conversation?.members?.find((m) => m.user_id === currentUserId);
  const isAdmin = selfMember?.role === 'admin';

  async function handleUpdateName() {
    if (groupName.trim().length === 0) return;
    setIsSaving(true);
    try {
      await api.updateConversation(conversationId, { name: groupName.trim() });
      setEditMode(false);
      fetchGroupDetails();
      loadConversations();
    } catch (err) {
      console.error('Failed to update group name:', err);
      Alert.alert('Error', 'Failed to update group name.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveMember(targetUserId: string, targetName: string) {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${targetName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removeConversationMember(conversationId, targetUserId);
              fetchGroupDetails();
            } catch (err) {
              console.error('Failed to remove member:', err);
              Alert.alert('Error', 'Failed to remove member.');
            }
          },
        },
      ]
    );
  }

  async function handleOpenAddMemberModal() {
    setAddModalVisible(true);
    setIsLoadingUsers(true);
    try {
      const allUsers = await api.getUsers();
      // Filter out users who are already members
      const existingMemberIds = new Set(conversation?.members?.map((m) => m.user_id) ?? []);
      const addable = allUsers.filter((u) => !existingMemberIds.has(u.id));
      setAvailableUsers(addable);
    } catch (err) {
      console.error('Failed to load addable users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }

  async function handleAddMember(targetUserId: string) {
    try {
      await api.addConversationMember(conversationId, targetUserId);
      setAddModalVisible(false);
      fetchGroupDetails();
    } catch (err) {
      console.error('Failed to add member:', err);
      Alert.alert('Error', 'Failed to add member.');
    }
  }

  async function handleLeaveGroup() {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.leaveConversation(conversationId);
              loadConversations();
              navigation.navigate('Home');
            } catch (err) {
              console.error('Failed to leave group:', err);
              Alert.alert('Error', 'Failed to leave group.');
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Title/Name details */}
      <View style={styles.groupHeader}>
        <Avatar name={conversation?.name ?? 'Group'} size={72} avatarUrl={conversation?.avatar_url} />
        
        {editMode ? (
          <View style={styles.editRow}>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              style={styles.groupNameInput}
              maxLength={50}
              placeholder="Group name"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.editButtons}>
              <TouchableOpacity onPress={handleUpdateName} disabled={isSaving} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{isSaving ? '...' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditMode(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.editRow}>
            <Text style={styles.groupTitle} numberOfLines={2}>
              {conversation?.name}
            </Text>
            {isAdmin && (
              <TouchableOpacity onPress={() => setEditMode(true)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Action buttons (Leave / Add members) */}
      <View style={styles.actionsBar}>
        {isAdmin && (
          <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleOpenAddMemberModal}>
            <Text style={styles.actionBtnPrimaryText}>＋ Add Member</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionBtnDanger} onPress={handleLeaveGroup}>
          <Text style={styles.actionBtnDangerText}>🚪 Leave Group</Text>
        </TouchableOpacity>
      </View>

      {/* Members Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Members ({conversation?.members?.length ?? 0})</Text>
      </View>

      <FlatList
        data={conversation?.members ?? []}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <Avatar name={item.user.name} avatarUrl={item.user.avatar_url} size={36} />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.user.name}</Text>
              {item.role === 'admin' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </View>

            {isAdmin && item.user_id !== currentUserId && (
              <TouchableOpacity
                onPress={() => handleRemoveMember(item.user_id, item.user.name)}
                style={styles.removeBtn}
              >
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Add Member modal */}
      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Members</Text>
            <View style={{ width: 40 }} />
          </View>

          {isLoadingUsers ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={availableUsers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: SPACING.lg }}
              renderItem={({ item }) => (
                <View style={styles.addableUserRow}>
                  <Avatar name={item.name} avatarUrl={item.avatar_url} size={40} />
                  <Text style={styles.addableUserName}>{item.name}</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAddMember(item.id)}
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyAddText}>Everyone is already a member!</Text>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  groupTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  editRow: {
    alignItems: 'center',
    marginTop: SPACING.md,
    width: '100%',
    paddingHorizontal: 32,
  },
  groupNameInput: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: '100%',
    textAlign: 'center',
  },
  editButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelBtn: {
    backgroundColor: '#27272a',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#fff',
  },
  editBtn: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
  },
  editBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
    gap: SPACING.md,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionBtnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  actionBtnDanger: {
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionBtnDangerText: {
    color: COLORS.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  memberInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  adminBadge: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: 'rgba(167, 139, 250, 0.4)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  adminBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  modalCloseText: {
    fontSize: 16,
    color: COLORS.primaryLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  addableUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  addableUserName: {
    fontSize: 16,
    color: COLORS.textPrimary,
    flex: 1,
    marginLeft: SPACING.md,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyAddText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 48,
  },
});
