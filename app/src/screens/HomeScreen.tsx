import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  function handleConversationPress(id: string, name: string) {
    setActiveConversation(id);
    navigation.navigate('Chat', { conversationId: id, name });
  }

  function handleChatCreated(conversationId: string, name: string) {
    loadConversations();
    handleConversationPress(conversationId, name);
  }

  // Filter conversations locally based on search query
  const filteredConversations = conversations.filter((item) => {
    let name = item.name ?? (item.type === 'group' ? 'Group' : 'Chat');
    if (item.type === 'dm' && item.otherUser) {
      name = item.otherUser.name;
    }
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Custom Instagram DMs style Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <Avatar
            name={user?.name ?? 'Me'}
            avatarUrl={user?.avatar_url}
            size={36}
          />
        </TouchableOpacity>

        {/* Lowercase, bold "messages" header */}
        <Text style={styles.headerTitle}>messages</Text>

        <TouchableOpacity
          style={styles.composeBtn}
          onPress={() => setModalVisible(true)}
        >
          {/* Instagram-like square compose icon */}
          <Text style={styles.composeIcon}>📝</Text>
        </TouchableOpacity>
      </View>

      {/* Instagram style Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInner}>
          <Text style={styles.searchEmojiIcon}>🔍</Text>
          <TextInput
            placeholder="Search"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conversations list */}
      {isLoadingConversations && conversations.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          refreshing={isLoadingConversations}
          onRefresh={loadConversations}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            let name = item.name ?? (item.type === 'group' ? 'Group' : 'Chat');
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
              title="No chats found"
              description={searchQuery.length > 0 ? "No conversations match your search." : "Tap the compose icon in the top right to start a chat!"}
              icon="💬"
            />
          }
        />
      )}

      {/* Start Chat Modal */}
      <NewChatModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onChatCreated={handleChatCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'lowercase',
    letterSpacing: -0.5,
  },
  composeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  composeIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  searchEmojiIcon: {
    fontSize: 14,
    marginRight: 8,
    color: '#8e8e8e',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearText: {
    color: '#8e8e8e',
    fontSize: 12,
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
});
