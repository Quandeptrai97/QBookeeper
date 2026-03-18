// QBookeeper - Right-click to bookmark & auto-categorize via Gemini

const GEMINI_API_KEY = "";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const CATEGORIES = ["News", "Documents", "Media", "Gaming"];
const PARENT_FOLDER_NAME = "QBookmarks";

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

    // 1. Ask Gemini to categorize
    const category = await categorizeWithGemini(title, url);

    // 2. Find or create folder structure: QBookmarks > <Category>
    const categoryFolderId = await getOrCreateCategoryFolder(category);

    // 3. Save the bookmark
    await chrome.bookmarks.create({
      parentId: categoryFolderId,
      title: title,
      url: url,
    });

    console.log(`[QBookeeper] Saved "${title}" to ${PARENT_FOLDER_NAME}/${category}`);

    // Show "saved successfully" toast
    await showToast(tab.id, `✅ Bookmark saved to ${PARENT_FOLDER_NAME}/${category}`, "success");
  } catch (err) {
    console.error("[QBookeeper] Error:", err.message);

    // Show error toast
    await showToast(tab.id, `❌ Failed to save bookmark: ${err.message}`, "error").catch(() => {});
  }
});

// ── Show a toast notification in the active tab ─────────
async function showToast(tabId, message, type = "info") {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [message, type],
    func: (message, type) => {
      // Remove any existing QBookeeper toast
      const existing = document.getElementById("qbookeeper-toast");
      if (existing) existing.remove();

      const toast = document.createElement("div");
      toast.id = "qbookeeper-toast";
      toast.textContent = message;

      const colors = {
        info: { bg: "#2196F3", text: "#fff" },
        success: { bg: "#4CAF50", text: "#fff" },
        error: { bg: "#f44336", text: "#fff" },
      };
      const color = colors[type] || colors.info;

      Object.assign(toast.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: "2147483647",
        padding: "12px 20px",
        borderRadius: "8px",
        backgroundColor: color.bg,
        color: color.text,
        fontSize: "14px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontWeight: "500",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        opacity: "0",
        transform: "translateX(100%)",
        transition: "all 0.3s ease",
        maxWidth: "350px",
        wordWrap: "break-word",
      });

      document.body.appendChild(toast);

      // Trigger slide-in animation
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(0)";
      });

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },
  });
}

// ── Call Gemini to categorize the bookmark ───────────────
async function categorizeWithGemini(title, url) {
  const prompt = `You are a bookmark categorizer. Given a webpage title and URL, categorize it into exactly one of these categories: ${CATEGORIES.join(", ")}.

Respond with only one word: the category name. Nothing else.

Title: ${title}
URL: ${url}`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 100,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log("[QBookeeper] Gemini full response:", JSON.stringify(data, null, 2));
  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

  // Validate the response is one of our categories (case-insensitive match)
  const matched = CATEGORIES.find(
    (cat) => cat.toLowerCase() === raw.toLowerCase()
  );

  if (!matched) {
    console.warn(`[QBookeeper] Gemini returned unexpected category "${raw}", defaulting to "Documents"`);
    return "Documents";
  }

  return matched;
}

// ── Find or create the QBookmarks > Category folder ─────
async function getOrCreateCategoryFolder(category) {
  // Find or create the parent "QBookmarks" folder in the bookmarks bar
  const parentFolder = await getOrCreateFolder(PARENT_FOLDER_NAME, "1"); // "1" = Bookmarks Bar

  // Find or create the category subfolder
  const categoryFolder = await getOrCreateFolder(category, parentFolder.id);

  return categoryFolder.id;
}

async function getOrCreateFolder(name, parentId) {
  // Search for existing folder
  const children = await chrome.bookmarks.getChildren(parentId);
  const existing = children.find(
    (node) => !node.url && node.title === name
  );

  if (existing) return existing;

  // Create if not found
  return await chrome.bookmarks.create({
    parentId: parentId,
    title: name,
  });
}