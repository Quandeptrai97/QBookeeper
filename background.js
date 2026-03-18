// QBookeeper - Right-click to bookmark & auto-categorize via Gemini
// Entry point: registers listeners and delegates to modules.

import { PARENT_FOLDER_NAME } from "./src/config.js";
import { categorizeWithGemini } from "./src/gemini.js";
import { getOrCreateCategoryFolder, createBookmark } from "./src/bookmarks.js";
import { showToast } from "./src/toast.js";

// ── Create context menu on install ──────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-qbookmark",
    title: "Add QBookmark",
    contexts: ["page"],
  });
});

// ── Handle context menu click ───────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "add-qbookmark") return;

  const title = tab.title || "Untitled";
  const url = tab.url;

  try {
    console.log(`[QBookeeper] Adding bookmark: "${title}" (${url})`);

    // Show "saving" toast
    await showToast(tab.id, "📚 Saving bookmark...", "info");

    // 1. Ask Gemini to categorize
    const category = await categorizeWithGemini(title, url);

    // 2. Find or create folder structure: QBookmarks > <Category>
    const categoryFolderId = await getOrCreateCategoryFolder(category);

    // 3. Save the bookmark
    await createBookmark(categoryFolderId, title, url);

    console.log(`[QBookeeper] Saved "${title}" to ${PARENT_FOLDER_NAME}/${category}`);

    // Show "saved successfully" toast
    await showToast(tab.id, `✅ Bookmark saved to ${PARENT_FOLDER_NAME}/${category}`, "success");
  } catch (err) {
    console.error("[QBookeeper] Error:", err.message);

    // Show error toast
    await showToast(tab.id, `❌ Failed to save bookmark: ${err.message}`, "error").catch(() => {});
  }
});