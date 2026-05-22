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
  Dimensions,
} from 'react-native';
import { loginUser, registerUser } from '../services/api';
import { connectSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';

const { width, height } = Dimensions.get('window');

type Step = 'login' | 'register';

export default function AuthScreen() {
  const [step, setStep] = useState<Step>('login');
  const [phone, setPhone] = useState('+91');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupToken, setSetupToken] = useState('');

  const { setAuth } = useAuthStore();

  const handlePhoneChange = (text: string) => {
    // If user tries to delete the +91 prefix entirely, lock it to +91
    if (text.length < 3) {
      setPhone('+91');
      return;
    }
    // If they paste or edit prefix incorrectly, extract numbers and re-apply +91
    if (!text.startsWith('+91')) {
      const digits = text.replace(/\D/g, '');
      setPhone(`+91${digits}`);
      return;
    }
    // Clean and allow only numeric characters after +91
    const body = text.slice(3).replace(/\D/g, '');
    setPhone(`+91${body}`);
  };

  // ── Step 1: Login / Initiate Registration ──────────────────────────────────
  async function handleLogin() {
    const e164 = phone.trim();
    if (!/^\+\d{10,15}$/.test(e164)) {
      Alert.alert('Invalid number', 'Enter number in E.164 format: +919876543210');
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser(e164);

      if (response.status === 'needs_registration') {
        // Whitelisted new user — transition to register step
        setSetupToken(response.setupToken!);
        setStep('register');
        Alert.alert(
          'Welcome to Homie!',
          'Your number is invited. Let\'s complete your profile registration.'
        );
      } else if (response.status === 'ok' && response.token && response.user) {
        await setAuth(response.user, response.token);
        await connectSocket();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      Alert.alert('Authentication Error', msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Register (first-time users only) ──────────────────────────────
  async function handleRegister() {
    if (name.trim().length < 2) {
      Alert.alert('Invalid Name', 'Name must be at least 2 characters.');
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
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      Alert.alert('Registration Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Decorative Premium Glow Orbs */}
      <View style={[styles.glowOrb, styles.orb1]} />
      <View style={[styles.glowOrb, styles.orb2]} />

      <View style={styles.card}>
        <Text style={styles.title}>Homie</Text>
        <Text style={styles.subtitle}>
          {step === 'login' ? 'Connect with your squad' : 'Complete your setup'}
        </Text>

        {step === 'login' && (
          <>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+919606664929"
              placeholderTextColor="#555"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={handlePhoneChange}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </TouchableOpacity>
            
            <Text style={styles.footerNote}>
              Only invited phone numbers can join Homie.
            </Text>
          </>
        )}

        {step === 'register' && (
          <>
            <Text style={styles.registerPhoneText}>
              Registering for <Text style={styles.highlightText}>{phone}</Text>
            </Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Joy"
              placeholderTextColor="#555"
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={50}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setStep('login');
              }}
            >
              <Text style={styles.backButtonText}>← Back to Login</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black background
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
  },
  orb1: {
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: '#6366f1', // Indigo glow
    top: height * 0.1,
    left: -width * 0.2,
  },
  orb2: {
    width: width * 0.9,
    height: width * 0.9,
    backgroundColor: '#a855f7', // Purple glow
    bottom: height * 0.1,
    right: -width * 0.3,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(20, 20, 25, 0.75)', // Glassmorphic translucent dark background
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)', // Soft glass border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: '#a1a1aa', // Muted slate text
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '500',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e4e4e7',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(39, 39, 42, 0.6)', // Semi-transparent dark input
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54, // Fixed uniform height
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 39, 42, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 20,
    height: 54, // Same fixed height to prevent vertical stretching
  },
  passwordInput: {
    flex: 1,
    color: '#fff',
    paddingHorizontal: 16,
    height: '100%',
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 16,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeText: {
    fontSize: 18,
  },
  button: {
    backgroundColor: '#7c3aed', // Premium purple accent
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  registerPhoneText: {
    color: '#a1a1aa',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  highlightText: {
    color: '#a78bfa',
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '600',
  },
  footerNote: {
    color: '#71717a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
