# Monteeq Mobile App - Setup & Build Guide

## Project Structure Created

Your Monteeq mobile app has been scaffolded using Expo and React Native. The project is located at:
```
/home/smasduq/montage/monteeq-mobile-expo/
```

### Technology Stack
- **Framework**: React Native with Expo
- **Language**: TypeScript
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Navigation**: Expo Router (File-based routing)
- **Video Player**: Expo AV

### Directory Structure

```
monteeq-mobile-expo/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx        # Tab navigation layout
│   │   ├── index.tsx          # Home feed screen
│   │   ├── flash.tsx          # Flash videos feed
│   │   ├── create.tsx         # Create video (placeholder)
│   │   ├── inbox.tsx          # Messages/notifications
│   │   └── profile.tsx        # User profile
│   ├── _layout.tsx            # Root layout
│   └── modal.tsx              # Modal example
├── services/
│   └── api.ts                 # API client with Monteeq endpoints
├── store/
│   └── appStore.ts            # Zustand state management
├── components/
│   └── video-card.tsx         # Video player component
├── app.json                   # Expo configuration
├── package.json               # Dependencies
└── tsconfig.json              # TypeScript config
```

## Implemented Features

### 1. **API Service** (`services/api.ts`)
- Video fetching by type (trending, flash)
- Single video retrieval
- Like/unlike functionality
- Video sharing
- User profile endpoints
- Follow/unfollow users

### 2. **State Management** (`store/appStore.ts`)
- Video list state
- Current user state
- Loading & error states
- Global app state with Zustand

### 3. **Screens**

#### Home Screen (`index.tsx`)
- Vertical scrolling feed of trending videos
- Pull-to-refresh functionality
- Loading states with spinner
- Error handling

#### Flash Screen (`flash.tsx`)
- Identical to home but fetches "flash" type videos
- Swipeable vertical feed
- Snap-to-page scrolling

#### Create Screen (`create.tsx`)
- Placeholder for video upload feature
- Ready for camera/gallery integration

#### Inbox Screen (`inbox.tsx`)
- Placeholder for notifications
- Ready for message implementation

#### Profile Screen (`profile.tsx`)
- Placeholder for user profile
- Ready for user stats and video history

### 4. **Video Card Component** (`components/video-card.tsx`)
- Full-screen video player using Expo AV
- Video metadata display (username, title)
- Action buttons (like, comment, share)
- Loading and error states
- Auto-play and looping

## Configuration

### API Endpoint
Update the API base URL in `services/api.ts`:
```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.monteeq.com/api/v1';
```

Set environment variable or modify `.env` file:
```
EXPO_PUBLIC_API_URL=https://api.monteeq.com/api/v1
```

### Branding
App is configured with Monteeq's dark theme:
- Primary color: `#FF3B30` (Red)
- Background: `#000000` (Black)
- UI theme: Dark mode
- App name: "Monteeq"
- Scheme: "monteeq"

## Dependencies Added

### Production
- `axios`: HTTP requests
- `expo-av`: Video playback
- `zustand`: State management
- Navigation packages (already included)

### Already Included (Expo Default)
- React 19
- React Native 0.81
- Expo Router (file-based routing)
- Expo AV (audio/video)
- Vector icons

## Next Steps

### 1. Install Dependencies
```bash
cd /home/smasduq/montage/monteeq-mobile-expo
npm install
```

### 2. Start Development Server
```bash
npm start
```
Then press:
- `i` for iOS
- `a` for Android
- `w` for web

### 3. Connect Backend
- Ensure your Monteeq API is running
- Update `EXPO_PUBLIC_API_URL` if needed
- API service will automatically handle video fetching

### 4. Complete Features

#### Create Screen
```typescript
// Add video upload functionality
// Use expo-image-picker for camera/gallery
// Use expo-media-library for saving
```

#### Profile Screen
```typescript
// Fetch user data from API
// Display user stats (followers, following, videos)
// Add logout functionality
```

#### Search/Discovery
- Create new screen for search
- Trending/recommended videos
- Category browsing

#### Comments & Likes
- Implement real-time interactions
- Comment threads
- Animated like button

## Running the App

### Web (Development)
```bash
npm run web
```

### Android (Emulator or Device)
```bash
npm run android
```

### iOS (Mac only)
```bash
npm run ios
```

## File-Based Routing

Expo Router uses file-based routing. Files in `app/` automatically become routes:
- `app/(tabs)/index.tsx` → Home tab
- `app/(tabs)/flash.tsx` → Flash tab
- etc.

Adding new screens is as simple as creating new `.tsx` files in `app/`.

## API Response Format Expected

The API service expects responses in these formats:

### Videos List
```json
{
  "data": [
    {
      "id": "string",
      "title": "string",
      "video_url": "string",
      "owner": {
        "username": "string",
        "avatar_url": "string"
      },
      "likes_count": 0
    }
  ]
}
```

### User Profile
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "followers_count": 0,
  "following_count": 0
}
```

## Troubleshooting

### API Not Loading Videos
1. Check network connectivity
2. Verify API URL in environment variables
3. Check CORS settings on backend
4. Inspect network tab in Expo DevTools

### Video Playback Issues
1. Ensure video URLs are publicly accessible
2. Check video format compatibility (MP4 recommended)
3. Verify network connectivity

### Build Errors
1. Run `npm install` again
2. Clear cache: `npm cache clean --force`
3. Delete `node_modules` and reinstall

## Architecture Notes

This is a **mobile-first** adaptation of your Monteeq web platform:
- Reuses your existing API endpoints
- Dark theme matches web version
- Similar feature set to web (feed, flash, profile)
- Scalable state management with Zustand
- TypeScript for type safety

The app shares the same backend API as your web version at `monteeq.com`, making it a true cross-platform experience.
