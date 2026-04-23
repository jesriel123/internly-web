# 🚀 Step-by-Step CI/CD Setup

Follow these steps in order to setup complete CI/CD for your projects.

---

## ✅ Step 1: Setup GitHub Secrets (Web App)

1. **Go to GitHub Web Repository**
   ```
   https://github.com/jesriel123/internly-web/settings/secrets/actions
   ```

2. **Click "New repository secret"**

3. **Add these secrets one by one:**

   **Secret 1:**
   - Name: `REACT_APP_SUPABASE_URL`
   - Value: `https://yypexrwzgcdqmpvinfyt.supabase.co`

   **Secret 2:**
   - Name: `REACT_APP_SUPABASE_ANON_KEY`
   - Value: `<your-supabase-anon-key>` (from .env file)

---

## ✅ Step 2: Push GitHub Actions Workflows

```bash
# Web App
cd Internly-Web
git add .github/
git commit -m "ci: add GitHub Actions workflows"
git push origin main

# Mobile App
cd ../Internly-Mobile
git add .github/
git commit -m "ci: add GitHub Actions workflows"
git push origin main
```

---

## ✅ Step 3: Verify GitHub Actions

1. **Go to Actions tab:**
   - Web: https://github.com/jesriel123/internly-web/actions
   - Mobile: https://github.com/jesriel123/internly-mobile/actions

2. **Check if workflow runs successfully**
   - Should see green checkmark ✅
   - If red ❌, click to see logs

---

## ✅ Step 4: Setup Vercel (Web App)

### 4.1 Connect to Vercel (if not yet)

1. **Go to Vercel:**
   ```
   https://vercel.com/new
   ```

2. **Import Git Repository:**
   - Select: `jesriel123/internly-web`
   - Click "Import"

3. **Configure Project:**
   - Framework Preset: `Create React App`
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `build`

### 4.2 Add Environment Variables

1. **Go to Project Settings:**
   ```
   https://vercel.com/[your-username]/internly-web/settings/environment-variables
   ```

2. **Add these variables:**

   | Key | Value | Environment |
   |-----|-------|-------------|
   | `REACT_APP_SUPABASE_URL` | `https://yypexrwzgcdqmpvinfyt.supabase.co` | Production, Preview, Development |
   | `REACT_APP_SUPABASE_ANON_KEY` | `<your-anon-key>` | Production, Preview, Development |
   | `REACT_APP_PASSWORD_RESET_REDIRECT` | `https://internly-web.vercel.app/reset-password` | Production |
   | `REACT_APP_PASSWORD_RESET_REDIRECT` | `http://localhost:3000/reset-password` | Development |

3. **Click "Save"**

### 4.3 Trigger Deployment

```bash
cd Internly-Web
git commit --allow-empty -m "chore: trigger deployment"
git push origin main
```

4. **Check Deployment:**
   - Go to: https://vercel.com/dashboard
   - Should see deployment in progress
   - Wait for "Ready" status
   - Click "Visit" to see live site

---

## ✅ Step 5: Setup EAS Build (Mobile App)

### 5.1 Install EAS CLI

```bash
npm install -g eas-cli
```

### 5.2 Login to Expo

```bash
eas login
```

Enter your Expo credentials (or create account at expo.dev)

### 5.3 Configure Project

```bash
cd Internly-Mobile
eas build:configure
```

This will create/update `eas.json`

### 5.4 Create Expo Token for GitHub Actions

```bash
eas token:create
```

Copy the token that appears.

### 5.5 Add Token to GitHub Secrets

1. **Go to:**
   ```
   https://github.com/jesriel123/internly-mobile/settings/secrets/actions
   ```

2. **Add secret:**
   - Name: `EXPO_TOKEN`
   - Value: `<paste-token-here>`

### 5.6 Test Build Locally

```bash
# Build preview APK
eas build --platform android --profile preview

# This will:
# 1. Upload your code to Expo servers
# 2. Build APK in the cloud
# 3. Give you download link when done
```

---

## ✅ Step 6: Test the Complete Workflow

### Test Web App CI/CD

```bash
cd Internly-Web

# Make a small change
echo "// CI/CD test" >> src/App.js

# Commit and push
git add .
git commit -m "test: verify CI/CD pipeline"
git push origin main

# Watch the magic happen:
# 1. GitHub Actions runs tests
# 2. Vercel auto-deploys
# 3. Live in ~2 minutes!
```

**Check progress:**
- GitHub Actions: https://github.com/jesriel123/internly-web/actions
- Vercel: https://vercel.com/dashboard

### Test Mobile App CI/CD

```bash
cd Internly-Mobile

# Make a small change
echo "// CI/CD test" >> App.js

# Commit and push
git add .
git commit -m "test: verify CI/CD pipeline"
git push origin main

# Check GitHub Actions:
# https://github.com/jesriel123/internly-mobile/actions
```

---

## ✅ Step 7: Setup Branch Protection (Optional but Recommended)

### Web App

1. **Go to:**
   ```
   https://github.com/jesriel123/internly-web/settings/branches
   ```

2. **Add rule for `main` branch:**
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select: `test` (from GitHub Actions)

### Mobile App

Same steps for:
```
https://github.com/jesriel123/internly-mobile/settings/branches
```

---

## 🎉 You're Done!

### What You Now Have:

**Web App:**
- ✅ Automatic testing on every push
- ✅ Automatic deployment to Vercel
- ✅ Preview deployments for PRs
- ✅ Live at: https://internly-web.vercel.app

**Mobile App:**
- ✅ Automatic testing on every push
- ✅ Manual EAS builds via GitHub Actions
- ✅ APK downloads from Expo dashboard

---

## Daily Workflow

### For Web Development:

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes
# ... code code code ...

# 3. Commit and push
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# 4. Create Pull Request on GitHub
# 5. GitHub Actions runs tests
# 6. Vercel creates preview deployment
# 7. Review and merge
# 8. Auto-deploys to production!
```

### For Mobile Development:

```bash
# 1. Make changes
# ... code code code ...

# 2. Test locally
npm start

# 3. Commit and push
git add .
git commit -m "feat: add new feature"
git push origin main

# 4. Build when ready
eas build --platform android --profile preview

# 5. Download APK from Expo dashboard
# 6. Test on device
```

---

## Troubleshooting

### GitHub Actions failing?
- Check secrets are added correctly
- Review workflow logs
- Ensure tests pass locally first

### Vercel deployment failing?
- Check environment variables
- Review build logs
- Verify build command works locally

### EAS build failing?
- Check eas.json configuration
- Verify Expo token is valid
- Review build logs in Expo dashboard

---

## Need Help?

- GitHub Actions Docs: https://docs.github.com/en/actions
- Vercel Docs: https://vercel.com/docs
- EAS Build Docs: https://docs.expo.dev/build/introduction/

---

Happy deploying! 🚀
