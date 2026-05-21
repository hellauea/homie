import React, { useState, useEffect, useCallback } from 'react';
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
  onDoubleTap?: () => void;
  showSenderName?: boolean;
}

export default function MessageBubble({
  message,
  onLongPress,
  onReactionPress,
  onDoubleTap,
  showSenderName = false,
}: MessageBubbleProps) {
  const currentUserId = useAuthStore((state) => state.user?.id) || '';
  const isSelf = message.sender_id === currentUserId;
  const isDeleted = message.type === 'deleted';

  // Double-tap detection
  const [lastTap, setLastTap] = useState(0);

  function handlePress() {
    const now = Date.now();
    if (now - lastTap < 300) {
      // Double tap detected
      onDoubleTap?.();
      setLastTap(0);
    } else {
      setLastTap(now);
    }
  }

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

  function formatAudioTime(ms: number) {
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
      return <Text style={styles.deletedText}>Message unsent</Text>;
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
                  <Text style={styles.closeText}>✕</Text>
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
              <ActivityIndicator color="#ffffff" size="small" style={styles.playBtn} />
            ) : (
              <TouchableOpacity onPress={togglePlayAudio} style={styles.playBtn}>
                <Text style={styles.playBtnText}>{isPlaying ? '⏸' : '▶'}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.waveformContainer}>
              {/* Simulated waveform bars */}
              <View style={styles.waveformBars}>
                {[3, 6, 4, 8, 5, 7, 3, 6, 8, 4, 7, 5, 3, 6, 4, 8, 5, 7, 3, 5].map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: h * 2,
                        backgroundColor: i / 20 <= audioProgress
                          ? '#ffffff'
                          : 'rgba(255,255,255,0.3)',
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.durationText}>
                {formatAudioTime(audioPosition || audioDuration)}
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
              <Text style={styles.fileAction}>Tap to open</Text>
            </View>
          </TouchableOpacity>
        );

      case 'text':
      default:
        return (
          <Text style={styles.messageText}>
            {message.content}
          </Text>
        );
    }
  }

  // Render quoted reply preview if applicable
  const replyMsg = message.reply_to_message;

  const renderBubbleWrapper = () => {
    return (
      <View
        style={[
          styles.bubble,
          isSelf ? styles.bubbleSelfSolid : styles.bubbleOther,
          isDeleted ? styles.bubbleDeleted : null,
          message.type === 'image' && !isDeleted ? styles.bubbleImageWrapper : null,
        ]}
      >
        {renderBubbleContent()}

        {/* Time & Edited indicators */}
        <View style={[styles.meta, message.type === 'image' && !isDeleted ? styles.metaImage : null]}>
          <Text style={styles.time}>
            {formatMessageTime(message.created_at)}
            {message.is_edited ? ' · edited' : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, isSelf ? styles.alignRight : styles.alignLeft]}>
      <View style={styles.bubbleWrapper}>
        {/* Group Sender Name */}
        {showSenderName && !isSelf && message.sender && (
          <Text style={styles.senderName}>{message.sender.name}</Text>
        )}

        {/* Quoted Message Preview */}
        {replyMsg && (
          <View style={styles.replyContainer}>
            <View style={styles.replyBorder} />
            <View style={styles.replyContent}>
              <Text style={styles.replySender} numberOfLines={1}>
                {replyMsg.sender_id === currentUserId ? 'You' : replyMsg.sender?.name ?? 'Someone'}
              </Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {replyMsg.type === 'deleted'
                  ? 'Message unsent'
                  : replyMsg.type !== 'text'
                  ? `Sent a ${replyMsg.type}`
                  : replyMsg.content}
              </Text>
            </View>
          </View>
        )}

        {/* Message Content Bubble */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={isDeleted ? undefined : handlePress}
          onLongPress={isDeleted ? undefined : onLongPress}
          delayLongPress={200}
        >
          {renderBubbleWrapper()}
        </TouchableOpacity>

        {/* Reactions as overlaid pill */}
        {message.reactions && message.reactions.length > 0 && (
          <View style={[styles.reactionPill, isSelf ? styles.reactionPillRight : styles.reactionPillLeft]}>
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
    marginVertical: 2,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    maxWidth: '80%',
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
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 2,
    marginLeft: 12,
  },
  replyContainer: {
    flexDirection: 'row',
    marginBottom: -2,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  replyBorder: {
    width: 3,
    backgroundColor: '#6c35de',
    borderRadius: 2,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9b59f0',
    marginBottom: 1,
  },
  replyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 70,
  },
  bubbleSelf: {
    borderBottomRightRadius: 4,
  },
  bubbleSelfSolid: {
    backgroundColor: COLORS.bubbleSelf,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.bubbleOther,
    borderBottomLeftRadius: 4,
  },
  bubbleDeleted: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#262626',
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
    color: '#ffffff',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  reactionPill: {
    marginTop: -6,
    zIndex: 10,
  },
  reactionPillRight: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  reactionPillLeft: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },

  // Image attachments
  bubbleImageWrapper: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  imageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  bubbleImage: {
    width: 220,
    height: 180,
    borderRadius: 14,
  },
  metaImage: {
    marginRight: 6,
    marginBottom: 2,
  },

  // Fullscreen Modal
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.97)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFullscreenBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },

  // Audio/Voice player
  voicePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 200,
    paddingVertical: 4,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  playBtnText: {
    fontSize: 13,
    color: '#fff',
  },
  waveformContainer: {
    flex: 1,
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  durationText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },

  // Document files
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    padding: SPACING.sm,
    width: 200,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 2,
  },
});
