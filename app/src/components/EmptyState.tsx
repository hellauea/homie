import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
}

export default function EmptyState({ title, description, icon = '💬' }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 48,
  },
  icon: {
    fontSize: 54,
    marginBottom: 20,
    opacity: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
});
