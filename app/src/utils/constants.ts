// ============================================================
// Homie — Design Tokens & Constants (Instagram DM Style)
// ============================================================

export const COLORS = {
  // Theme Backgrounds
  background: '#000000',       // Pure black (Instagram)
  card: '#121212',             // Slightly lifted card surface
  cardSecondary: '#1c1c1e',    // Secondary card (input fields)
  border: '#262626',           // Instagram dark border
  
  // Brand / Interactive Accents
  primary: '#6c35de',          // Purple (own bubble base)
  primaryLight: '#9b59f0',     // Lighter purple highlights
  bubbleGradientEnd: '#d63384',// Pink gradient terminus
  accent: '#0095f6',           // Instagram blue (links, unread)
  onlineGreen: '#44d62c',      // Instagram online presence green
  danger: '#ed4956',           // Instagram red (delete, errors)
  warning: '#f59e0b',          // Amber Gold
  
  // Typography
  textPrimary: '#ffffff',      // Pure white
  textSecondary: '#8e8e8e',    // Instagram grey
  textMuted: '#555555',        // Muted dark grey
  textLight: '#ffffff',        // Pure white
  
  // Message bubbles
  bubbleSelf: '#6c35de',       // Purple for user messages (gradient start)
  bubbleOther: '#1c1c1e',      // Dark grey for other messages
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

export const SOCKET_URL = 'http://localhost:5000'; // Fallback URL
export const API_URL = 'http://localhost:5000/api';
