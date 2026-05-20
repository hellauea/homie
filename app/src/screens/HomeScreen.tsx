import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { disconnectSocket } from '../services/socket';

export default function HomeScreen() {
  const { user, clearAuth } = useAuthStore();

  async function logout() {
    disconnectSocket();
    await clearAuth();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hey, {user?.name ?? 'there'} 👋</Text>
      <Text style={styles.sub}>Chats will appear here in Phase 3.</Text>
      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  greeting: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  sub: { fontSize: 15, color: '#555', marginBottom: 48 },
  logout: { padding: 12 },
  logoutText: { color: '#e11d48', fontSize: 15 },
});
