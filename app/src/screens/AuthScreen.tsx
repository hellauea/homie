import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { auth } from '../services/firebase';
import { verifyFirebaseToken, registerUser } from '../services/api';
import { connectSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';

type Step = 'phone' | 'otp' | 'register';

export default function AuthScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [setupToken, setSetupToken] = useState('');

  const { setAuth } = useAuthStore();

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  async function sendOtp() {
    const e164 = phone.trim();
    if (!/^\+\d{10,15}$/.test(e164)) {
      Alert.alert('Invalid number', 'Enter number in E.164 format: +919876543210');
      return;
    }
    setLoading(true);
    try {
      // Native phone authentication call
      const confirmation = await auth().signInWithPhoneNumber(e164);
      setConfirmResult(confirmation);
      setStep('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify OTP → get Firebase ID token → call backend ────────────
  async function verifyOtp() {
    if (otp.length !== 6) {
      Alert.alert('Enter 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      if (!confirmResult) {
        Alert.alert('Error', 'No verification session found. Please request a new OTP.');
        return;
      }
      // Confirm the OTP code natively
      const userCredential = await confirmResult.confirm(otp);
      if (!userCredential || !userCredential.user) {
        Alert.alert('Error', 'Verification failed: User object not found.');
        return;
      }
      const firebaseIdToken = await userCredential.user.getIdToken();

      const response = await verifyFirebaseToken(firebaseIdToken);

      if (response.status === 'needs_registration') {
        // New user — needs to set name first
        setSetupToken(response.setupToken!);
        setStep('register');
      } else if (response.status === 'ok' && response.token && response.user) {
        await setAuth(response.user, response.token);
        await connectSocket();
        // Navigation handled by AppNavigator reacting to isAuthenticated
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Register (first-time users only) ──────────────────────────────
  async function register() {
    if (name.trim().length < 2) {
      Alert.alert('Enter your name (at least 2 characters)');
      return;
    }
    setLoading(true);
    try {
      const result = await registerUser({
        setupToken,
        name: name.trim(),
      });
      await setAuth(result.user, result.token);
      await connectSocket();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Squaad</Text>
      <Text style={styles.subtitle}>
        {step === 'phone' && 'Enter your phone number'}
        {step === 'otp' && `OTP sent to ${phone}`}
        {step === 'register' && "What should we call you?"}
      </Text>

      {step === 'phone' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="+919876543210"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />
          <TouchableOpacity
            style={styles.button}
            onPress={sendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {step === 'otp' && (
        <>
          <TextInput
            style={[styles.input, styles.otpInput]}
            placeholder="------"
            placeholderTextColor="#444"
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
            maxLength={6}
            autoFocus
          />
          <TouchableOpacity
            style={styles.button}
            onPress={verifyOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('phone')}>
            <Text style={styles.link}>← Change number</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'register' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={50}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={register}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  otpInput: {
    letterSpacing: 12,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#5b21b6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  link: {
    color: '#888',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
  },
});
