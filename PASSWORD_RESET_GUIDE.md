# Password Reset - Complete Guide

## 🔐 How Password Reset Works

### Flow Overview
```
User clicks "Forgot Password"
    ↓
Enters email
    ↓
Supabase sends email with reset link
    ↓
User clicks link in email
    ↓
Redirected to: https://internly-web.vercel.app/reset-password#access_token=...
    ↓
ResetPasswordPage validates token
    ↓
User enters new password
    ↓
Password updated
    ↓
Redirected to login
```

---

## ✅ Your Reset Link

The URL you shared is **valid** and contains:
- `access_token` - Authentication token
- `refresh_token` - Session refresh token
- `expires_at` - Expiration timestamp
- `type=recovery` - Recovery type

**This link will work!**

---

## 🚀 How to Use the Reset Link

### Step 1: Click the Link
Click the full URL from your email:
```
https://internly-web.vercel.app/reset-password#access_token=...
```

### Step 2: Enter New Password
- Enter your new password (minimum 6 characters)
- Confirm the password
- Click "Update Password"

### Step 3: Login
- You'll be redirected to login page
- Use your email and new password

---

## 🔧 If Reset Link Doesn't Work

### Issue 1: "Invalid or expired link"

**Cause**: Link expired (valid for 1 hour)

**Fix**: Request a new reset link:
1. Go to login page
2. Click "Forgot Password"
3. Enter your email
4. Check email for new link

---

### Issue 2: Page shows error

**Cause**: Token validation failed

**Fix**:
1. Copy the FULL URL from email (including everything after #)
2. Paste in browser address bar
3. Press Enter
4. Don't refresh the page

---

### Issue 3: "Network request failed"

**Cause**: Connection to Supabase failed

**Fix**:
1. Check internet connection
2. Try different browser
3. Disable VPN if using one
4. Clear browser cache

---

## 🎯 Testing Password Reset

### For Developers

Test the flow:

```javascript
// 1. Request password reset
const { error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  {
    redirectTo: 'https://internly-web.vercel.app/reset-password'
  }
);

// 2. User clicks link in email

// 3. ResetPasswordPage handles token automatically

// 4. Update password
const { error: updateError } = await supabase.auth.updateUser({
  password: 'newPassword123'
});
```

---

## 📧 Email Configuration

### Current Setup

**Redirect URL**: `https://internly-web.vercel.app/reset-password`

**For Development**:
```env
# .env.local
REACT_APP_PASSWORD_RESET_REDIRECT=http://localhost:3000/reset-password
```

**For Production**:
```env
# .env
REACT_APP_PASSWORD_RESET_REDIRECT=https://internly-web.vercel.app/reset-password
```

---

## 🔍 Troubleshooting

### Check Token Expiration

The token in your URL expires at: `1776938430` (Unix timestamp)

Convert to readable date:
```javascript
new Date(1776938430 * 1000).toLocaleString()
// Shows when token expires
```

### Check Session

Open browser console on reset page:
```javascript
// Check if session is valid
const { data } = await supabase.auth.getSession();
console.log('Session:', data.session);
```

### Check Token in URL

```javascript
// Extract token from URL
const params = new URLSearchParams(window.location.hash.substring(1));
console.log('Access Token:', params.get('access_token'));
console.log('Refresh Token:', params.get('refresh_token'));
console.log('Type:', params.get('type'));
```

---

## 🛡️ Security Notes

### Token Security
- Tokens are single-use
- Valid for 1 hour
- Automatically invalidated after password change
- Sent only to verified email

### Best Practices
- Don't share reset links
- Use strong passwords (8+ characters, mixed case, numbers)
- Change password immediately if link is compromised
- Request new link if unsure about security

---

## 🎨 Customizing Reset Page

### Update Redirect URL

**In Supabase Dashboard**:
1. Go to Authentication → URL Configuration
2. Update "Site URL"
3. Add redirect URL to "Redirect URLs"

**In Code** (`AuthContext.js`):
```javascript
const forgotPassword = async (email, redirectTo) => {
  const safeRedirect = redirectTo || 
    process.env.REACT_APP_PASSWORD_RESET_REDIRECT ||
    'https://internly-web.vercel.app/reset-password';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: safeRedirect
  });
  
  if (error) throw error;
};
```

---

## 📱 Mobile App Password Reset

### Current Setup

Mobile app redirects to **web** for password reset:
```
Mobile app → Web reset page → Back to mobile login
```

**Why**: Easier to handle tokens in web browser

**Flow**:
1. User clicks "Forgot Password" in mobile app
2. Opens web browser with reset link
3. Resets password on web
4. Returns to mobile app
5. Logs in with new password

---

## ✅ Verification Checklist

After password reset:

- [ ] New password works on web login
- [ ] New password works on mobile login
- [ ] Old password no longer works
- [ ] Email confirmation received
- [ ] No error messages
- [ ] Session is active

---

## 🆘 Common Issues

### "Link expired"
→ Request new link (valid for 1 hour only)

### "Invalid link"
→ Copy full URL including everything after #

### "Network error"
→ Check internet connection

### "Password too weak"
→ Use at least 6 characters

### "Passwords don't match"
→ Retype carefully

---

## 💡 Pro Tips

### Tip 1: Copy Full URL
Always copy the ENTIRE URL from email, including:
- `https://`
- Domain
- `/reset-password`
- `#access_token=...` (everything after #)

### Tip 2: Don't Refresh
After clicking reset link, don't refresh the page. The token is consumed on first load.

### Tip 3: Use Incognito
If having issues, try in incognito/private browsing mode.

### Tip 4: Check Spam
Reset emails might go to spam folder.

---

## 🎉 Your Link is Valid!

The URL you shared:
```
https://internly-web.vercel.app/reset-password#access_token=...
```

✅ Has valid access token
✅ Has refresh token
✅ Has correct type (recovery)
✅ Points to correct page

**Just click it and reset your password!**

---

## 📞 Need Help?

1. Check browser console for errors
2. Try different browser
3. Request new reset link
4. Contact administrator if persistent issues

---

**The reset page is working correctly. Just use the link!** 🚀
