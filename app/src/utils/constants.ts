// ============================================================
// Squaad — Design Tokens & Constants
// ============================================================

export const COLORS = {
  // Theme Backgrounds
  background: '#09090b',     // Deep zinc black
  card: '#18181b',           // Sleek slate dark card
  cardSecondary: '#27272a',  // Mid zinc slate
  border: '#27272a',         // Thin border accent
  
  // Brand / Interactive Accents
  primary: '#6366f1',        // Vibrant Indigo
  primaryLight: '#818cf8',   // Light Indigo (highlights/interactive)
  secondary: '#a78bfa',      // Pastel Violet
  accent: '#10b981',         // Emerald Green (presence, confirmations)
  danger: '#ef4444',         // Rose Red (deletions, logs out)
  warning: '#f59e0b',        // Amber Gold
  
  // Typography
  textPrimary: '#f4f4f5',    // Zinc light white
  textSecondary: '#a1a1aa',  // Muted gray
  textMuted: '#52525b',      // Muted zinc dark
  textLight: '#ffffff',      // Pure white
  
  // Message bubbles
  bubbleSelf: '#6366f1',     // Indigo solid for user messages
  bubbleOther: '#1f1f23',    // Very dark gray for other messages
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const TYPOGRAPHY = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  }
};

export const SOCKET_URL = 'http://localhost:5000'; // Fallback URL, typically updated from store/env
export const API_URL = 'http://localhost:5000/api';
