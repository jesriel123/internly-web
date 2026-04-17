# Reset Password No Internet Fix - Bugfix Design

## Overview

The mobile app incorrectly displays "no internet" or network error messages during authentication operations (login, password reset request, password reset completion) even when the device has active internet connectivity. The issue stems from a 12-second timeout (`AUTH_TIMEOUT_MS`) that may be too short for slower network conditions or distant API endpoints, combined with error handling that doesn't distinguish between actual network failures, API timeouts, and other error types.

The fix will:
1. Increase the timeout duration to accommodate slower connections
2. Improve error detection to distinguish between network connectivity issues, API timeouts, and other failures
3. Provide accurate error messages that reflect the actual problem
4. Preserve existing error handling for genuine network failures and invalid credentials

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when authentication operations timeout after 12 seconds on a working internet connection, resulting in misleading "no internet" error messages
- **Property (P)**: The desired behavior - authentication operations should either succeed within a reasonable timeframe or display accurate error messages that distinguish between network connectivity issues, API timeouts, and other failure modes
- **Preservation**: Existing error handling for genuine network failures, invalid credentials, and expired reset links must remain unchanged
- **withTimeout**: The wrapper function in `AuthContext.js` that enforces timeout limits on Supabase auth operations
- **AUTH_TIMEOUT_MS**: The constant defining the timeout duration (currently 12000ms / 12 seconds)
- **bindRecoverySession**: The function in `ResetPasswordScreen.js` that validates password reset links and establishes recovery sessions

## Bug Details

### Bug Condition

The bug manifests when authentication operations (login, password reset request, password reset completion) take longer than 12 seconds to complete due to slow network conditions, distant API endpoints, or API processing delays. The `withTimeout` wrapper function rejects the promise with a generic timeout error, which is then caught by error handlers that incorrectly interpret it as a network connectivity failure.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AuthOperation { operation: string, networkAvailable: boolean, duration: number }
  OUTPUT: boolean
  
  RETURN input.operation IN ['login', 'forgotPassword', 'resetPassword', 'verifyResetLink']
         AND input.networkAvailable == true
         AND input.duration >= AUTH_TIMEOUT_MS
         AND errorMessageIndicatesNetworkFailure(input.errorMessage)
END FUNCTION
```

### Examples

- User attempts to log in with valid credentials on a slow 3G connection. After 12 seconds, the app displays "Network error. Please check your internet connection" even though the device can access other internet services.

- User requests a password reset email while connected to WiFi. The Supabase API takes 13 seconds to process the request due to server load. The app displays an error suggesting no internet connectivity instead of indicating a timeout.

- User clicks a password reset link from their email. The `bindRecoverySession` function times out after 12 seconds while validating the token, displaying "Unable to validate reset link" with a network-related error message, even though the link is valid and internet is available.

- User on a corporate network with slower API response times consistently sees "no internet" errors during authentication, preventing them from using the app despite having full internet access.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When a user has no internet connectivity, the app must continue to display appropriate "no internet connection" error messages
- When a user provides invalid credentials during login, the app must continue to display "Incorrect email or password" error messages
- When a user provides an invalid or expired reset link, the app must continue to display appropriate validation error messages
- When authentication operations succeed, the app must continue to navigate users to the appropriate screens and register push notifications as expected
- All existing error codes from Supabase (auth/user-not-found, auth/wrong-password, auth/invalid-credential, auth/too-many-requests) must continue to be handled correctly

**Scope:**
All inputs that do NOT involve timeout scenarios on working internet connections should be completely unaffected by this fix. This includes:
- Genuine network connectivity failures (device offline, no WiFi/cellular)
- Invalid credentials or authentication data
- Successful authentication operations that complete quickly
- Other non-timeout error conditions from the Supabase API

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Insufficient Timeout Duration**: The 12-second timeout (`AUTH_TIMEOUT_MS = 12000`) is too short for:
   - Slow network connections (3G, poor WiFi signal)
   - Geographically distant API endpoints (high latency)
   - API server processing delays during high load
   - Mobile network handoffs or temporary slowdowns

2. **Inadequate Error Differentiation**: The `withTimeout` function throws a generic timeout error that doesn't distinguish between:
   - Actual network connectivity failures (device offline)
   - API timeout due to slow response (device online but operation slow)
   - The error handlers in `LoginScreen.js` and `ResetPasswordScreen.js` catch these timeout errors and display network-related messages

3. **Error Message Mapping**: The catch blocks in authentication flows map timeout errors to "network error" messages without checking if the device actually has internet connectivity

4. **Duplicate Timeout Logic**: Both `AuthContext.js` and `ResetPasswordScreen.js` define their own `withTimeout` functions with the same 12-second limit, requiring fixes in multiple locations

## Correctness Properties

Property 1: Bug Condition - Authentication Operations Complete or Timeout Accurately

_For any_ authentication operation (login, password reset request, password reset completion) where the device has internet connectivity and the operation takes longer than the original timeout, the fixed code SHALL either complete successfully within an extended timeout period OR display an accurate error message that distinguishes between API timeout and network connectivity failure.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Existing Error Handling Unchanged

_For any_ authentication operation where the bug condition does NOT hold (genuine network failures, invalid credentials, successful fast operations, expired reset links), the fixed code SHALL produce exactly the same error messages and navigation behavior as the original code, preserving all existing error handling logic.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `Internly-Mobile/src/context/AuthContext.js`

**Function**: `withTimeout`, `login`, `forgotPassword`

**Specific Changes**:
1. **Increase Timeout Duration**: Change `AUTH_TIMEOUT_MS` from 12000 (12s) to 30000 (30s) to accommodate slower connections
   - This provides a more reasonable window for API operations on slow networks
   - Still prevents indefinite hangs while being more tolerant of latency

2. **Enhance Timeout Error**: Modify `timeoutError` function to create errors with a distinct code or property
   - Add a `code: 'auth/timeout'` property to timeout errors
   - This allows downstream error handlers to distinguish timeouts from network failures

3. **Improve Error Messages in Login**: Update the catch block in `login` flow to check for timeout errors specifically
   - If error code is 'auth/timeout', display: "Request timed out. Please check your connection and try again."
   - If error code is 'auth/network-request-failed', display existing network error message
   - Preserve all other existing error code mappings

4. **Improve Error Messages in Forgot Password**: Update the catch block in `forgotPassword` flow
   - Check for timeout errors and display appropriate timeout message
   - Preserve existing error handling for other cases

**File**: `Internly-Mobile/src/screens/ResetPasswordScreen.js`

**Function**: `withTimeout`, `bindRecoverySession`, `handleUpdatePassword`

**Specific Changes**:
1. **Increase Timeout Duration**: Change `AUTH_TIMEOUT_MS` from 12000 (12s) to 30000 (30s)
   - Match the timeout duration in AuthContext for consistency

2. **Enhance Timeout Error**: Modify `timeoutError` function to include `code: 'auth/timeout'`
   - Consistent with AuthContext implementation

3. **Improve Error Messages in Reset Link Validation**: Update catch blocks in `bindRecoverySession` and `handleUpdatePassword`
   - Detect timeout errors and display: "Validation timed out. Please check your connection and try again."
   - Preserve existing error messages for invalid links, expired tokens, etc.

**File**: `Internly-Mobile/src/screens/LoginScreen.js`

**Function**: `handleLogin`, `submitForgotPassword`

**Specific Changes**:
1. **Update Error Handling in Login**: Modify the catch block to check for timeout error code
   - If error code is 'auth/timeout', display: "Login timed out. Please check your connection and try again."
   - Preserve all existing error code mappings (auth/user-not-found, auth/wrong-password, etc.)

2. **Update Error Handling in Forgot Password**: Modify the catch block to handle timeout errors
   - Display appropriate timeout message instead of generic network error
   - Preserve existing error handling

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code by simulating slow network conditions, then verify the fix works correctly with extended timeouts and accurate error messages while preserving existing error handling.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate authentication operations with artificial delays exceeding 12 seconds while maintaining internet connectivity. Mock the Supabase API to respond slowly. Run these tests on the UNFIXED code to observe timeout errors being misreported as network failures.

**Test Cases**:
1. **Slow Login Test**: Mock `supabase.auth.signInWithPassword` to delay 15 seconds, verify it times out and displays "Network error" (will fail on unfixed code - should show timeout message)
2. **Slow Password Reset Request**: Mock `supabase.auth.resetPasswordForEmail` to delay 15 seconds, verify it times out with network error message (will fail on unfixed code)
3. **Slow Reset Link Validation**: Mock `supabase.auth.setSession` to delay 15 seconds, verify it times out with misleading error (will fail on unfixed code)
4. **Fast Operation Test**: Mock API to respond in 2 seconds, verify success (should pass on unfixed code - baseline)

**Expected Counterexamples**:
- Authentication operations that take 13-20 seconds display "Network error. Please check your internet connection" instead of timeout messages
- Possible causes: 12-second timeout too short, timeout errors mapped to network errors, no distinction between timeout and connectivity failure

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := authOperation_fixed(input)
  ASSERT result.errorMessage CONTAINS "timed out" OR result.errorMessage CONTAINS "timeout"
  ASSERT result.errorMessage NOT CONTAINS "no internet" OR result.errorMessage NOT CONTAINS "network error"
  ASSERT result.completed == false OR result.duration < EXTENDED_TIMEOUT
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT authOperation_original(input).errorMessage = authOperation_fixed(input).errorMessage
  ASSERT authOperation_original(input).navigationTarget = authOperation_fixed(input).navigationTarget
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various error codes, network states, credential combinations)
- It catches edge cases that manual unit tests might miss (rare error codes, boundary conditions)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for various error scenarios (invalid credentials, expired links, genuine network failures), then write property-based tests capturing that behavior and verify it remains unchanged after the fix.

**Test Cases**:
1. **Invalid Credentials Preservation**: Observe that "Incorrect email or password" displays for wrong credentials on unfixed code, verify this continues after fix
2. **Network Failure Preservation**: Observe that genuine network failures (device offline) display "Network error" on unfixed code, verify this continues after fix
3. **Expired Link Preservation**: Observe that expired reset links display appropriate validation errors on unfixed code, verify this continues after fix
4. **Success Flow Preservation**: Observe that successful fast authentications navigate correctly on unfixed code, verify this continues after fix

### Unit Tests

- Test timeout duration increase (verify AUTH_TIMEOUT_MS = 30000)
- Test timeout error includes 'auth/timeout' code
- Test error message mapping for timeout errors vs network errors
- Test that operations completing within 30 seconds succeed
- Test that operations exceeding 30 seconds still timeout (but with better message)

### Property-Based Tests

- Generate random network delay scenarios (0-40 seconds) and verify correct error messages for each range
- Generate random Supabase error codes and verify existing error message mappings are preserved
- Generate random credential combinations and verify authentication logic unchanged
- Test across many scenarios that timeout errors never display "no internet" messages

### Integration Tests

- Test full login flow with simulated slow network (15-second delay)
- Test full password reset request flow with simulated slow network
- Test full password reset completion flow with simulated slow network
- Test that genuine network failures still display appropriate messages
- Test that invalid credentials still display appropriate messages
- Test that successful fast operations still work correctly
