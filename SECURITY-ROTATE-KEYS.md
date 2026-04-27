# 🔐 Security: Rotate Supabase API Keys

## Why Rotate?
Your `.env` files were committed to Git history, exposing your Supabase API keys.
While the `anon` key is designed for client-side use, it's best practice to rotate
keys that have been exposed in public repositories.

## Steps to Rotate Keys:

### 1. Go to Supabase Dashboard
- Visit: https://supabase.com/dashboard/project/yypexrwzgcdqmpvinfyt/settings/api

### 2. Generate New Keys
- Under "Project API keys" section
- Click "Reset" or "Regenerate" for the `anon` key
- Copy the new keys

### 3. Update Environment Files

**Internly-Web/.env:**
```env
REACT_APP_SUPABASE_URL=https://yypexrwzgcdqmpvinfyt.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<NEW_ANON_KEY_HERE>
REACT_APP_PASSWORD_RESET_REDIRECT=https://internly-web.vercel.app/reset-password
```

**Internly-Web/.env.local:**
```env
REACT_APP_SUPABASE_URL=https://yypexrwzgcdqmpvinfyt.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<NEW_ANON_KEY_HERE>
REACT_APP_PASSWORD_RESET_REDIRECT=http://localhost:3000/reset-password
```

**Internly-Mobile/.env:**
```env
EXPO_PUBLIC_PASSWORD_RESET_WEB_URL=https://internly-web.vercel.app/reset-password
EXPO_PUBLIC_PASSWORD_RESET_REDIRECT=internly://login
```

**Internly-Mobile/supabaseConfig.js:**
```javascript
const SUPABASE_URL = 'https://yypexrwzgcdqmpvinfyt.supabase.co';
const SUPABASE_ANON_KEY = '<NEW_ANON_KEY_HERE>';
```

**Internly-Web/src/supabaseConfig.js:**
Update to use env vars (already correct)

### 4. Update Vercel Environment Variables
- Go to: https://vercel.com/your-project/settings/environment-variables
- Update `REACT_APP_SUPABASE_ANON_KEY` with new key
- Redeploy

### 5. Clean Git History (Optional but Recommended)

⚠️ **WARNING: This rewrites Git history. Coordinate with your team!**

```bash
# Install BFG Repo-Cleaner
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

# Remove .env files from history
bfg --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (⚠️ DANGEROUS - coordinate with team!)
git push --force --all
```

## Option 2: Keep Current Keys (If Private Repo)

If your repository is **private** and you trust all collaborators:
- Current setup is acceptable
- Supabase `anon` key is designed for client-side use
- RLS policies protect your data
- Just ensure `.env` files stay gitignored going forward

## Current Security Status:

✅ **Good:**
- RLS policies are enabled
- `.env` files are now gitignored
- Using `anon` key (not service_role key)

⚠️ **Needs Attention:**
- Keys are in Git history
- Anyone with repo access can see old commits

## Best Practices Going Forward:

1. ✅ Never commit `.env` files
2. ✅ Use `.env.example` for templates
3. ✅ Rotate keys if exposed
4. ✅ Use RLS policies to protect data
5. ✅ Monitor Supabase logs for suspicious activity
6. ✅ Use environment variables in CI/CD (Vercel, etc.)

## Check if Repo is Public:

```bash
cd Internly-Web
git remote -v
# If it shows github.com, check if repo is public or private
```

If **public repo** → **MUST rotate keys immediately**
If **private repo** → Rotate keys as precaution (recommended)
