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
  LayoutAnimation,
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
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
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
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Homie needs access to your gallery to send photos.');
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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Homie needs camera access to capture photos.');
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
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Homie needs microphone access to record voice notes.');
        return;
      }

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

  const isTextEmpty = text.trim().length === 0;

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
        <View style={styles.inputOuterContainer}>
          {/* Camera Button on the Left */}
          <TouchableOpacity style={styles.cameraIconContainer} onPress={takePhoto} disabled={isUploading}>
            <Text style={styles.cameraIcon}>📷</Text>
          </TouchableOpacity>

          {/* Text Input area (with collapsing items inside or next to it) */}
          <View style={styles.inputInnerContainer}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={handleTextChange}
              placeholder="Message..."
              placeholderTextColor={COLORS.textSecondary}
              style={styles.textInput}
              multiline
              maxLength={1000}
              editable={!isUploading}
            />

            {isUploading ? (
              <ActivityIndicator color={COLORS.accent} size="small" style={styles.uploadSpinner} />
            ) : isTextEmpty ? (
              /* Icons shown only when text is empty */
              <View style={styles.collapsedIconsRow}>
                <TouchableOpacity style={styles.insideIconBtn} onPress={startRecording}>
                  <Text style={styles.insideIcon}>🎙️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.insideIconBtn} onPress={pickImage}>
                  <Text style={styles.insideIcon}>🖼️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.insideIconBtn} onPress={pickDocument}>
                  <Text style={styles.insideIcon}>📄</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Send Arrow shown when text is entered */
              <TouchableOpacity style={styles.sendIconBtn} onPress={handleSend}>
                <Text style={styles.sendIcon}>➤</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
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
    color: COLORS.primaryLight,
  },
  statePreview: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  inputOuterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cameraIcon: {
    fontSize: 18,
  },
  inputInnerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: 8,
    marginRight: 8,
  },
  collapsedIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insideIconBtn: {
    padding: 2,
  },
  insideIcon: {
    fontSize: 18,
  },
  sendIconBtn: {
    padding: 6,
  },
  sendIcon: {
    fontSize: 18,
    color: '#9b59f0', // Custom lavender arrow
    fontWeight: 'bold',
  },
  uploadSpinner: {
    padding: 4,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#262626',
    borderRadius: 22,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    marginRight: 8,
  },
  recordingText: {
    color: COLORS.textPrimary,
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
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  sendRecBtn: {
    backgroundColor: COLORS.danger,
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
