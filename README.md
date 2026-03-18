# QBookeeper 📚

A Chrome extension that lets you bookmark any page with a right-click and automatically categorizes it using **Google Gemini AI**.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome) ![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue) ![Gemini AI](https://img.shields.io/badge/Gemini-2.5--flash-orange?logo=google)

---

## ✨ Features

- **One-Click Bookmarking** — Right-click on any webpage and select **"Add QBookmark"** to save it instantly.
- **AI-Powered Categorization** — Uses Google Gemini (`gemini-2.5-flash`) to automatically classify bookmarks into one of four categories:
  - 📰 **News**
  - 📄 **Documents**
  - 🎬 **Media**
  - 🎮 **Gaming**
- **Organized Folder Structure** — All bookmarks are stored under `Bookmarks Bar > QBookmarks > <Category>`, keeping your bookmarks bar tidy.
- **Toast Notifications** — Provides real-time feedback with animated slide-in toasts:
  - 📚 *Saving bookmark…* (blue)
  - ✅ *Bookmark saved to QBookmarks/Category* (green)
  - ❌ *Failed to save bookmark* (red)
- **Zero Configuration** — No popup, no options page. Just install and start bookmarking.

---

## 📁 Project Structure

```
QBookeeper/
├── manifest.json      # Extension manifest (Manifest V3)
├── background.js      # Service worker — core logic (context menu, Gemini API, bookmarks)
├── icons/
│   ├── icon.svg       # Source SVG icon
│   ├── icon16.png     # 16×16 toolbar icon
│   ├── icon48.png     # 48×48 extension management icon
│   └── icon128.png    # 128×128 Chrome Web Store icon
└── README.md          # This file
```

---

## 🚀 Installation

### Load as an unpacked extension (Developer Mode)

1. **Clone the repository**

   ```bash
   git clone https://github.com/Quandeptrai97/QBookeeper.git
   ```

2. **Open Chrome** and navigate to:

   ```
   chrome://extensions/
   ```

3. **Enable Developer Mode** — Toggle the switch in the top-right corner.

4. **Click "Load unpacked"** — Select the `QBookeeper` folder (the one containing `manifest.json`).

5. **Done!** The QBookeeper icon should now appear in your extensions toolbar.

---

## 🔧 Usage

1. Navigate to any webpage you want to bookmark.
2. **Right-click** anywhere on the page.
3. Select **"Add QBookmark"** from the context menu.
4. The extension will:
   - Send the page title and URL to Gemini for categorization.
   - Create the folder structure `QBookmarks > <Category>` if it doesn't exist.
   - Save the bookmark under the appropriate category.
5. A **toast notification** will confirm the bookmark was saved (or report an error).

---

## 🛡️ Permissions

| Permission | Reason |
|---|---|
| `bookmarks` | Create and manage bookmarks and bookmark folders |
| `contextMenus` | Add the "Add QBookmark" right-click menu item |
| `scripting` | Inject toast notification scripts into the active tab |
| `activeTab` | Access the current tab's title and URL |
| `host_permissions` (Gemini API) | Communicate with Google's Generative Language API for AI categorization |

---

## 📝 Notes

- If Gemini returns an unexpected category, the extension defaults to **"Documents"**.
- The parent folder **QBookmarks** is always created inside the **Bookmarks Bar** (bookmark node ID `"1"`).
- The extension requires an active internet connection to communicate with the Gemini API.

---

## 📜 License

This project is open source. Feel free to fork, modify, and use it as you wish.