import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';

import { useAuthStore } from '../store/authStore';
import { getMe } from '../services/api';
import { connectSocket } from '../services/socket';
import * as SecureStore from 'expo-secure-store';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Chat: { conversationId: string; name: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading, setAuth, setLoading, clearAuth } =
    useAuthStore();

  // Auto-login: check for stored JWT on app open
  useEffect(() => {
    async function tryAutoLogin() {
      try {
        const token = await SecureStore.getItemAsync('jwt');
        if (!token) {
          setLoading(false);
          return;
        }
        // Validate token by fetching current user
        const user = await getMe();
        await setAuth(user, token);
        await connectSocket();
      } catch {
        // Token invalid or expired
        await clearAuth();
      }
    }
    tryAutoLogin();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#5b21b6" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f0f0f' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          cardStyle: { backgroundColor: '#0f0f0f' },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Squaad' }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ title: route.params.name })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
