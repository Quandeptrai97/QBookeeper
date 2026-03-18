// Toast notification injection into active tab

/**
 * Show a toast notification in the given tab by injecting a script.
 * @param {number} tabId - The tab to show the toast in.
 * @param {string} message - The message to display.
 * @param {"info"|"success"|"error"} type - The toast style.
 */
export async function showToast(tabId, message, type = "info") {
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