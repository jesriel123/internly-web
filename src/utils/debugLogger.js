/**
 * Web Admin Debug Logger
 * Mirrors the mobile debug logger format for consistency.
 * All logs: [WEB-DEBUG] [COMPONENT] - action - timestamp
 */

const clickCounts = {};

const ts = () => new Date().toISOString();

export const logButtonClick = (name, isBlocked = false) => {
  clickCounts[name] = (clickCounts[name] || 0) + 1;
  console.log(`\n[WEB-DEBUG] ========================================`);
  console.log(`[WEB-DEBUG] [${name}] - CLICK #${clickCounts[name]} - ${ts()}`);
  if (isBlocked) {
    console.log(`[WEB-DEBUG] [${name}] - ⚠️ BLOCKED (request in progress) - ${ts()}`);
  }
  return clickCounts[name];
};

export const logRequestStart = (name) => {
  console.log(`[WEB-DEBUG] [${name}] - 🚀 REQUEST STARTED - ${ts()}`);
  return Date.now();
};

export const logRequestSuccess = (name, startTime) => {
  const ms = Date.now() - startTime;
  console.log(`[WEB-DEBUG] [${name}] - ✅ SUCCESS (${ms}ms) - ${ts()}`);
};

export const logRequestFailure = (name, startTime, error) => {
  const ms = Date.now() - startTime;
  console.log(`[WEB-DEBUG] [${name}] - ❌ FAILED (${ms}ms) - ${ts()}`);
  console.log(`[WEB-DEBUG] [${name}] - Error code: ${error?.code || 'none'}`);
  console.log(`[WEB-DEBUG] [${name}] - Error message: ${error?.message || String(error)}`);
  if (error?.stack) {
    console.log(`[WEB-DEBUG] [${name}] - Stack: ${error.stack.split('\n').slice(0, 3).join(' | ')}`);
  }
};

export const logNavigation = (from, to) => {
  console.log(`[WEB-DEBUG] [NAV] - ${from || '(init)'} → ${to} - ${ts()}`);
};

export const logAuthEvent = (event, email) => {
  console.log(`[WEB-DEBUG] [AUTH] - ${event}${email ? ` (${email})` : ''} - ${ts()}`);
};

/** Log current network status — call after any failure */
export const logNetworkStatus = () => {
  const online = navigator.onLine;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  console.log(`[WEB-DEBUG] [NETWORK] - online: ${online} - ${ts()}`);
  if (connection) {
    console.log(`[WEB-DEBUG] [NETWORK] - type: ${connection.effectiveType || 'unknown'}, downlink: ${connection.downlink ?? '?'} Mbps, rtt: ${connection.rtt ?? '?'}ms`);
  }
  console.log(`[WEB-DEBUG] ----------------------------------------`);
};
