// Bookeeper - Enhanced Bookmarks with AI Search via LiteLLM
(function () {
  "use strict";

  const searchInput = document.getElementById("searchInput");
  const resultCount = document.getElementById("resultCount");
  const bookmarkContainer = document.getElementById("bookmarkContainer");
  const aiToggle = document.getElementById("aiToggle");
  const aiResponse = document.getElementById("aiResponse");
  const aiSettings = document.getElementById("aiSettings");
  const litellmUrlInput = document.getElementById("litellmUrl");
  const litellmModelInput = document.getElementById("litellmModel");
  const litellmApiKeyInput = document.getElementById("litellmApiKey");

  let allBookmarks = []; // flat list of all bookmark nodes (with url)
  let bookmarkTree = []; // original tree from chrome API
  let aiEnabled = true; // AI search enabled by default
  let abortController = null; // for cancelling in-flight AI requests

  // ── Load saved settings ───────────────────────────────
  function loadSettings() {
    const saved = localStorage.getItem("bookeeper_settings");
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.litellmUrl) litellmUrlInput.value = settings.litellmUrl;
        if (settings.litellmModel) litellmModelInput.value = settings.litellmModel;
        if (settings.litellmApiKey) litellmApiKeyInput.value = settings.litellmApiKey;
        if (settings.aiEnabled !== undefined) {
          aiEnabled = settings.aiEnabled;
          aiToggle.classList.toggle("active", aiEnabled);
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  function saveSettings() {
    const settings = {
      litellmUrl: litellmUrlInput.value,
      litellmModel: litellmModelInput.value,
      litellmApiKey: litellmApiKeyInput.value,
      aiEnabled: aiEnabled,
    };
    localStorage.setItem("bookeeper_settings", JSON.stringify(settings));
  }

  // ── Init ──────────────────────────────────────────────
  async function init() {
    loadSettings();
    bookmarkContainer.innerHTML = '<div class="loading">Loading bookmarks...</div>';
    try {
      bookmarkTree = await chrome.bookmarks.getTree();
      allBookmarks = flattenBookmarks(bookmarkTree);
      renderTree(bookmarkTree);
      updateResultCount(allBookmarks.length);
    } catch (err) {
      bookmarkContainer.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Failed to load bookmarks</div><div class="empty-state-sub">' +
        escapeHtml(err.message) +
        "</div></div>";
    }
  }

  // ── Flatten bookmarks for search ──────────────────────
  function flattenBookmarks(nodes) {
    const result = [];
    function walk(nodes, path) {
      for (const node of nodes) {
        if (node.url) {
          result.push({ ...node, path });
        }
        if (node.children) {
          const folderPath = node.title ? [...path, node.title] : path;
          walk(node.children, folderPath);
        }
      }
    }
    walk(nodes, []);
    return result;
  }

  // ── Build bookmark summary for AI context ─────────────
  function buildBookmarkSummary() {
    // Send a compact representation of bookmarks to the AI
    // Limit to avoid token overflow
    const maxBookmarks = 500;
    const bookmarks = allBookmarks.slice(0, maxBookmarks).map((bm) => ({
      title: bm.title || "Untitled",
      url: bm.url,
      folder: bm.path.join(" > "),
    }));
    return JSON.stringify(bookmarks);
  }

  // ── AI Search via LiteLLM ────────────────────────────
  async function performAISearch(query) {
    // Cancel any in-flight request
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    const baseUrl = litellmUrlInput.value.replace(/\/+$/, "");
    const model = litellmModelInput.value || "gpt-4o-mini";
    const apiKey = litellmApiKeyInput.value;

    // Show loading state
    aiResponse.classList.remove("hidden");
    aiResponse.innerHTML = '<div class="ai-loading"><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span> Thinking...</div>';

    // Also run local search in parallel
    performLocalSearch(query);

    const systemPrompt = `You are a helpful bookmark search assistant. The user has the following bookmarks saved in their browser. When they ask a question, find and recommend the most relevant bookmarks. Format your response in Markdown. For each relevant bookmark, show it as a clickable link. If the query doesn't match any bookmarks, say so and suggest alternatives. Be concise.

Here are the user's bookmarks:
${buildBookmarkSummary()}`;

    const headers = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LiteLLM returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content || "No response from AI.";

      // Render AI response
      aiResponse.innerHTML = "";
      const responseContent = document.createElement("div");
      responseContent.className = "ai-response-content";
      responseContent.innerHTML = renderMarkdown(aiText);
      aiResponse.appendChild(responseContent);

      // Make links in AI response open in new tab
      aiResponse.querySelectorAll("a").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      });

    } catch (err) {
      if (err.name === "AbortError") return; // cancelled, ignore

      aiResponse.innerHTML = "";
      const errorDiv = document.createElement("div");
      errorDiv.className = "ai-error";
      errorDiv.innerHTML = `<span class="ai-error-icon">⚠️</span> <strong>LiteLLM Error:</strong> ${escapeHtml(err.message)}
        <div class="ai-error-hint">Make sure LiteLLM is running at <code>${escapeHtml(baseUrl)}</code>. <button class="ai-settings-toggle-btn" id="showSettingsFromError">⚙️ Settings</button></div>`;
      aiResponse.appendChild(errorDiv);

      // Attach event to the settings button in error
      const btn = document.getElementById("showSettingsFromError");
      if (btn) {
        btn.addEventListener("click", () => {
          aiSettings.classList.toggle("hidden");
        });
      }
    }
  }

  // ── Simple Markdown renderer ──────────────────────────
  function renderMarkdown(text) {
    let html = escapeHtml(text);

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Links: [text](url)
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" class="ai-link">$1</a>'
    );

    // Bare URLs
    html = html.replace(
      /(?<![">])(https?:\/\/[^\s<]+)/g,
      '<a href="$1" class="ai-link">$1</a>'
    );

    // Numbered lists
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, "<li>$2</li>");
    html = html.replace(/(<li>.*<\/li>)/s, "<ol>$1</ol>");

    // Bullet lists
    html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");

    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  // ── Render full bookmark tree ─────────────────────────
  function renderTree(tree) {
    bookmarkContainer.innerHTML = "";
    for (const root of tree) {
      if (root.children) {
        for (const child of root.children) {
          const el = renderNode(child);
          if (el) bookmarkContainer.appendChild(el);
        }
      }
    }

    if (bookmarkContainer.children.length === 0) {
      bookmarkContainer.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No bookmarks yet</div><div class="empty-state-sub">Add some bookmarks to see them here</div></div>';
    }
  }

  function renderNode(node) {
    if (node.url) {
      return createBookmarkElement(node);
    }

    if (node.children && node.children.length > 0) {
      return createFolderElement(node);
    }

    return null;
  }

  function createFolderElement(node) {
    const folder = document.createElement("div");
    folder.className = "folder";

    const header = document.createElement("div");
    header.className = "folder-header";

    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.textContent = "▾";

    const name = document.createElement("span");
    name.className = "folder-name";
    name.textContent = node.title || "Untitled Folder";

    const count = document.createElement("span");
    count.className = "folder-count";
    const totalCount = countBookmarks(node);
    count.textContent = `(${totalCount})`;

    header.appendChild(icon);
    header.appendChild(name);
    header.appendChild(count);

    const children = document.createElement("div");
    children.className = "folder-children";

    for (const child of node.children) {
      const el = renderNode(child);
      if (el) children.appendChild(el);
    }

    header.addEventListener("click", () => {
      const isCollapsed = children.classList.toggle("collapsed");
      icon.classList.toggle("collapsed", isCollapsed);
    });

    folder.appendChild(header);
    folder.appendChild(children);
    return folder;
  }

  function createBookmarkElement(node, highlightQuery) {
    const a = document.createElement("a");
    a.className = "bookmark-item";
    a.href = node.url;
    a.title = node.url;

    // Favicon
    const favicon = document.createElement("img");
    favicon.className = "bookmark-favicon";
    try {
      const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
      faviconUrl.searchParams.set("pageUrl", node.url);
      faviconUrl.searchParams.set("size", "32");
      favicon.src = faviconUrl.toString();
    } catch {
      favicon.src = "";
    }
    favicon.alt = "";
    favicon.onerror = function () {
      this.style.visibility = "hidden";
    };

    const info = document.createElement("div");
    info.className = "bookmark-info";

    const title = document.createElement("div");
    title.className = "bookmark-title";

    const url = document.createElement("div");
    url.className = "bookmark-url";

    if (highlightQuery) {
      title.innerHTML = highlightText(node.title || "Untitled", highlightQuery);
      url.innerHTML = highlightText(node.url, highlightQuery);
    } else {
      title.textContent = node.title || "Untitled";
      url.textContent = node.url;
    }

    info.appendChild(title);
    info.appendChild(url);
    a.appendChild(favicon);
    a.appendChild(info);

    return a;
  }

  function countBookmarks(node) {
    let count = 0;
    if (node.url) count++;
    if (node.children) {
      for (const child of node.children) {
        count += countBookmarks(child);
      }
    }
    return count;
  }

  // ── Local Search ──────────────────────────────────────
  function performLocalSearch(query) {
    query = query.trim().toLowerCase();

    if (!query) {
      renderTree(bookmarkTree);
      updateResultCount(allBookmarks.length);
      return;
    }

    const terms = query.split(/\s+/);
    const matches = allBookmarks.filter((bm) => {
      const titleLower = (bm.title || "").toLowerCase();
      const urlLower = (bm.url || "").toLowerCase();
      return terms.every(
        (term) => titleLower.includes(term) || urlLower.includes(term)
      );
    });

    bookmarkContainer.innerHTML = "";

    if (matches.length === 0) {
      bookmarkContainer.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No bookmarks found</div><div class="empty-state-sub">Try a different search term</div></div>';
      updateResultCount(0);
      return;
    }

    for (const bm of matches) {
      const el = createBookmarkElement(bm, query);
      bookmarkContainer.appendChild(el);
    }

    updateResultCount(matches.length);
  }

  // ── Combined Search Handler ───────────────────────────
  function performSearch(query) {
    const trimmed = query.trim();

    if (!trimmed) {
      // Clear AI response and show all bookmarks
      aiResponse.classList.add("hidden");
      aiResponse.innerHTML = "";
      renderTree(bookmarkTree);
      updateResultCount(allBookmarks.length);
      return;
    }

    if (aiEnabled) {
      performAISearch(trimmed);
    } else {
      aiResponse.classList.add("hidden");
      aiResponse.innerHTML = "";
      performLocalSearch(trimmed);
    }
  }

  // ── Highlight matched text ────────────────────────────
  function highlightText(text, query) {
    if (!query) return escapeHtml(text);

    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length); // longest first

    const escaped = escapeHtml(text);

    // Build a regex that matches any of the terms
    const pattern = terms.map(escapeRegex).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");

    return escaped.replace(regex, '<span class="highlight">$1</span>');
  }

  // ── Utilities ─────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function updateResultCount(count) {
    const query = searchInput.value.trim();
    if (query) {
      resultCount.textContent = `${count} result${count !== 1 ? "s" : ""}`;
    } else {
      resultCount.textContent = `${count} bookmark${count !== 1 ? "s" : ""}`;
    }
  }

  // ── Debounce ──────────────────────────────────────────
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ── Event Listeners ───────────────────────────────────

  // Search input - use longer debounce for AI to avoid spamming
  const debouncedSearch = debounce(() => {
    performSearch(searchInput.value);
  }, aiEnabled ? 500 : 200);

  searchInput.addEventListener("input", debouncedSearch);

  // Enter key triggers immediate search
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performSearch(searchInput.value);
    }
  });

  // AI Toggle button
  aiToggle.addEventListener("click", () => {
    aiEnabled = !aiEnabled;
    aiToggle.classList.toggle("active", aiEnabled);
    searchInput.placeholder = aiEnabled
      ? "Ask AI about your bookmarks..."
      : "Search bookmarks...";

    // Hide AI response when switching to local
    if (!aiEnabled) {
      aiResponse.classList.add("hidden");
      aiResponse.innerHTML = "";
    }

    saveSettings();

    // Re-run search with current query
    const query = searchInput.value.trim();
    if (query) {
      performSearch(query);
    }
  });

  // Right-click AI toggle to show settings
  aiToggle.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    aiSettings.classList.toggle("hidden");
  });

  // Save settings on change
  litellmUrlInput.addEventListener("change", saveSettings);
  litellmModelInput.addEventListener("change", saveSettings);
  litellmApiKeyInput.addEventListener("change", saveSettings);

  // Keyboard shortcut: Ctrl/Cmd + K to focus search
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    // Escape to clear search
    if (e.key === "Escape" && document.activeElement === searchInput) {
      searchInput.value = "";
      performSearch("");
      searchInput.blur();
    }
  });

  // ── Start ─────────────────────────────────────────────
  init();
})();