// Chrome Bookmarks API helpers

import { PARENT_FOLDER_NAME } from "./config.js";

/**
 * Find an existing folder by name under a parent, or create it.
 */
async function getOrCreateFolder(name, parentId) {
  const children = await chrome.bookmarks.getChildren(parentId);
  const existing = children.find(
    (node) => !node.url && node.title === name
  );

  if (existing) return existing;

  return await chrome.bookmarks.create({
    parentId: parentId,
    title: name,
  });
}

/**
 * Get or create the folder structure: QBookmarks > <Category>
 * Returns the category folder ID.
 */
export async function getOrCreateCategoryFolder(category) {
  // "1" = Bookmarks Bar
  const parentFolder = await getOrCreateFolder(PARENT_FOLDER_NAME, "1");
  const categoryFolder = await getOrCreateFolder(category, parentFolder.id);
  return categoryFolder.id;
}

/**
 * Create a bookmark in the given folder.
 */
export async function createBookmark(parentId, title, url) {
  return await chrome.bookmarks.create({
    parentId,
    title,
    url,
  });
}