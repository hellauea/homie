import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import GroupInfoScreen from '../screens/GroupInfoScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { useAuthStore } from '../store/authStore';
import { getMe, api } from '../services/api';
import { connectSocket } from '../services/socket';
import * as SecureStore from 'expo-secure-store';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Chat: { conversationId: string; name: string };
  GroupInfo: { conversationId: string };
  Profile: undefined;
};

// Global navigation reference for routing notification clicks
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Define notification presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading, setAuth, setLoading, clearAuth } = useAuthStore();
  
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

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

  // Notifications observer setup when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Register for push notifications on this device
    registerForPushNotificationsAsync();

    // 2. Foreground notification listener
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Received foreground notification:', notification.request.content.data);
    });

    // 3. Click handler (when user taps a notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      console.log('User clicked notification:', data);
      
      if (data && data.conversationId) {
        // Run navigation when ref is ready
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('Chat', {
              conversationId: data.conversationId,
              name: data.conversationName || 'Homie Chat',
            });
          }
        }, 100);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated]);

  async function registerForPushNotificationsAsync() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions denied!');
        return;
      }

      // Standalone EAS APK uses FCM raw native tokens
      const tokenObj = await Notifications.getDevicePushTokenAsync();
      const token = tokenObj.data;
      console.log('Native FCM Device Token:', token);

      if (token) {
        // Sync FCM token with database
        await api.patch('/users/me', { fcmToken: token });
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6c35de',
        });
      }
    } catch (err) {
      console.error('Failed to register device for push notifications:', err);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#6c35de" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#000000', shadowColor: 'transparent', elevation: 0 },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700' },
          cardStyle: { backgroundColor: '#000000' },
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
            {/* Custom headers rendered inside Home and Chat screen */}
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="GroupInfo"
              component={GroupInfoScreen}
              options={{ title: 'Group Info' }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Edit Profile' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
