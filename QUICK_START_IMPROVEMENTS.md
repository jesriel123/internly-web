# Quick Start: Using the New Improvements

This guide helps you quickly start using the new system improvements.

## 🚀 5-Minute Setup

### Step 1: Run Setup Script

```bash
cd Internly-Web
bash scripts/setup-dev.sh
```

This will:
- Install dependencies
- Create `.env.local` from template
- Set up directories

### Step 2: Configure Environment

Edit `.env.local`:
```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
REACT_APP_PASSWORD_RESET_REDIRECT=http://localhost:3000/reset-password
```

### Step 3: Run Migrations

```bash
node scripts/migrate.js
```

### Step 4: Start Development

```bash
npm start
```

---

## 📝 Common Tasks

### Creating a New Migration

1. Create file: `supabase/migrations/20260423130000_add_new_table.sql`
2. Write SQL:
```sql
-- Add your migration here
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
3. Run: `node scripts/migrate.js`

### Using Shared Utilities

```javascript
// Import utilities
import { withTimeout, validateFile, CONFIG } from './utils/sharedConfig';
import { fetchUserProfile, isSuperAdmin } from './utils/authHelpers';

// Use timeout wrapper
const data = await withTimeout(
  supabase.from('users').select(),
  'Fetching users'
);

// Validate file
const result = validateFile(file);
if (!result.valid) {
  alert(result.error);
}

// Check user role
if (isSuperAdmin(user)) {
  // Admin-only code
}
```

### Using TypeScript

```typescript
// Import types
import type { User, Company } from './types';

// Use types
const user: User = {
  uid: '123',
  email: 'user@example.com',
  name: 'John Doe',
  role: 'admin',
  company: 'Acme'
};

// Type-safe function
function updateUser(user: User): Promise<void> {
  // TypeScript will catch errors here
}
```

---

## 🔍 What Changed?

### Before
```javascript
// Scattered SQL files
check-notifications.sql
fix-registration.sql
ULTIMATE_FIX.sql

// Duplicated code
// Same timeout logic in multiple files

// No types
const user = { ... }; // What properties does this have?
```

### After
```javascript
// Organized migrations
supabase/migrations/
  20260423120000_schema_migrations.sql
  20260423130000_add_feature.sql

// Shared utilities
import { withTimeout } from './utils/sharedConfig';

// Type safety
const user: User = { ... }; // IDE knows all properties
```

---

## 🎯 Key Benefits

### 1. Database Migrations
- ✅ No more scattered SQL files
- ✅ Version control for database
- ✅ Easy to track what's applied

### 2. Shared Utilities
- ✅ No code duplication
- ✅ Consistent behavior
- ✅ Easy to maintain

### 3. TypeScript
- ✅ Catch errors early
- ✅ Better autocomplete
- ✅ Self-documenting code

### 4. Auth Helpers
- ✅ Consistent validation
- ✅ Reusable functions
- ✅ Better security

---

## 🐛 Troubleshooting

### Migration Fails

**Problem**: Migration script fails

**Solution**:
1. Check `.env.local` has correct credentials
2. Verify Supabase connection
3. Check SQL syntax in migration file
4. Look at error message for details

### TypeScript Errors

**Problem**: TypeScript shows errors

**Solution**:
1. Run `npm install` to get type definitions
2. Check `tsconfig.json` exists
3. Restart your IDE
4. Check type imports are correct

### Setup Script Fails

**Problem**: Setup script doesn't work

**Solution**:
1. Make sure you're in the correct directory
2. Check Node.js is installed: `node --version`
3. Check npm is installed: `npm --version`
4. Run with bash: `bash scripts/setup-dev.sh`

---

## 📚 Next Steps

1. **Read Full Documentation**: See `IMPROVEMENTS.md`
2. **Explore Types**: Check `src/types/index.ts`
3. **Review Utilities**: Look at `src/utils/sharedConfig.js`
4. **Check Migrations**: See `supabase/migrations/README.md`

---

## 💡 Tips

- Use TypeScript for new files (`.ts` or `.tsx`)
- Import shared utilities instead of duplicating code
- Create migrations for all database changes
- Run setup script when switching branches
- Keep `.env.local` updated with latest variables

---

**Need Help?** Check `IMPROVEMENTS.md` for detailed documentation.
