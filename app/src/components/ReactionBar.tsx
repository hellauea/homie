import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MessageReaction } from '../types';
import { COLORS } from '../utils/constants';

interface ReactionBarProps {
  reactions: MessageReaction[];
  currentUserId: string;
  onReactionPress: (emoji: string) => void;
}

export default function ReactionBar({ reactions, currentUserId, onReactionPress }: ReactionBarProps) {
  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const grouped: Record<string, { count: number; hasSelf: boolean }> = {};
  
  reactions.forEach((r) => {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { count: 0, hasSelf: false };
    }
    grouped[r.emoji].count += 1;
    if (r.user_id === currentUserId) {
      grouped[r.emoji].hasSelf = true;
    }
  });

  return (
    <View style={styles.container}>
      {Object.entries(grouped).map(([emoji, info]) => (
        <TouchableOpacity
          key={emoji}
          style={[
            styles.chip,
            info.hasSelf ? styles.chipSelf : null,
          ]}
          onPress={() => onReactionPress(emoji)}
          activeOpacity={0.7}
        >
          <Text style={styles.emojiText}>{emoji}</Text>
          <Text style={[styles.countText, info.hasSelf ? styles.countTextSelf : null]}>
            {info.count}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f23', // Dark background for other reactions
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  chipSelf: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)', // Indigo tint
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  emojiText: {
    fontSize: 12,
    marginRight: 4,
  },
  countText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  countTextSelf: {
    color: COLORS.primaryLight,
  },
});
