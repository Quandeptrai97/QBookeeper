// Gemini API integration for bookmark categorization

import { GEMINI_URL, CATEGORIES } from "./config.js";
import { getOAuth2Token, removeCachedToken } from "./auth.js";

/**
 * System instruction that defines Gemini's role and behavior.
 * Separated from user content for better prompt adherence and token efficiency.
 */
const SYSTEM_INSTRUCTION = `You are a bookmark categorizer. Given a webpage title and URL, categorize it into exactly one of these categories: ${CATEGORIES.join(", ")}.

Respond with only one word: the category name. Nothing else.`;

/**
 * Build the request body for Gemini API.
 * Uses systemInstruction for behavioral pre-conditions, separate from user content.
 */
function buildRequestBody(title, url) {
  return JSON.stringify({
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        parts: [{ text: `Title: ${title}\nURL: ${url}` }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 100,
    },
  });
}

/**
 * Parse the Gemini response and match it to a valid category.
 * Returns the matched category or "Documents" as default.
 */
function parseCategoryResponse(data) {
  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  const matched = CATEGORIES.find(
    (cat) => cat.toLowerCase() === raw.toLowerCase()
  );

  if (!matched) {
    console.warn(`[QBookeeper] Gemini returned unexpected category "${raw}", defaulting to "Documents"`);
    return "Documents";
  }

  return matched;
}

/**
 * Call Gemini to categorize a bookmark by title and URL.
 * Handles token expiry with a single retry.
 */
export async function categorizeWithGemini(title, url) {
  const body = buildRequestBody(title, url);

  // Get OAuth2 bearer token
  const token = await getOAuth2Token();

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  // If we get a 401, the token may be stale — remove it and retry once
  if (response.status === 401) {
    console.warn("[QBookeeper] OAuth2 token expired, refreshing...");
    await removeCachedToken(token);

    const newToken = await getOAuth2Token();
    const retryResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
      },
      body,
    });

    if (!retryResponse.ok) {
      const errorText = await retryResponse.text();
      throw new Error(`Gemini returned ${retryResponse.status}: ${errorText}`);
    }

    const retryData = await retryResponse.json();
    console.log("[QBookeeper] Gemini full response:", JSON.stringify(retryData, null, 2));
    return parseCategoryResponse(retryData);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log("[QBookeeper] Gemini full response:", JSON.stringify(data, null, 2));
  return parseCategoryResponse(data);
}