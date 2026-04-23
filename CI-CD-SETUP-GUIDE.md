# 🚀 CI/CD Setup Guide - Internly Web & Mobile

## Ano ang CI/CD?

**CI/CD** = Continuous Integration / Continuous Deployment

Ibig sabihin:
- ✅ Automatic testing pag may code changes
- ✅ Automatic deployment pag nag-push sa GitHub
- ✅ No manual deployment needed
- ✅ Faster development cycle

---

## Current Setup Status

### Web App (Internly-Web)
- ✅ **Vercel** - Already connected (partial CI/CD)
- 📍 URL: https://internly-web.vercel.app
- 🔄 Auto-deploys on push to `main` branch

### Mobile App (Internly-Mobile)
- ❌ **Not yet setup** - Need to configure EAS Build
- 📱 Platform: Expo / React Native

---

## Part 1: Complete Web App CI/CD (Vercel + GitHub Actions)

### Step 1: Verify Vercel Connection

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Find project: `internly-web`

2. **Check Git Integration**
   - Settings → Git
   - Should be connected to: `github.com/jesriel123/internly-web`

3. **Configure Environment Variables**
   - Settings → Environment Variables
   - Add these:
     ```
     REACT_APP_SUPABASE_URL = https://yypexrwzgcdqmpvinfyt.supabase.co
     REACT_APP_SUPABASE_ANON_KEY = <your-anon-key>
     REACT_APP_PASSWORD_RESET_REDIRECT = https://internly-web.vercel.app/reset-password
     ```

4. **Configure Build Settings**
   - Settings → General
   - Framework Preset: `Create React App`
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`

### Step 2: Add GitHub Actions for Testing

Create `.github/workflows/test.yml`:

```yaml
name: Test Web App

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test -- --passWithNoTests
      env:
        CI: true
    
    - name: Build
      run: npm run build
      env:
        REACT_APP_SUPABASE_URL: ${{ secrets.REACT_APP_SUPABASE_URL }}
        REACT_APP_SUPABASE_ANON_KEY: ${{ secrets.REACT_APP_SUPABASE_ANON_KEY }}
```

### Step 3: Add GitHub Secrets

1. Go to: `https://github.com/jesriel123/internly-web/settings/secrets/actions`
2. Click "New repository secret"
3. Add these secrets:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

---

## Part 2: Mobile App CI/CD (EAS Build + GitHub Actions)

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
eas login
```

### Step 3: Configure EAS Build

Check if `eas.json` exists and is properly configured:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step 4: Create GitHub Actions for Mobile

Create `.github/workflows/mobile-build.yml`:

```yaml
name: Build Mobile App

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Setup Expo
      uses: expo/expo-github-action@v8
      with:
        expo-version: latest
        eas-version: latest
        token: ${{ secrets.EXPO_TOKEN }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test -- --passWithNoTests
    
    - name: Build Android APK (Preview)
      run: eas build --platform android --profile preview --non-interactive
```

### Step 5: Get Expo Token

```bash
# Generate token
eas token:create

# Copy the token and add to GitHub Secrets:
# https://github.com/jesriel123/internly-mobile/settings/secrets/actions
# Secret name: EXPO_TOKEN
```

---

## Part 3: Automated Workflow

### Web App Workflow

```
Developer pushes code to GitHub
         ↓
GitHub Actions runs tests
         ↓
Tests pass? → Vercel auto-deploys
         ↓
Live at: https://internly-web.vercel.app
```

### Mobile App Workflow

```
Developer pushes code to GitHub
         ↓
GitHub Actions runs tests
         ↓
Tests pass? → EAS builds APK
         ↓
Download APK from Expo dashboard
```

---

## Part 4: Branch Strategy (Recommended)

### Setup Git Flow

```
main (production)
  ↓
develop (staging)
  ↓
feature/* (development)
```

### Vercel Configuration

1. **Production Branch**: `main`
   - Auto-deploy to: https://internly-web.vercel.app

2. **Preview Branch**: `develop`
   - Auto-deploy to: https://internly-web-dev.vercel.app

3. **Feature Branches**: `feature/*`
   - Auto-deploy to: https://internly-web-pr-123.vercel.app

---

## Part 5: Testing Setup

### Add Test Scripts to package.json

**Web App (Internly-Web/package.json):**
```json
{
  "scripts": {
    "test": "react-scripts test",
    "test:ci": "react-scripts test --watchAll=false --coverage"
  }
}
```

**Mobile App (Internly-Mobile/package.json):**
```json
{
  "scripts": {
    "test": "jest",
    "test:ci": "jest --coverage --watchAll=false"
  }
}
```

---

## Quick Start Commands

### Web App
```bash
cd Internly-Web

# Push to trigger deployment
git add .
git commit -m "feat: add new feature"
git push origin main

# Vercel will auto-deploy!
```

### Mobile App
```bash
cd Internly-Mobile

# Build preview APK
eas build --platform android --profile preview

# Build production APK
eas build --platform android --profile production
```

---

## Monitoring & Logs

### Vercel
- Deployments: https://vercel.com/dashboard
- Logs: Click on deployment → View logs

### GitHub Actions
- Actions: https://github.com/jesriel123/internly-web/actions
- View workflow runs and logs

### Expo EAS
- Builds: https://expo.dev/accounts/[your-account]/projects/internly-mobile/builds

---

## Troubleshooting

### Issue: Vercel deployment fails
**Solution:**
1. Check environment variables are set
2. Check build logs in Vercel dashboard
3. Verify `package.json` scripts are correct

### Issue: GitHub Actions fails
**Solution:**
1. Check secrets are added to GitHub
2. Review workflow logs
3. Ensure tests pass locally first

### Issue: EAS build fails
**Solution:**
1. Check `eas.json` configuration
2. Verify Expo token is valid
3. Check build logs in Expo dashboard

---

## Next Steps

1. ✅ Setup GitHub Actions for testing
2. ✅ Configure Vercel environment variables
3. ✅ Setup EAS Build for mobile
4. ✅ Add branch protection rules
5. ✅ Setup automated testing
6. ✅ Configure deployment notifications (Slack/Discord)

---

## Benefits of CI/CD

✅ **Faster Development**
- No manual deployment
- Automatic testing
- Quick feedback

✅ **Better Quality**
- Catch bugs early
- Consistent builds
- Code review integration

✅ **Team Collaboration**
- Preview deployments for PRs
- Easy rollbacks
- Deployment history

---

Ready to start? Let me know which part you want to setup first! 🚀
