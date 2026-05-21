import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MessageReaction } from '../types';
import { COLORS } from '../utils/constants';

interface ReactionBarProps {
  reactions: MessageReaction[];
  currentUserId: string;
  onReactionPress: (emoji: string) => void;
}

export default function ReactionBar({
  reactions,
  currentUserId,
  onReactionPress,
}: ReactionBarProps) {
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
            info.hasSelf && styles.chipSelf,
          ]}
          onPress={() => onReactionPress(emoji)}
          activeOpacity={0.7}
        >
          <Text style={styles.emojiText}>{emoji}</Text>
          <Text style={styles.countText}>{info.count}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.border, // #262626
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#363636',
  },
  chipSelf: {
    borderColor: COLORS.primary, // #6c35de
    backgroundColor: 'rgba(108,53,222,0.15)',
  },
  emojiText: {
    fontSize: 12,
    marginRight: 3,
  },
  countText: {
    fontSize: 10,
    color: COLORS.textPrimary, // #ffffff
    fontWeight: '600',
  },
});
