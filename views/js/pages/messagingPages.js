import { API_BASE, apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, "");

function getToken() {
  return localStorage.getItem("craftify_access_token") || "";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return "-";
  }
  return dt.toLocaleString();
}

export function wireMessagingChatPage() {
  var threadListEl = document.getElementById("chat-thread-list");
  if (!threadListEl) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in to access messages", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var countEl = document.getElementById("chat-conversation-count");
  var searchEl = document.getElementById("chat-thread-search");
  var activeNameEl = document.getElementById("chat-active-name");
  var messagesEl = document.getElementById("chat-messages");
  var inputEl = document.getElementById("chat-message-input");
  var sendBtn = document.getElementById("chat-send-btn");

  var currentUser = {};
  try {
    currentUser = JSON.parse(localStorage.getItem("craftify_user") || "{}");
  } catch (_error) {
    currentUser = {};
  }

  var currentUserId = currentUser.id || "";
  var conversations = [];
  var activeConversation = null;
  var socket = null;

  function otherParticipant(conversation) {
    var participants = conversation.participants || [];
    var fallbackUser = participants[0] && participants[0].user ? participants[0].user : null;
    return (
      participants
        .map(function (p) {
          return p.user || null;
        })
        .find(function (u) {
          return u && u.id !== currentUserId;
        }) || fallbackUser || null
    );
  }

  function renderMessages(items) {
    if (!messagesEl) {
      return;
    }

    if (!items.length) {
      messagesEl.innerHTML = "<div class=\"text-center text-secondary text-sm\">No messages yet. Start the conversation.</div>";
      return;
    }

    messagesEl.innerHTML = items
      .map(function (message) {
        var mine = message.senderId === currentUserId;
        if (mine) {
          return (
            "<div class=\"flex flex-row-reverse items-start gap-3 max-w-[75%] ml-auto\"><div class=\"space-y-1 text-right\">" +
            "<div class=\"bg-primary text-on-primary p-4 rounded-2xl rounded-tr-none leading-relaxed text-sm shadow-lg shadow-primary/10\">" +
            message.content +
            "</div><span class=\"text-[10px] text-secondary mr-1\">" +
            new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
            "</span></div></div>"
          );
        }

        return (
          "<div class=\"flex items-start gap-3 max-w-[75%]\"><div class=\"space-y-1\">" +
          "<div class=\"bg-surface-container-low text-on-surface p-4 rounded-2xl rounded-tl-none leading-relaxed text-sm\">" +
          message.content +
          "</div><span class=\"text-[10px] text-secondary ml-1\">" +
          new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
          "</span></div></div>"
        );
      })
      .join("");

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function selectConversation(conversation) {
    activeConversation = conversation;
    var other = otherParticipant(conversation);

    if (activeNameEl) {
      activeNameEl.textContent = other && other.fullName ? other.fullName : "Conversation";
    }

    if (socket && conversation && conversation.id) {
      socket.emit("join:conversation", conversation.id);
    }

    api("/messages/" + encodeURIComponent(conversation.id))
      .then(function (data) {
        renderMessages(data.items || []);
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  }

  function renderThreads() {
    var query = searchEl ? searchEl.value.trim().toLowerCase() : "";
    var list = conversations.filter(function (conversation) {
      if (!query) {
        return true;
      }
      var other = otherParticipant(conversation);
      var last = conversation.messages && conversation.messages[0] ? conversation.messages[0].content || "" : "";
      var haystack = ((other && other.fullName) || "") + " " + last;
      return haystack.toLowerCase().indexOf(query) >= 0;
    });

    if (countEl) {
      countEl.textContent = String(conversations.length);
    }

    if (!list.length) {
      threadListEl.innerHTML = "<div class=\"p-4 text-sm text-secondary\">No conversations found.</div>";
      return;
    }

    threadListEl.innerHTML = list
      .map(function (conversation) {
        var other = otherParticipant(conversation);
        var name = (other && other.fullName) || "Conversation";
        var avatar = (other && other.avatarUrl) || "https://via.placeholder.com/96?text=User";
        var last = conversation.messages && conversation.messages[0] ? conversation.messages[0].content || "" : "No messages yet";
        var updated = formatDate(conversation.updatedAt);
        var activeClass = activeConversation && activeConversation.id === conversation.id ? "bg-primary-container/10" : "hover:bg-surface-container-low";

        return (
          "<div class=\"flex items-start gap-3 p-4 rounded-2xl cursor-pointer group transition-all " +
          activeClass +
          "\" data-conversation-id=\"" +
          conversation.id +
          "\"><div class=\"flex-shrink-0\"><img alt=\"" +
          name +
          "\" class=\"w-12 h-12 rounded-full object-cover\" src=\"" +
          avatar +
          "\"/></div><div class=\"flex-grow min-w-0\"><div class=\"flex justify-between items-baseline mb-0.5\"><h3 class=\"font-semibold text-on-surface truncate\">" +
          name +
          "</h3><span class=\"text-[10px] text-secondary uppercase tracking-tighter\">" +
          updated +
          "</span></div><p class=\"text-xs text-secondary truncate\">" +
          last +
          "</p></div></div>"
        );
      })
      .join("");

    threadListEl.querySelectorAll("[data-conversation-id]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-conversation-id");
        var selected = conversations.find(function (conv) {
          return conv.id === id;
        });
        if (selected) {
          selectConversation(selected);
          renderThreads();
        }
      });
    });
  }

  function ensureSocket() {
    if (typeof window.io !== "function") {
      return;
    }

    socket = window.io(SOCKET_BASE);
    if (currentUserId) {
      socket.emit("join:user", currentUserId);
    }

    socket.on("chat:new_message", function (message) {
      if (!activeConversation || !message || message.conversationId !== activeConversation.id) {
        return;
      }

      var current = messagesEl ? Array.from(messagesEl.querySelectorAll("[data-local-message]")) : [];
      if (
        current.some(function (node) {
          return node.getAttribute("data-local-message") === message.id;
        })
      ) {
        return;
      }

      api("/messages/" + encodeURIComponent(activeConversation.id))
        .then(function (data) {
          renderMessages(data.items || []);
        })
        .catch(function () {
          // no-op
        });
    });
  }

  function sendCurrentMessage() {
    if (!activeConversation) {
      showMessage("Select a conversation first", "error");
      return;
    }

    var content = inputEl ? inputEl.value.trim() : "";
    if (!content) {
      return;
    }

    var other = otherParticipant(activeConversation);
    if (!other || !other.id) {
      showMessage("Unable to determine receiver", "error");
      return;
    }

    api("/messages/send", {
      method: "POST",
      body: JSON.stringify({
        conversationId: activeConversation.id,
        receiverId: other.id,
        content: content,
      }),
    })
      .then(function () {
        if (inputEl) {
          inputEl.value = "";
        }

        return api("/messages/" + encodeURIComponent(activeConversation.id));
      })
      .then(function (data) {
        renderMessages(data.items || []);
        return api("/messages");
      })
      .then(function (data) {
        conversations = data.items || [];
        renderThreads();
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  }

  if (searchEl) {
    searchEl.addEventListener("input", renderThreads);
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", function (event) {
      event.preventDefault();
      sendCurrentMessage();
    });
  }

  if (inputEl) {
    inputEl.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendCurrentMessage();
      }
    });
  }

  ensureSocket();

  api("/messages")
    .then(function (data) {
      conversations = data.items || [];
      renderThreads();
      if (conversations[0]) {
        selectConversation(conversations[0]);
        renderThreads();
      }
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });
}
