// QBookeeper - Right-click to bookmark & auto-categorize via LLM

const LITELLM_BASE_URL = "http://localhost:6655";
const LITELLM_MODEL = "gpt-4o-mini";
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
    console.log("Adding Qbookmark");

    // 1. Ask LLM to categorize
    const category = await categorizeWithLLM(title, url);

    // 2. Find or create folder structure: QBookmarks > <Category>
    const categoryFolderId = await getOrCreateCategoryFolder(category);

    // 3. Save the bookmark
    await chrome.bookmarks.create({
      parentId: categoryFolderId,
      title: title,
      url: url,
    });

    console.log(`[QBookeeper] Saved "${title}" to ${PARENT_FOLDER_NAME}/${category}`);
  } catch (err) {
    console.error("[QBookeeper] Error:", err.message);
  }
});

// ── Call LiteLLM to categorize the bookmark ─────────────
async function categorizeWithLLM(title, url) {
  const prompt = `You are a bookmark categorizer. Given a webpage title and URL, categorize it into exactly one of these categories: ${CATEGORIES.join(", ")}.

Respond with only one word: the category name. Nothing else.

Title: ${title}
URL: ${url}`;

  const response = await fetch(`${LITELLM_BASE_URL}/litellm/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LITELLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LiteLLM returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const raw = (data.choices?.[0]?.message?.content || "").trim();

  // Validate the response is one of our categories (case-insensitive match)
  const matched = CATEGORIES.find(
    (cat) => cat.toLowerCase() === raw.toLowerCase()
  );

  if (!matched) {
    console.warn(`[QBookeeper] LLM returned unexpected category "${raw}", defaulting to "Documents"`);
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