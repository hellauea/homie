import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { Message } from '../types';
import { COLORS, SPACING } from '../utils/constants';
import { getSocket } from '../services/socket';
import { uploadToCloudinary } from '../services/cloudinary';

interface ChatInputProps {
  conversationId: string;
  onSend: (text: string, type?: 'text' | 'image' | 'video' | 'file' | 'voice') => void;
  replyingTo: Message | null;
  onCancelReply: () => void;
  editingMessage: Message | null;
  onCancelEdit: () => void;
}

export default function ChatInput({
  conversationId,
  onSend,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Audio Recording States
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Auto-focus and clear logic
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content ?? '');
      inputRef.current?.focus();
    } else {
      setText('');
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  useEffect(() => {
    return () => {
      stopTypingIndicator();
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    };
  }, [conversationId]);

  // Typing logic
  function startTypingIndicator() {
    const socket = getSocket();
    if (!socket?.connected) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing_start', { conversationId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTypingIndicator();
    }, 3000);
  }

  function stopTypingIndicator() {
    const socket = getSocket();
    if (socket?.connected && isTypingRef.current) {
      socket.emit('typing_stop', { conversationId });
      isTypingRef.current = false;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }

  function handleTextChange(newText: string) {
    setText(newText);
    if (newText.trim().length > 0) {
      startTypingIndicator();
    } else {
      stopTypingIndicator();
    }
  }

  function handleSend() {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    onSend(trimmed, 'text');
    setText('');
    stopTypingIndicator();
  }

  // --- Attachment Pickers ---
  
  async function pickImage() {
    try {
      setShowOptions(false);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Squaad needs access to your gallery to send photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        await handleMediaUpload(localUri, 'image');
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Upload Failed', 'An error occurred while picking the image.');
    }
  }

  async function takePhoto() {
    try {
      setShowOptions(false);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Squaad needs camera access to capture photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        await handleMediaUpload(localUri, 'image');
      }
    } catch (err) {
      console.error('Error taking photo:', err);
      Alert.alert('Upload Failed', 'An error occurred while capturing the photo.');
    }
  }

  async function pickDocument() {
    try {
      setShowOptions(false);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        await handleMediaUpload(localUri, 'file');
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('Upload Failed', 'An error occurred while picking the file.');
    }
  }

  // Common upload handler
  async function handleMediaUpload(localUri: string, type: 'image' | 'file' | 'voice') {
    setIsUploading(true);
    try {
      const remoteUrl = await uploadToCloudinary(localUri, type);
      onSend(remoteUrl, type);
    } catch (err) {
      console.error(`Failed to upload ${type} to Cloudinary:`, err);
      Alert.alert('Upload Failed', `Could not upload your ${type}. Please try again.`);
    } finally {
      setIsUploading(false);
    }
  }

  // --- Voice Recording ---

  async function startRecording() {
    try {
      setShowOptions(false);
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Squaad needs microphone access to record voice notes.');
        return;
      }

      // Configure audio session for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordDuration(0);

      // Duration counter
      recordIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start audio recording:', err);
      Alert.alert('Recorder Error', 'Could not initialize the microphone.');
    }
  }

  async function stopRecordingAndSend() {
    if (!recording) return;

    setIsRecording(false);
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        await handleMediaUpload(uri, 'voice');
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      Alert.alert('Recorder Error', 'An error occurred while stopping the recording.');
    }
  }

  async function cancelRecording() {
    if (!recording) return;

    setIsRecording(false);
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
    }

    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
    } catch (err) {
      console.error('Error cancelling recording:', err);
    }
  }

  function formatDuration(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  return (
    <View style={styles.container}>
      {/* Replying indicator panel */}
      {replyingTo && (
        <View style={styles.stateBar}>
          <View style={styles.stateLeft}>
            <Text style={styles.stateLabel}>Replying to {replyingTo.sender?.name ?? 'Someone'}</Text>
            <Text style={styles.statePreview} numberOfLines={1}>
              {replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onCancelReply}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Editing indicator panel */}
      {editingMessage && (
        <View style={styles.stateBar}>
          <View style={styles.stateLeft}>
            <Text style={[styles.stateLabel, styles.editLabel]}>Editing message</Text>
            <Text style={styles.statePreview} numberOfLines={1}>
              {editingMessage.content}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onCancelEdit}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inline Recording Controls */}
      {isRecording ? (
        <View style={styles.recordingRow}>
          <View style={styles.recordingIndicator}>
            <View style={styles.redDot} />
            <Text style={styles.recordingText}>Recording: {formatDuration(recordDuration)}</Text>
          </View>
          
          <View style={styles.recordingActions}>
            <TouchableOpacity style={styles.cancelRecBtn} onPress={cancelRecording}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sendRecBtn} onPress={stopRecordingAndSend}>
              <Text style={styles.sendRecText}>🎙️ Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {/* Attachment options pop-up */}
          {showOptions && (
            <View style={styles.optionsContainer}>
              <TouchableOpacity style={styles.optionItem} onPress={pickImage}>
                <Text style={styles.optionIcon}>🖼️</Text>
                <Text style={styles.optionLabel}>Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.optionItem} onPress={takePhoto}>
                <Text style={styles.optionIcon}>📷</Text>
                <Text style={styles.optionLabel}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.optionItem} onPress={pickDocument}>
                <Text style={styles.optionIcon}>📄</Text>
                <Text style={styles.optionLabel}>Document</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.optionItem} onPress={startRecording}>
                <Text style={styles.optionIcon}>🎙️</Text>
                <Text style={styles.optionLabel}>Voice Note</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Input textbox row */}
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={() => setShowOptions(!showOptions)}
            >
              <Text style={[styles.attachmentIcon, showOptions ? styles.rotateIcon : null]}>+</Text>
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={handleTextChange}
              placeholder="Send a message..."
              placeholderTextColor={COLORS.textMuted}
              style={styles.textInput}
              multiline
              maxLength={1000}
              editable={!isUploading}
            />
            
            {isUploading ? (
              <ActivityIndicator color={COLORS.primary} size="small" style={styles.uploadSpinner} />
            ) : (
              <TouchableOpacity
                style={[styles.sendButton, text.trim().length === 0 ? styles.sendButtonDisabled : null]}
                disabled={text.trim().length === 0}
                onPress={handleSend}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#18181b',
    padding: SPACING.sm,
  },
  stateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  stateLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  stateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryLight,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  editLabel: {
    color: COLORS.secondary,
  },
  statePreview: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#18181b',
    borderRadius: 22,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  attachmentButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    marginBottom: 2,
  },
  attachmentIcon: {
    color: COLORS.textLight,
    fontSize: 18,
    fontWeight: '600',
  },
  rotateIcon: {
    transform: [{ rotate: '45deg' }],
  },
  textInput: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 28,
    paddingTop: Platform.OS === 'ios' ? 4 : 2,
    paddingBottom: Platform.OS === 'ios' ? 4 : 2,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  uploadSpinner: {
    marginLeft: SPACING.sm,
    marginBottom: 6,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  optionItem: {
    alignItems: 'center',
  },
  optionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  optionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181b',
    borderRadius: 22,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelRecBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sendRecBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  sendRecText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
