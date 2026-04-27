#!/usr/bin/env node
/**
 * Test Forgot Password Functionality
 * This script tests if the forgot password feature is working
 */

const https = require('https');

const BASE_URL = 'https://internll-projects.vercel.app';
const TEST_EMAIL = 'coligadojesriel343@gmail.com';

console.log('🧪 Testing Forgot Password Functionality\n');

// Test 1: Check if site is accessible
console.log('Test 1: Checking if site is accessible...');
https.get(BASE_URL, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Site is accessible (Status: 200)\n');
    
    // Test 2: Check if login page exists
    console.log('Test 2: Checking if login page exists...');
    https.get(`${BASE_URL}/login`, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Login page exists (Status: 200)\n');
        
        // Test 3: Check if reset password page exists
        console.log('Test 3: Checking if reset password page exists...');
        https.get(`${BASE_URL}/reset-password`, (res) => {
          if (res.statusCode === 200) {
            console.log('✅ Reset password page exists (Status: 200)\n');
            
            console.log('📋 Summary:');
            console.log('✅ All pages are accessible');
            console.log('✅ URLs are correct');
            console.log('');
            console.log('⚠️  To fully test forgot password:');
            console.log('1. Go to: ' + BASE_URL + '/login');
            console.log('2. Enter email: ' + TEST_EMAIL);
            console.log('3. Click "Forgot password?"');
            console.log('4. Check your email');
            console.log('5. Click the reset link');
            console.log('6. Enter new password');
            console.log('');
            console.log('🎯 If you receive the email, the function is working!');
          } else {
            console.log('❌ Reset password page not found (Status: ' + res.statusCode + ')');
          }
        }).on('error', (err) => {
          console.log('❌ Error accessing reset password page:', err.message);
        });
      } else {
        console.log('❌ Login page not found (Status: ' + res.statusCode + ')');
      }
    }).on('error', (err) => {
      console.log('❌ Error accessing login page:', err.message);
    });
  } else {
    console.log('❌ Site not accessible (Status: ' + res.statusCode + ')');
  }
}).on('error', (err) => {
  console.log('❌ Error accessing site:', err.message);
});
