import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import ConversationItem from '../components/ConversationItem';
import EmptyState from '../components/EmptyState';
import NewChatModal from '../components/NewChatModal';
import Avatar from '../components/Avatar';
import { COLORS, SPACING } from '../utils/constants';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { conversations, loadConversations, isLoadingConversations, setActiveConversation } =
    useChatStore();
  const user = useAuthStore((state) => state.user);

  const [modalVisible, setModalVisible] = useState(false);

  // Set up header navigation button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.profileHeaderBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <Avatar
            name={user?.name ?? 'Me'}
            avatarUrl={user?.avatar_url}
            size={32}
          />
        </TouchableOpacity>
      ),
      headerLeft: () => (
        <Text style={styles.brandTitle}>Squaad</Text>
      ),
      headerTitle: '',
    });
  }, [navigation, user]);

  useEffect(() => {
    loadConversations();
  }, []);

  function handleConversationPress(id: string, name: string) {
    setActiveConversation(id);
    navigation.navigate('Chat', { conversationId: id, name });
  }

  function handleChatCreated(conversationId: string, name: string) {
    // Refresh conversation list to include the new conversation
    loadConversations();
    // Navigate straight to the new chat screen
    handleConversationPress(conversationId, name);
  }

  return (
    <View style={styles.container}>
      {isLoadingConversations && conversations.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshing={isLoadingConversations}
          onRefresh={loadConversations}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            let name = item.name ?? 'Group';
            if (item.type === 'dm' && item.otherUser) {
              name = item.otherUser.name;
            }
            return (
              <ConversationItem
                conversation={item}
                onPress={() => handleConversationPress(item.id, name)}
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title="No chats yet"
              description="Tap the floating icon below to start a new chat with active members!"
              icon="👋"
            />
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>

      {/* Start Chat Modal */}
      <NewChatModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onChatCreated={handleChatCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b', // Deep zinc black
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  profileHeaderBtn: {
    marginRight: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginLeft: SPACING.md,
    letterSpacing: 0.5,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    backgroundColor: COLORS.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginTop: -2,
  },
});
