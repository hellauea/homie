import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  isOnline?: boolean;
}

const AVATAR_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ef4444', // Red
  '#14b8a6', // Teal
];

function getHashColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export default function Avatar({ name, avatarUrl, size = 44, isOnline = false }: AvatarProps) {
  const color = getHashColor(name);
  const initials = getInitials(name);
  const fontSize = size * 0.4;
  const presenceSize = Math.max(10, size * 0.28);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 1,
              borderColor: COLORS.border,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              borderWidth: 1,
              borderColor: COLORS.border,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize, fontWeight: '700' }]}>{initials}</Text>
        </View>
      )}

      {isOnline && (
        <View
          style={[
            styles.presence,
            {
              width: presenceSize,
              height: presenceSize,
              borderRadius: presenceSize / 2,
              bottom: -1,
              right: -1,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#1f1f23',
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#fff',
  },
  presence: {
    position: 'absolute',
    backgroundColor: COLORS.onlineGreen,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
});
