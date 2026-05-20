# Squaad — Private Group Chat App
### Project Spec & Build Plan (AI-ready)

---

## 0. What this project is

A **private, invite-only Android chat app** for a closed group of friends.  
No public signup. No app store. Just a group of people who trust each other, chatting securely.

**Core principles:**
- Free infrastructure only (Firebase, Render, Supabase, Cloudinary, GitHub)
- Android APK only — no iOS
- Production-quality code — no shortcuts
- Budget: ₹0 to ₹150/month max
- No video or voice calls

---

## 1. Tech Stack (locked in)

| Layer | Tool | Why |
|---|---|---|
| Mobile app | React Native + Expo (SDK 51+) | One codebase, APK output via EAS Build |
| Auth + OTP | Firebase Authentication (Phone) | 10,000 free OTPs/month, auto SMS read on Android |
| Backend | Node.js (Express) on Render | Free tier, auto-deploy from GitHub |
| Real-time | Socket.io (on same Render server) | Handles messaging, typing, presence |
| Database | Supabase (PostgreSQL) | 500MB free, no 90-day expiry like Render DB |
| Media/Files | Cloudinary | 25GB storage + bandwidth free |
| Push notifs | Firebase Cloud Messaging (FCM) | Completely free, no limits |
| APK builds | Expo EAS Build | 30 free builds/month, no local Android Studio needed |
| Code hosting | GitHub (private repo) | Free, Render auto-deploys on push |
| Server uptime | UptimeRobot | Free 5-min ping to prevent Render sleep |

---

## 2. Repository Structure

```
squaad/
├── app/                        # React Native (Expo) mobile app
│   ├── src/
│   │   ├── screens/
│   │   │   ├── AuthScreen.tsx          # Phone input + OTP verify
│   │   │   ├── HomeScreen.tsx          # Chat list
│   │   │   ├── ChatScreen.tsx          # Individual chat / group chat
│   │   │   ├── GroupInfoScreen.tsx     # Group name, members
│   │   │   └── ProfileScreen.tsx       # User settings
│   │   ├── components/
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MediaPicker.tsx
│   │   │   ├── VoiceNoteRecorder.tsx
│   │   │   ├── ReactionPicker.tsx
│   │   │   └── TypingIndicator.tsx
│   │   ├── services/
│   │   │   ├── socket.ts               # Socket.io client
│   │   │   ├── api.ts                  # REST calls to backend
│   │   │   ├── firebase.ts             # Firebase Auth + FCM setup
│   │   │   └── cloudinary.ts           # Media upload helper
│   │   ├── store/                      # Zustand state management
│   │   │   ├── authStore.ts
│   │   │   ├── chatStore.ts
│   │   │   └── uiStore.ts
│   │   ├── utils/
│   │   │   ├── encryption.ts           # libsodium helpers
│   │   │   ├── dateFormat.ts
│   │   │   └── notify.ts
│   │   └── navigation/
│   │       └── AppNavigator.tsx
│   ├── app.json
│   ├── eas.json
│   └── package.json
│
├── server/                     # Node.js backend
│   ├── src/
│   │   ├── index.ts                    # Entry point, Express + Socket.io init
│   │   ├── routes/
│   │   │   ├── auth.ts                 # /auth/verify-token, /auth/whitelist
│   │   │   ├── messages.ts             # /messages (REST fallback)
│   │   │   ├── groups.ts               # /groups CRUD
│   │   │   ├── users.ts                # /users profile
│   │   │   └── media.ts                # /media upload signature
│   │   ├── socket/
│   │   │   ├── handlers.ts             # All socket event handlers
│   │   │   └── middleware.ts           # Socket auth guard
│   │   ├── db/
│   │   │   ├── client.ts               # Supabase client init
│   │   │   └── migrations/             # SQL migration files
│   │   ├── middleware/
│   │   │   ├── auth.ts                 # JWT verify middleware
│   │   │   └── rateLimit.ts
│   │   └── utils/
│   │       ├── fcm.ts                  # Push notification sender
│   │       └── whitelist.ts            # Phone number allow-list checker
│   ├── .env.example
│   └── package.json
│
└── README.md
```

---

## 3. Database Schema (Supabase / PostgreSQL)

```sql
-- Users (created on first OTP verify)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT UNIQUE NOT NULL,        -- E.164 format: +919876543210
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  fcm_token   TEXT,                        -- updated on each app open
  is_active   BOOLEAN DEFAULT true,        -- admin can deactivate
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Whitelist (only these numbers can register)
CREATE TABLE whitelist (
  phone       TEXT PRIMARY KEY,            -- E.164 format
  added_by    UUID REFERENCES users(id),
  added_at    TIMESTAMPTZ DEFAULT now()
);

-- Conversations (DMs and Groups)
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT CHECK (type IN ('dm', 'group')) NOT NULL,
  name        TEXT,                        -- null for DMs
  avatar_url  TEXT,                        -- null for DMs
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Conversation members
CREATE TABLE conversation_members (
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  role             TEXT DEFAULT 'member',  -- 'admin' | 'member'
  joined_at        TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID REFERENCES users(id),
  type             TEXT DEFAULT 'text',    -- 'text' | 'image' | 'video' | 'file' | 'voice' | 'deleted'
  content          TEXT,                   -- encrypted text or media URL
  reply_to_id      UUID REFERENCES messages(id),  -- for quoted replies
  is_edited        BOOLEAN DEFAULT false,
  edited_at        TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,            -- for disappearing messages (null = never)
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Message read receipts
CREATE TABLE message_reads (
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Reactions
CREATE TABLE reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- Pinned messages (per conversation)
CREATE TABLE pinned_messages (
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id       UUID REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by        UUID REFERENCES users(id),
  pinned_at        TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, message_id)
);
```

---

## 4. API Routes

### Auth
```
POST   /auth/verify-token     Firebase ID token → issue app JWT + check whitelist
POST   /auth/register         First-time: save name, avatar; returns user object
GET    /auth/me               Get current user profile
```

### Users
```
GET    /users/:id             Get user profile
PATCH  /users/me              Update name, avatar, FCM token
GET    /users/me/sessions      List active sessions (devices)
DELETE /users/me/sessions/:id  Revoke a session
```

### Conversations
```
GET    /conversations              List all conversations for current user
POST   /conversations              Create DM or Group
GET    /conversations/:id          Get conversation details + members
PATCH  /conversations/:id          Update group name/avatar (admin only)
DELETE /conversations/:id/leave    Leave a group
POST   /conversations/:id/members  Add member (admin only)
DELETE /conversations/:id/members/:userId  Remove member (admin only)
GET    /conversations/:id/messages  Paginated message history (cursor-based)
GET    /conversations/:id/pinned    Get pinned messages
```

### Messages
```
POST   /messages                   Send a message (REST fallback, primary is socket)
PATCH  /messages/:id               Edit message content
DELETE /messages/:id               Delete for everyone (sets type = 'deleted')
POST   /messages/:id/pin           Pin a message
DELETE /messages/:id/pin           Unpin a message
POST   /messages/:id/reactions     Add reaction
DELETE /messages/:id/reactions/:emoji  Remove reaction
```

### Media
```
POST   /media/sign                 Get Cloudinary signed upload URL
```

### Admin
```
GET    /admin/whitelist            List whitelisted numbers
POST   /admin/whitelist            Add a number
DELETE /admin/whitelist/:phone     Remove a number
```

---

## 5. Socket.io Events

### Client → Server (emit)
```
join_conversation    { conversationId }
leave_conversation   { conversationId }
send_message         { conversationId, type, content, replyToId? }
typing_start         { conversationId }
typing_stop          { conversationId }
mark_read            { conversationId, messageId }
update_presence      { status: 'online' | 'offline' }
```

### Server → Client (on)
```
new_message          { message object }
message_edited       { messageId, newContent, editedAt }
message_deleted      { messageId }
reaction_added       { messageId, userId, emoji }
reaction_removed     { messageId, userId, emoji }
user_typing          { conversationId, userId, name }
user_stopped_typing  { conversationId, userId }
read_receipt         { messageId, userId, readAt }
user_online          { userId }
user_offline         { userId, lastSeen }
member_added         { conversationId, user }
member_removed       { conversationId, userId }
```

---

## 6. Auth Flow (step by step)

```
1. User opens app
2. App checks for stored JWT → if valid, skip to step 8
3. AuthScreen: user types phone number (with +91 prefix picker)
4. App calls Firebase signInWithPhoneNumber()
5. Firebase sends OTP SMS to phone
6. On Android: SMS is auto-read (no typing needed) via SMS Retriever API
7. User (or auto) enters 6-digit OTP
8. Firebase verifies OTP → returns Firebase ID Token
9. App sends ID Token to POST /auth/verify-token
10. Server verifies token with Firebase Admin SDK
11. Server checks phone number in whitelist table
    → NOT in whitelist: return 403 { error: 'not_invited' }
    → IN whitelist: continue
12. If first login: redirect to registration (enter name, pick avatar)
13. Server creates user row, issues signed JWT (7 day expiry)
14. App stores JWT in SecureStore (Expo)
15. App connects Socket.io with JWT in handshake auth header
16. App loads HomeScreen
```

---

## 7. Features — Full List

### Must-have (Phase 1)
- [ ] Phone + OTP auth (Firebase)
- [ ] Invite-only whitelist gate
- [ ] Profile setup (name + avatar)
- [ ] DM (1-to-1 chat)
- [ ] Group chat (create, name, add/remove members)
- [ ] Real-time messaging via Socket.io
- [ ] Text messages
- [ ] Image send (Cloudinary upload)
- [ ] File send (PDF, ZIP, any — Cloudinary)
- [ ] Message delivery receipts (sent / delivered / read ticks)
- [ ] Push notifications via FCM
- [ ] Delete message for everyone
- [ ] Emoji reactions
- [ ] Reply / quote a message

### Phase 2
- [ ] Voice note recording + playback with waveform
- [ ] Edit message (within 5-minute window)
- [ ] Typing indicator ("Priya is typing…")
- [ ] @mentions in groups
- [ ] Mute conversation (8h / 1 week / forever)
- [ ] Pin messages in a chat
- [ ] Disappearing messages (set timer: 1h / 24h / 7d)
- [ ] Forward message to another chat
- [ ] Polls in groups
- [ ] Online / last seen (with privacy toggle)
- [ ] View once images (disappears after opening)

### Phase 3 (advanced)
- [ ] Custom sticker packs (group uploads their own)
- [ ] Message search within a chat
- [ ] Multi-device session manager (see + revoke devices)
- [ ] Screenshot detection alert
- [ ] Event planning card (date + place + RSVP)
- [ ] Biometric app lock (fingerprint / face unlock)
- [ ] Scheduled DND hours

---

## 8. Encryption Plan

Messages will use **libsodium** (via `libsodium-wrappers` npm package).

```
Approach: Symmetric encryption per conversation
- On group/DM creation, server generates a random 32-byte conversation key
- Key is encrypted with each member's public key and stored in DB
- Each device holds its private key in Expo SecureStore
- All message content is encrypted before sending to server
- Server stores only ciphertext — cannot read messages
- Media: encrypted before upload to Cloudinary; decryption key in message payload
```

> Note: Full E2E with key exchange is complex. For v1, encrypt messages with a server-managed key stored server-side (transport encryption). Upgrade to true E2E (device-held keys) in Phase 2.

---

## 9. Environment Variables

### Server (.env)
```env
PORT=3000
NODE_ENV=production

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# Firebase Admin
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# JWT
JWT_SECRET=your-very-long-random-secret
JWT_EXPIRY=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx
```

### App (.env / app.config.js)
```env
EXPO_PUBLIC_API_URL=https://your-app.onrender.com
EXPO_PUBLIC_FIREBASE_API_KEY=xxxxx
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xxxxx
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=xxxxx
```

---

## 10. Build & Deploy

### Backend (Render)
```bash
# Render settings:
# Build command:  npm install && npm run build
# Start command:  node dist/index.js
# Health check:   /health

# Auto-deploys on push to: main branch
```

### Android APK (EAS)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure (run once)
eas build:configure

# Build APK (not AAB — APK for direct install)
eas build --platform android --profile preview

# eas.json profile for APK:
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}

# After build: download APK link → share over WhatsApp to friends
```

### UptimeRobot (keep Render alive)
```
Monitor type: HTTP(s)
URL: https://your-app.onrender.com/health
Interval: 5 minutes
Alert: email you if it goes down
```

---

## 11. Build Order (for AI coding sessions)

Work in this exact sequence. Each phase is a working app, not a half-built one.

```
Phase 1 — Backend skeleton
  Step 1.1  Express server + health route + Supabase connection
  Step 1.2  Firebase Admin SDK init + /auth/verify-token route
  Step 1.3  Whitelist check middleware
  Step 1.4  JWT issue + auth middleware for protected routes
  Step 1.5  Socket.io setup + JWT handshake guard
  Step 1.6  Run DB migrations (all tables above)
  Step 1.7  Deploy to Render + set env vars + set up UptimeRobot

Phase 2 — App skeleton
  Step 2.1  Expo project init + install dependencies
  Step 2.2  Firebase Auth setup in app
  Step 2.3  AuthScreen — phone input + OTP verify + call /auth/verify-token
  Step 2.4  SecureStore JWT save + auto-login on app open
  Step 2.5  Socket.io client connect with JWT
  Step 2.6  Stack navigator (Auth → Home → Chat)

Phase 3 — Core chat
  Step 3.1  HomeScreen — list conversations (REST fetch)
  Step 3.2  Create DM flow
  Step 3.3  ChatScreen — render message list
  Step 3.4  Send text message via socket
  Step 3.5  Receive message in real-time via socket
  Step 3.6  MessageBubble component (own vs others, timestamps)
  Step 3.7  Delivery/read receipts

Phase 4 — Groups
  Step 4.1  Create group (name + pick members from contact list)
  Step 4.2  Group chat screen (same ChatScreen, different type)
  Step 4.3  GroupInfoScreen (members list, add/remove)

Phase 5 — Media
  Step 5.1  Cloudinary signed upload helper
  Step 5.2  Image picker + upload + send image message
  Step 5.3  File picker + upload + send file message
  Step 5.4  Media preview screen

Phase 6 — Notifications + Polish
  Step 6.1  FCM token registration on app open
  Step 6.2  Backend sends push on new message (when user offline)
  Step 6.3  Notification tap → open correct chat
  Step 6.4  Emoji reactions UI
  Step 6.5  Reply / quote UI
  Step 6.6  Delete message
  Step 6.7  Profile screen (update name + avatar)

Phase 7 — APK
  Step 7.1  Set up eas.json with preview profile
  Step 7.2  eas build --platform android --profile preview
  Step 7.3  Test APK on real device
  Step 7.4  Distribute via direct link
```

---

## 12. Key Packages

### App (React Native / Expo)
```json
{
  "expo": "~51.0.0",
  "react-native": "0.74.x",
  "@react-navigation/native": "^6",
  "@react-navigation/stack": "^6",
  "socket.io-client": "^4.7",
  "firebase": "^10",
  "expo-secure-store": "~13",
  "expo-image-picker": "~15",
  "expo-document-picker": "~12",
  "expo-av": "~14",
  "expo-notifications": "~0.28",
  "expo-local-authentication": "~14",
  "zustand": "^4",
  "dayjs": "^1",
  "react-native-gifted-chat": "^2",
  "libsodium-wrappers": "^0.7"
}
```

### Server (Node.js)
```json
{
  "express": "^4",
  "socket.io": "^4.7",
  "@supabase/supabase-js": "^2",
  "firebase-admin": "^12",
  "jsonwebtoken": "^9",
  "cloudinary": "^2",
  "express-rate-limit": "^7",
  "helmet": "^7",
  "cors": "^2",
  "dotenv": "^16",
  "typescript": "^5",
  "tsx": "^4"
}
```

---

## 13. Rules for the AI building this

1. **TypeScript everywhere** — no plain JS files
2. **No any types** — define proper interfaces for all data shapes
3. **All routes authenticated** except `/auth/verify-token` and `/health`
4. **Rate limit** the OTP verification route (5 attempts per phone per hour)
5. **Validate all inputs** server-side — never trust the client
6. **Phone numbers** always stored in E.164 format (`+919876543210`)
7. **UUIDs** for all IDs — never sequential integers
8. **Paginate** message history — cursor-based, 30 messages per page
9. **Never log** message content on the server
10. **Env vars** for all secrets — nothing hardcoded
11. One file = one responsibility — no 500-line files
12. Error responses always return `{ error: 'snake_case_code', message: 'human readable' }`

---

*App name: Squaad (placeholder — rename as needed)*  
*Target: Android 10+ (API 29+)*  
*Language: TypeScript (strict mode)*  
*Last updated: May 2026*
