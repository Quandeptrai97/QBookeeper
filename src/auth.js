// OAuth2 token management for Chrome Identity API

/**
 * Get an OAuth2 bearer token via chrome.identity.
 * Prompts the user interactively if needed.
 */
export async function getOAuth2Token() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!token) {
        reject(new Error("Failed to obtain OAuth2 token"));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Remove a cached OAuth2 token so a fresh one can be obtained.
 */
export async function removeCachedToken(token) {
  return new Promise((resolve, reject) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}