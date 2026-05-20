import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Message } from '../types';
import { COLORS, SPACING } from '../utils/constants';
import { formatMessageTime } from '../utils/format';
import ReactionBar from './ReactionBar';
import { useAuthStore } from '../store/authStore';

interface MessageBubbleProps {
  message: Message;
  onLongPress: () => void;
  onReactionPress: (emoji: string) => void;
  showSenderName?: boolean;
}

export default function MessageBubble({
  message,
  onLongPress,
  onReactionPress,
  showSenderName = false,
}: MessageBubbleProps) {
  const currentUserId = useAuthStore((state) => state.user?.id) || '';
  const isSelf = message.sender_id === currentUserId;
  const isDeleted = message.type === 'deleted';

  // State for image fullscreen modal
  const [imgModalVisible, setImgModalVisible] = useState(false);

  // States for audio playback
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Clean up sound instance on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Handle playing voice note
  async function togglePlayAudio() {
    if (!message.content) return;

    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        setIsLoadingAudio(true);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: message.content },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsPlaying(true);
        setIsLoadingAudio(false);
      }
    } catch (err) {
      console.error('Error handling audio playback:', err);
      setIsLoadingAudio(false);
    }
  }

  function onPlaybackStatusUpdate(status: any) {
    if (status.isLoaded) {
      setAudioPosition(status.positionMillis || 0);
      setAudioDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setAudioPosition(0);
      }
    }
  }

  function formatTime(ms: number) {
    if (isNaN(ms) || ms <= 0) return '0:00';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // File name extractor
  function getFilename(url: string | null) {
    if (!url) return 'Attachment';
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return decodeURIComponent(lastPart).split('?')[0];
  }

  // --- Content Renderers ---

  function renderBubbleContent() {
    if (isDeleted) {
      return <Text style={styles.deletedText}>🚫 Message deleted</Text>;
    }

    switch (message.type) {
      case 'image':
        return (
          <View style={styles.imageContainer}>
            <TouchableOpacity onPress={() => setImgModalVisible(true)} activeOpacity={0.95}>
              <Image
                source={{ uri: message.content ?? '' }}
                style={styles.bubbleImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
            
            {/* Fullscreen Image Preview Modal */}
            <Modal
              visible={imgModalVisible}
              transparent={true}
              onRequestClose={() => setImgModalVisible(false)}
              animationType="fade"
            >
              <View style={styles.fullscreenContainer}>
                <TouchableOpacity
                  style={styles.closeFullscreenBtn}
                  onPress={() => setImgModalVisible(false)}
                >
                  <Text style={styles.closeText}>✕ Close</Text>
                </TouchableOpacity>
                <Image
                  source={{ uri: message.content ?? '' }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              </View>
            </Modal>
          </View>
        );

      case 'voice':
        const audioProgress = audioDuration > 0 ? audioPosition / audioDuration : 0;
        return (
          <View style={styles.voicePlayer}>
            {isLoadingAudio ? (
              <ActivityIndicator color={isSelf ? '#fff' : COLORS.primary} size="small" style={styles.playBtn} />
            ) : (
              <TouchableOpacity onPress={togglePlayAudio} style={styles.playBtn}>
                <Text style={styles.playBtnText}>{isPlaying ? '⏸️' : '▶️'}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.waveformContainer}>
              <View style={styles.track}>
                <View style={[styles.progress, { width: `${audioProgress * 100}%` }]} />
              </View>
              <Text style={[styles.durationText, isSelf ? styles.timeSelf : styles.timeOther]}>
                {formatTime(audioPosition)} / {formatTime(audioDuration || 0)}
              </Text>
            </View>
          </View>
        );

      case 'file':
        const filename = getFilename(message.content);
        return (
          <TouchableOpacity
            style={styles.fileCard}
            onPress={() => message.content && Linking.openURL(message.content)}
          >
            <View style={styles.fileIconBox}>
              <Text style={styles.fileIcon}>📄</Text>
            </View>
            <View style={styles.fileDetails}>
              <Text style={styles.fileName} numberOfLines={1}>
                {filename}
              </Text>
              <Text style={styles.fileAction}>Tap to Download/Open</Text>
            </View>
          </TouchableOpacity>
        );

      case 'text':
      default:
        return (
          <Text style={[styles.messageText, isSelf ? styles.textSelf : styles.textOther]}>
            {message.content}
          </Text>
        );
    }
  }

  // Render quoted reply preview if applicable
  const replyMsg = message.reply_to_message;

  return (
    <View style={[styles.container, isSelf ? styles.alignRight : styles.alignLeft]}>
      <View style={styles.bubbleWrapper}>
        {/* Group Sender Name */}
        {showSenderName && !isSelf && message.sender && (
          <Text style={styles.senderName}>{message.sender.name}</Text>
        )}

        {/* Quoted Message Preview */}
        {replyMsg && (
          <View style={[styles.replyContainer, isSelf ? styles.replySelf : styles.replyOther]}>
            <Text style={styles.replySender} numberOfLines={1}>
              {replyMsg.sender_id === currentUserId ? 'You' : replyMsg.sender?.name ?? 'Someone'}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyMsg.type === 'deleted'
                ? 'Deleted message'
                : replyMsg.type !== 'text'
                ? `[Attachment: ${replyMsg.type}]`
                : replyMsg.content}
            </Text>
          </View>
        )}

        {/* Message Content Bubble */}
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={isDeleted ? undefined : onLongPress}
          delayLongPress={200}
          style={[
            styles.bubble,
            isSelf ? styles.bubbleSelf : styles.bubbleOther,
            isDeleted ? styles.bubbleDeleted : null,
            message.type === 'image' && !isDeleted ? styles.bubbleImageWrapper : null,
          ]}
        >
          {renderBubbleContent()}

          {/* Time & Edited indicators */}
          <View style={[styles.meta, message.type === 'image' && !isDeleted ? styles.metaImage : null]}>
            <Text style={[styles.time, isSelf ? styles.timeSelf : styles.timeOther]}>
              {formatMessageTime(message.created_at)}
              {message.is_edited ? ' • Edited' : ''}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <View style={isSelf ? styles.reactionsRight : styles.reactionsLeft}>
            <ReactionBar
              reactions={message.reactions}
              currentUserId={currentUserId}
              onReactionPress={onReactionPress}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    maxWidth: '85%',
  },
  alignRight: {
    alignSelf: 'flex-end',
  },
  alignLeft: {
    alignSelf: 'flex-start',
  },
  bubbleWrapper: {
    flexDirection: 'column',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 2,
    marginLeft: 6,
  },
  replyContainer: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryLight,
    paddingLeft: 8,
    paddingVertical: 4,
    paddingRight: 12,
    marginBottom: -4,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    opacity: 0.8,
  },
  replySelf: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyOther: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  replySender: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryLight,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: '#ddd',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 75,
  },
  bubbleSelf: {
    backgroundColor: COLORS.bubbleSelf,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.bubbleOther,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  bubbleDeleted: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#27272a',
    borderStyle: 'dashed',
  },
  deletedText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textSelf: {
    color: COLORS.textLight,
  },
  textOther: {
    color: COLORS.textPrimary,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 10,
  },
  timeSelf: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  timeOther: {
    color: COLORS.textSecondary,
  },
  reactionsLeft: {
    alignSelf: 'flex-start',
  },
  reactionsRight: {
    alignSelf: 'flex-end',
  },
  
  // Image attachments
  bubbleImageWrapper: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  bubbleImage: {
    width: 220,
    height: 180,
    borderRadius: 12,
  },
  metaImage: {
    marginRight: 6,
    marginBottom: 2,
  },

  // Fullscreen Modal
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFullscreenBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  closeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },

  // Audio/Voice player
  voicePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 190,
    paddingVertical: 4,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  playBtnText: {
    fontSize: 14,
  },
  waveformContainer: {
    flex: 1,
  },
  track: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    width: '100%',
    marginBottom: 4,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    backgroundColor: '#fff',
  },
  durationText: {
    fontSize: 10,
  },

  // Document files
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    padding: SPACING.sm,
    width: 200,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  fileIcon: {
    fontSize: 18,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  fileAction: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
