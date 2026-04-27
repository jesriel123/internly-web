# State Management

This directory will contain state management setup using Zustand (lightweight alternative to Redux).

## Why Zustand?

- **Simple**: Less boilerplate than Redux
- **Small**: ~1KB bundle size
- **Fast**: No unnecessary re-renders
- **TypeScript**: Full TypeScript support
- **DevTools**: Redux DevTools integration

## Installation

```bash
npm install zustand
```

## Usage Example

```typescript
// stores/userStore.ts
import create from 'zustand';
import type { User } from '../types';

interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));

// In component
import { useUserStore } from './stores/userStore';

function MyComponent() {
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  
  // Use user and setUser
}
```

## Planned Stores

- `userStore` - User authentication state
- `notificationStore` - Notifications state
- `uiStore` - UI state (modals, loading, etc.)
- `companyStore` - Company data cache

## Next Steps

1. Install Zustand: `npm install zustand`
2. Create stores in this directory
3. Migrate Context API to Zustand
4. Add persistence with `zustand/middleware`
3