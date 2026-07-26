// iOS 27 Messenger Core JavaScript

/* ============================================================
   iOS 27 MOTION KIT — v1.0
   Vanilla JS, no dependencies, self-contained IIFE — doesn't touch
   or depend on anything below until the app code explicitly calls
   window.MotionSystem.*  (see initSettingsPage, loadFriendsList,
   loadConversationsList, renderPendingFriendRequests, syncActiveThread,
   and the window.location.href redirects throughout this file).
   ============================================================ */
(function () {
  "use strict";

  const PAGE_DURATION = 380; // must match --motion-duration-page in style.css
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let enabled = !prefersReduced;

  // 1. SETTINGS BRIDGE — reads ios27_settings.animations on boot so the
  // OS-level reduced-motion flag and the app's own toggle agree.
  function syncSettingsFlag() {
    try {
      const raw = localStorage.getItem("ios27_settings");
      if (raw) {
        const settings = JSON.parse(raw);
        if (settings && settings.animations === false) enabled = false;
      }
    } catch (e) { /* ignore malformed storage */ }
    document.documentElement.classList.toggle("motion-reduced", !enabled);
  }

  function setEnabled(next) {
    enabled = !!next && !prefersReduced;
    document.documentElement.classList.toggle("motion-reduced", !enabled);
  }

  // 2. SCOPED will-change — added only for the lifetime of an animation/
  // transition, removed immediately after. Prevents permanent-layer buildup.
  function bindWillChange() {
    const start = (e) => {
      const t = e.target;
      if (!t || !t.classList) return;
      if (t.classList.contains("glass-panel") || t.classList.contains("btn-primary") ||
          t.classList.contains("request-card") || t.classList.contains("accent-color-dot")) {
        t.classList.add("wc-transform-opacity");
      }
    };
    const end = (e) => {
      const t = e.target;
      if (t && t.classList) t.classList.remove("wc-transform-opacity", "wc-transform", "wc-opacity");
    };
    document.addEventListener("transitionstart", start, { passive: true });
    document.addEventListener("animationstart", start, { passive: true });
    document.addEventListener("transitionend", end, { passive: true });
    document.addEventListener("animationend", end, { passive: true });
    document.addEventListener("transitioncancel", end, { passive: true });
  }

  // 3. PAGE TRANSITIONS — intercepts same-origin internal .html link
  // clicks (floating nav, auth footer links, etc). Uses the native View
  // Transitions API where available, falls back to fade+scale otherwise.
  // navigate() is also exposed publicly for the app's own
  // window.location.href redirects (login/signup success, logout, route guard).
  function isInternalNav(a) {
    if (!a || !a.href) return false;
    if (a.target && a.target !== "" && a.target !== "_self") return false;
    if (a.hasAttribute("data-no-transition")) return false;
    let url;
    try { url = new URL(a.href, window.location.href); } catch (e) { return false; }
    if (url.origin !== window.location.origin) return false;
    if (!/\.html?($|\?|#)/.test(url.pathname) && url.pathname !== "/") return false;
    return true;
  }

  function navigate(href) {
    if (!enabled) {
      window.location.href = href;
      return;
    }
    if (document.startViewTransition) {
      // Native path: browser handles the whole animation off-thread.
      document.startViewTransition(() => {
        window.location.href = href;
      });
      return;
    }
    // Fallback: play exit animation, then navigate.
    document.body.classList.add("page-exit");
    window.setTimeout(() => { window.location.href = href; }, PAGE_DURATION - 40);
  }

  function bindPageTransitions() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!isInternalNav(a)) return;
      e.preventDefault();
      navigate(a.href);
    });

    // Entrance animation on load (fallback path only — the native API
    // handles its own entrance automatically).
    if (!document.startViewTransition && enabled) {
      document.body.classList.add("page-enter");
      window.addEventListener("animationend", function clear(e) {
        if (e.animationName === "motion-page-in") {
          document.body.classList.remove("page-enter");
          document.removeEventListener("animationend", clear);
        }
      });
    }
  }

  // 4. SCROLL REVEAL — IntersectionObserver only, no scroll listeners.
  // Elements are un-observed once revealed (one-shot, cheap). Call
  // window.MotionSystem.refreshReveal() after injecting new DOM.
  let revealObserver = null;

  function observe(el) {
    if (!revealObserver || !el) return;
    revealObserver.observe(el);
  }

  function initScrollReveal(root) {
    if (!("IntersectionObserver" in window)) {
      (root || document).querySelectorAll(".reveal").forEach(el => el.classList.add("reveal-visible"));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.15 });
    }
    (root || document).querySelectorAll(".reveal:not(.reveal-visible)").forEach(observe);
  }

  // 5. PARALLAX — rAF-throttled pointermove on the aurora blobs. Disabled
  // on touch devices (parallax on a touchscreen just reads as lag).
  function initParallax() {
    const bg = document.querySelector(".aurora-bg");
    if (!bg) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let raf = null;
    let targetX = 0, targetY = 0;

    window.addEventListener("pointermove", (e) => {
      if (!enabled) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      targetX = nx * 18;
      targetY = ny * 18;
      if (raf === null) raf = requestAnimationFrame(apply);
    }, { passive: true });

    function apply() {
      bg.style.setProperty("--px", targetX.toFixed(1));
      bg.style.setProperty("--py", targetY.toFixed(1));
      raf = null;
    }
  }

  function init() {
    syncSettingsFlag();
    bindWillChange();
    bindPageTransitions();
    initScrollReveal();
    initParallax();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.MotionSystem = {
    setEnabled,
    navigate,
    refreshReveal: initScrollReveal,
  };
})();

// Supabase Cloud Credentials (from .env — baked in directly so the app
// connects reliably no matter how these files are hosted/opened, since a
// client-side fetch(".env") request can silently fail on some static
// hosts). The anon/publishable key is safe to expose client-side; it can
// only do what your Row Level Security policies allow.
const SUPABASE_CONFIG = {
  url: "https://vfrhyjjmjoukticsvqfz.supabase.co",
  anonKey: "sb_publishable_iOQZeFHMdfPtCydzYH4niA_92NhtXYB"
};

// State variables
let currentUser = null;
let activeChatUserId = null;
let activeGroupId = null; // set when a group thread is open instead of a 1:1 DM
let isSupabaseActive = false;
let supabaseClient = null;
const mobileViewQuery = window.matchMedia("(max-width: 480px)");
let isMobileView = mobileViewQuery.matches;
// Rotating the device or resizing the window should update isMobileView
// live so the chat header re-renders with/without the back button, and
// the phone-only slide layout only ever applies when it should.
mobileViewQuery.addEventListener("change", (e) => {
  isMobileView = e.matches;
  if (!isMobileView) {
    document.getElementById("main-app-card")?.classList.remove("show-sidebar");
  }
  if (activeChatUserId) startChatSession(activeChatUserId);
  else if (activeGroupId) startGroupChatSession(activeGroupId);
});
let typingTimeout = null;
let activeReplyMessageId = null;

// Voice message recording state (MediaRecorder-backed, shared across
// whichever chat template — DM or group — is currently rendered)
let voiceRecorder = null;
let voiceChunks = [];
let voiceStream = null;
let voiceRecordStartTime = null;
let voiceRecordTimerInterval = null;
let isRecordingVoice = false;

// Shared <audio> element reused for playback of every voice-note bubble,
// so only one voice message ever plays at a time.
let sharedVoicePlayer = null;
let sharedVoicePlayerBtn = null;

// Accent Colors Mapping
const ACCENT_COLORS = {
  blue: { rgb: "47, 128, 237", hex: "#2f80ed" },
  green: { rgb: "52, 199, 89", hex: "#34c759" },
  purple: { rgb: "175, 82, 222", hex: "#af52de" },
  pink: { rgb: "255, 45, 85", hex: "#ff2d55" },
  orange: { rgb: "255, 149, 0", hex: "#ff9500" }
};

// Seed Users for local mode testing
const DEFAULT_USERS = [
  {
    id: "AG10283",
    fullName: "Alexander Vance",
    username: "alexv",
    email: "alex@icloud.com",
    password: "password123",
    bio: "Designing the future of spatial messaging.",
    status: "Online",
    avatar: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2f80ed"/><text x="50" y="58" font-size="30" font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle">AV</text></svg>`,
    friends: ["AG94852", "AG77541"],
    friendRequests: []
  },
  {
    id: "AG94852",
    fullName: "Seraphina Vance",
    username: "seraphina",
    email: "seraphina@icloud.com",
    password: "password123",
    bio: "Liquid glass is my aesthetic.",
    status: "Online",
    avatar: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#af52de"/><text x="50" y="58" font-size="30" font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle">SV</text></svg>`,
    friends: ["AG10283"],
    friendRequests: []
  },
  {
    id: "AG77541",
    fullName: "Marcus Chen",
    username: "marcus",
    email: "marcus@icloud.com",
    password: "password123",
    bio: "iOS 27 developer, building in dark mode.",
    status: "Away",
    avatar: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#34c759"/><text x="50" y="58" font-size="30" font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle">MC</text></svg>`,
    friends: ["AG10283"],
    friendRequests: []
  }
];

// Seed Messages
const DEFAULT_MESSAGES = [
  {
    id: "msg_seed_1",
    senderId: "AG94852",
    receiverId: "AG10283",
    content: "Hey Alexander! Welcome to iOS 27 Messenger.",
    timestamp: Date.now() - 3600000 * 2,
    status: "seen",
    reaction: "❤️",
    edited: false,
    replyTo: null
  },
  {
    id: "msg_seed_2",
    senderId: "AG10283",
    receiverId: "AG94852",
    content: "Hi Seraphina! The glassmorphism blur feels incredibly fluid here.",
    timestamp: Date.now() - 3600000,
    status: "seen",
    reaction: null,
    edited: false,
    replyTo: null
  },
  {
    id: "msg_seed_3",
    senderId: "AG94852",
    receiverId: "AG10283",
    content: "It does! Have you configured your Supabase cloud keys in Settings yet?",
    timestamp: Date.now() - 1800000,
    status: "delivered",
    reaction: null,
    edited: false,
    replyTo: null
  }
];

// Seed Friend Requests
const DEFAULT_REQUESTS = [
  {
    id: "req_seed_1",
    senderId: "AG77541",
    receiverId: "AG94852",
    status: "pending",
    createdAt: Date.now()
  }
];

// Seed Groups
const DEFAULT_GROUPS = [
  {
    id: "GRP1001",
    name: "Design Crew",
    avatar: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#ff9500"/><text x="50" y="58" font-size="26" font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle">DC</text></svg>`,
    createdBy: "AG10283",
    memberIds: ["AG10283", "AG94852", "AG77541"],
    createdAt: Date.now() - 3600000 * 5
  }
];

// Seed Group Messages — same shape as DEFAULT_MESSAGES, but groupId is set
// and receiverId is null since a group message has many recipients.
const DEFAULT_GROUP_MESSAGES = [
  {
    id: "gmsg_seed_1",
    senderId: "AG94852",
    receiverId: null,
    groupId: "GRP1001",
    content: "Welcome to the Design Crew group chat!",
    timestamp: Date.now() - 3600000 * 4,
    status: "sent",
    reaction: null,
    edited: false,
    replyTo: null
  },
  {
    id: "gmsg_seed_2",
    senderId: "AG77541",
    receiverId: null,
    groupId: "GRP1001",
    content: "Excited to be here 🚀",
    timestamp: Date.now() - 3600000 * 3,
    status: "sent",
    reaction: null,
    edited: false,
    replyTo: null
  }
];

/* ------------------------------------------------------------- */
/* DATABASE ADAPTER (Dynamic backend selector)                   */
/* ------------------------------------------------------------- */

const DBAdapter = {
  // Sync databases locally
  seedLocalDatabase() {
    if (!localStorage.getItem("ios27_users")) {
      localStorage.setItem("ios27_users", JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem("ios27_messages")) {
      localStorage.setItem("ios27_messages", JSON.stringify([...DEFAULT_MESSAGES, ...DEFAULT_GROUP_MESSAGES]));
    }
    if (!localStorage.getItem("ios27_requests")) {
      localStorage.setItem("ios27_requests", JSON.stringify(DEFAULT_REQUESTS));
    }
    if (!localStorage.getItem("ios27_groups")) {
      localStorage.setItem("ios27_groups", JSON.stringify(DEFAULT_GROUPS));
    }
    if (!localStorage.getItem("ios27_settings")) {
      const defaultSettings = {
        notifications: true,
        sounds: true,
        animations: true,
        background: "aurora",
        accentColor: "blue",
        glassTint: 0.5,
        supabaseUrl: "",
        supabaseKey: ""
      };
      localStorage.setItem("ios27_settings", JSON.stringify(defaultSettings));
    }
  },

  getSettings() {
    this.seedLocalDatabase();
    return JSON.parse(localStorage.getItem("ios27_settings"));
  },

  saveSettings(settings) {
    localStorage.setItem("ios27_settings", JSON.stringify(settings));
    this.applySettings();
  },

  async initSupabase(url, key) {
    if (window.supabase && url && key && !url.includes("your-project") && !key.includes("your-supabase")) {
      try {
        supabaseClient = window.supabase.createClient(url, key);
        // Test connection
        const { data, error } = await supabaseClient.from("profiles").select("id").limit(1);
        if (!error) {
          isSupabaseActive = true;
          console.log("Supabase active cloud database connected.");
          return true;
        } else {
          console.warn("Supabase credentials supplied but database connection failed:", error);
        }
      } catch (e) {
        console.error("Error setting up Supabase client:", e);
      }
    }
    isSupabaseActive = false;
    console.log("Falling back to Local Storage client database.");
    return false;
  },

  // Users APIs
  _usersCache: null,
  _usersCacheTime: 0,
  _usersFetchPromise: null,

  invalidateUsersCache() {
    this._usersCache = null;
    this._usersCacheTime = 0;
  },

  async getUsers() {
    if (isSupabaseActive) {
      const CACHE_TTL = 2000; // ms — short enough to stay fresh, long enough to collapse simultaneous calls
      if (this._usersCache && (Date.now() - this._usersCacheTime) < CACHE_TTL) {
        return this._usersCache;
      }
      // If a fetch is already in flight (e.g. friends list + requests + threads
      // all asking at once), share it instead of firing duplicate requests.
      if (this._usersFetchPromise) return this._usersFetchPromise;

      this._usersFetchPromise = (async () => {
        const { data, error } = await supabaseClient.from("profiles").select("*");
        this._usersFetchPromise = null;
        if (!error) {
          const mapped = data.map(u => this.mapSupabaseUser(u));
          this._usersCache = mapped;
          this._usersCacheTime = Date.now();
          return mapped;
        }
        return JSON.parse(localStorage.getItem("ios27_users")) || [];
      })();
      return this._usersFetchPromise;
    }
    return JSON.parse(localStorage.getItem("ios27_users")) || [];
  },

  async getUserById(id) {
    // Reuse the shared, already-warm users cache when we have one — this is
    // hit on the critical path of opening a chat, right after the friends/
    // threads list just fetched (and cached) the exact same data. Paying
    // for a second network round trip there is pure latency with nothing
    // to show for it.
    if (isSupabaseActive && this._usersCache && (Date.now() - this._usersCacheTime) < 2000) {
      const cached = this._usersCache.find(u => u.id === id);
      if (cached) return cached;
    }
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", id).maybeSingle();
      if (!error && data) return this.mapSupabaseUser(data);
    }
    const users = await this.getUsers();
    return users.find(u => u.id === id) || null;
  },

  async getUserByUsername(username) {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!error && data) return this.mapSupabaseUser(data);
    }
    const users = await this.getUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  },

  async getUserByEmail(email) {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("profiles").select("*").eq("email", email).maybeSingle();
      if (!error && data) return this.mapSupabaseUser(data);
    }
    const users = await this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async createUser(user) {
    if (isSupabaseActive) {
      const dbUser = {
        id: user.id,
        full_name: user.fullName,
        username: user.username,
        email: user.email,
        password: user.password,
        bio: user.bio || "",
        status: user.status || "Online",
        avatar: user.avatar,
        friends: user.friends || []
      };
      const { error } = await supabaseClient.from("profiles").insert([dbUser]);
      if (!error) { this.invalidateUsersCache(); return user; }
      throw new Error("Supabase signup insertion failed");
    } else {
      const users = await this.getUsers();
      users.push(user);
      localStorage.setItem("ios27_users", JSON.stringify(users));
      return user;
    }
  },

  async updateUser(id, updates) {
    if (isSupabaseActive) {
      const dbUpdates = {};
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.username !== undefined) dbUpdates.username = updates.username;
      if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.friends !== undefined) dbUpdates.friends = updates.friends;

      const { error } = await supabaseClient.from("profiles").update(dbUpdates).eq("id", id);
      if (error) throw error;
      this.invalidateUsersCache();
    } else {
      const users = await this.getUsers();
      const idx = users.findIndex(u => u.id === id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        localStorage.setItem("ios27_users", JSON.stringify(users));
      }
    }
    // Update active session user if necessary
    if (currentUser && currentUser.id === id) {
      currentUser = { ...currentUser, ...updates };
      localStorage.setItem("ios27_currentUser", JSON.stringify(currentUser));
    }
  },

  // Friend Requests APIs
  async getFriendRequests(userId) {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("friend_requests").select("*").eq("receiver_id", userId).eq("status", "pending");
      if (!error) {
        return data.map(r => ({
          id: r.id,
          senderId: r.sender_id,
          receiverId: r.receiver_id,
          status: r.status,
          createdAt: new Date(r.created_at).getTime()
        }));
      }
    }
    const reqs = JSON.parse(localStorage.getItem("ios27_requests")) || [];
    return reqs.filter(r => r.receiverId === userId && r.status === "pending");
  },

  async sendFriendRequest(senderId, receiverId) {
    if (isSupabaseActive) {
      const { error } = await supabaseClient.from("friend_requests").insert([{
        sender_id: senderId,
        receiver_id: receiverId,
        status: "pending"
      }]);
      if (error) throw error;
    } else {
      const reqs = JSON.parse(localStorage.getItem("ios27_requests")) || [];
      const duplicate = reqs.find(r => r.senderId === senderId && r.receiverId === receiverId);
      if (duplicate) throw new Error("Friend request already pending.");

      reqs.push({
        id: "req_" + Date.now(),
        senderId,
        receiverId,
        status: "pending",
        createdAt: Date.now()
      });
      localStorage.setItem("ios27_requests", JSON.stringify(reqs));
    }
  },

  async updateFriendRequest(requestId, status) {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("friend_requests").update({ status }).eq("id", requestId).select().maybeSingle();
      if (error) throw error;
      
      if (status === "accepted" && data) {
        // Form friendship
        const sId = data.sender_id;
        const rId = data.receiver_id;
        await this.addFriendsList(sId, rId);
      }
    } else {
      const reqs = JSON.parse(localStorage.getItem("ios27_requests")) || [];
      const idx = reqs.findIndex(r => r.id === requestId);
      if (idx !== -1) {
        reqs[idx].status = status;
        localStorage.setItem("ios27_requests", JSON.stringify(reqs));

        if (status === "accepted") {
          await this.addFriendsList(reqs[idx].senderId, reqs[idx].receiverId);
        }
      }
    }
  },

  async addFriendsList(userA_id, userB_id) {
    const userA = await this.getUserById(userA_id);
    const userB = await this.getUserById(userB_id);

    if (userA && userB) {
      const friendsA = userA.friends || [];
      const friendsB = userB.friends || [];

      if (!friendsA.includes(userB_id)) friendsA.push(userB_id);
      if (!friendsB.includes(userA_id)) friendsB.push(userA_id);

      await this.updateUser(userA_id, { friends: friendsA });
      await this.updateUser(userB_id, { friends: friendsB });
    }
  },

  // Group Chat APIs
  async createGroup({ name, memberIds, createdBy }) {
    const trimmed = name.trim();
    const words = trimmed.split(/\s+/);
    const initials = words.length === 1
      ? trimmed.substring(0, 2).toUpperCase()
      : (words[0][0] + words[1][0]).toUpperCase();
    const randomColor = ["#2f80ed", "#34c759", "#af52de", "#ff2d55", "#ff9500"][Math.floor(Math.random() * 5)];
    const avatarSVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="${randomColor}"/><text x="50" y="58" font-size="26" font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle">${initials}</text></svg>`;

    const group = {
      id: "GRP" + Date.now(),
      name: trimmed,
      avatar: avatarSVG,
      createdBy,
      memberIds,
      createdAt: Date.now()
    };

    if (isSupabaseActive) {
      const { error } = await supabaseClient.from("groups").insert([{
        id: group.id,
        name: group.name,
        avatar: group.avatar,
        created_by: group.createdBy,
        member_ids: group.memberIds,
        created_at: new Date(group.createdAt).toISOString()
      }]);
      if (error) {
        console.error("Supabase insert into 'groups' failed:", error);
        throw error;
      }
    } else {
      const groups = JSON.parse(localStorage.getItem("ios27_groups")) || [];
      groups.push(group);
      localStorage.setItem("ios27_groups", JSON.stringify(groups));
    }
    return group;
  },

  async getGroups() {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("groups").select("*");
      if (!error) return data.map(g => this.mapSupabaseGroup(g));
    }
    return JSON.parse(localStorage.getItem("ios27_groups")) || [];
  },

  async getUserGroups(userId) {
    const groups = await this.getGroups();
    return groups.filter(g => (g.memberIds || []).includes(userId));
  },

  async getGroupById(id) {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("groups").select("*").eq("id", id).maybeSingle();
      if (!error && data) return this.mapSupabaseGroup(data);
    }
    const groups = await this.getGroups();
    return groups.find(g => g.id === id) || null;
  },

  async updateGroup(id, updates) {
    if (isSupabaseActive) {
      const dbUpdates = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.memberIds !== undefined) dbUpdates.member_ids = updates.memberIds;
      const { error } = await supabaseClient.from("groups").update(dbUpdates).eq("id", id);
      if (error) throw error;
    } else {
      const groups = JSON.parse(localStorage.getItem("ios27_groups")) || [];
      const idx = groups.findIndex(g => g.id === id);
      if (idx !== -1) {
        groups[idx] = { ...groups[idx], ...updates };
        localStorage.setItem("ios27_groups", JSON.stringify(groups));
      }
    }
  },

  async addGroupMembers(groupId, newMemberIds) {
    const group = await this.getGroupById(groupId);
    if (!group) return;
    const merged = Array.from(new Set([...(group.memberIds || []), ...newMemberIds]));
    await this.updateGroup(groupId, { memberIds: merged });
  },

  async removeGroupMember(groupId, memberId) {
    const group = await this.getGroupById(groupId);
    if (!group) return;
    const remaining = (group.memberIds || []).filter(id => id !== memberId);
    await this.updateGroup(groupId, { memberIds: remaining });
  },

  mapSupabaseGroup(dbGroup) {
    return {
      id: dbGroup.id,
      name: dbGroup.name,
      avatar: dbGroup.avatar,
      createdBy: dbGroup.created_by,
      memberIds: dbGroup.member_ids || [],
      createdAt: dbGroup.created_at ? new Date(dbGroup.created_at).getTime() : Date.now()
    };
  },

  // Group read-state — local-only "last viewed" marker per group, used to
  // compute unread badges. Group messages don't have a single per-recipient
  // "seen" flag the way 1:1 messages do (there's no one right answer to
  // "did the group see this"), so unread tracking is per-viewer instead.
  getGroupLastRead(groupId) {
    const map = JSON.parse(localStorage.getItem("ios27_group_last_read")) || {};
    return map[groupId] || 0;
  },

  setGroupLastRead(groupId, timestamp) {
    const map = JSON.parse(localStorage.getItem("ios27_group_last_read")) || {};
    map[groupId] = timestamp;
    localStorage.setItem("ios27_group_last_read", JSON.stringify(map));
  },

  // Messages APIs
  async getMessages(userId1, userId2) {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("messages")
        .select("*")
        .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
        .order("timestamp", { ascending: true });
      if (!error) return data.map(m => this.mapSupabaseMessage(m));
    }
    const msgs = JSON.parse(localStorage.getItem("ios27_messages")) || [];
    return msgs.filter(m => (m.senderId === userId1 && m.receiverId === userId2) || (m.senderId === userId2 && m.receiverId === userId1));
  },

  async sendMessage(msg) {
    if (isSupabaseActive) {
      const dbMsg = {
        id: msg.id,
        sender_id: msg.senderId,
        receiver_id: msg.receiverId || null,
        group_id: msg.groupId || null,
        content: msg.content,
        timestamp: msg.timestamp,
        status: msg.status,
        reaction: msg.reaction || null,
        edited: msg.edited,
        reply_to: msg.replyTo,
        attachment_url: msg.attachmentUrl || null,
        attachment_type: msg.attachmentType || null,
        attachment_name: msg.attachmentName || null,
        attachment_duration: msg.attachmentDuration || null
      };
      const { error } = await supabaseClient.from("messages").insert([dbMsg]);
      if (error) throw error;
    } else {
      const msgs = JSON.parse(localStorage.getItem("ios27_messages")) || [];
      msgs.push(msg);
      localStorage.setItem("ios27_messages", JSON.stringify(msgs));
    }
    return msg;
  },

  // Uploads a File to Supabase Storage (bucket: chat-attachments) when the
  // cloud backend is active, or inlines it as a base64 data URL under the
  // local-storage fallback so attachments still work without any backend
  // configured. Returns { url, type, name } ready to attach to a message.
  async uploadAttachment(file) {
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const kind = isImage ? "image" : isAudio ? "audio" : "file";

    if (isSupabaseActive) {
      const path = `${currentUser.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabaseClient.storage.from("chat-attachments").upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (error) throw error;
      const { data } = supabaseClient.storage.from("chat-attachments").getPublicUrl(path);
      return { url: data.publicUrl, type: kind, name: file.name };
    }

    // Local-storage fallback: no real object storage available, so the file
    // is embedded as a data URL. Cap it well under localStorage's ~5MB quota
    // (shared with the rest of the app's data) so one attachment can't blow
    // out the whole local database.
    const MAX_LOCAL_BYTES = 1.5 * 1024 * 1024;
    if (file.size > MAX_LOCAL_BYTES) {
      throw new Error("File too large for local-storage mode (max 1.5MB). Connect Supabase in Settings for real uploads.");
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return { url: dataUrl, type: kind, name: file.name };
  },

  async updateMessage(msgId, updates) {
    if (isSupabaseActive) {
      const dbUpdates = {};
      if (updates.reaction !== undefined) dbUpdates.reaction = updates.reaction;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.edited !== undefined) dbUpdates.edited = updates.edited;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { error } = await supabaseClient.from("messages").update(dbUpdates).eq("id", msgId);
      if (error) throw error;
    } else {
      const msgs = JSON.parse(localStorage.getItem("ios27_messages")) || [];
      const idx = msgs.findIndex(m => m.id === msgId);
      if (idx !== -1) {
        msgs[idx] = { ...msgs[idx], ...updates };
        localStorage.setItem("ios27_messages", JSON.stringify(msgs));
      }
    }
  },

  // Get every 1:1 message involving a user (for building the DM part of the
  // conversation-threads list). Group messages are excluded here — they're
  // fetched separately via getMessagesForGroups since they belong to many
  // recipients at once, not a single sender/receiver pair.
  async getAllMessagesForUser(userId) {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("messages")
        .select("*")
        .is("group_id", null)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("timestamp", { ascending: true });
      if (!error) return data.map(m => this.mapSupabaseMessage(m));
    }
    const msgs = JSON.parse(localStorage.getItem("ios27_messages")) || [];
    return msgs.filter(m => !m.groupId && (m.senderId === userId || m.receiverId === userId));
  },

  // Get every message inside a single group thread, oldest first.
  async getGroupMessages(groupId) {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("messages")
        .select("*")
        .eq("group_id", groupId)
        .order("timestamp", { ascending: true });
      if (!error) return data.map(m => this.mapSupabaseMessage(m));
    }
    const msgs = JSON.parse(localStorage.getItem("ios27_messages")) || [];
    return msgs.filter(m => m.groupId === groupId).sort((a, b) => a.timestamp - b.timestamp);
  },

  // Batched fetch across every group a user belongs to, for building the
  // conversation-threads list without firing one query per group.
  async getMessagesForGroups(groupIds) {
    if (!groupIds || groupIds.length === 0) return [];
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("messages")
        .select("*")
        .in("group_id", groupIds)
        .order("timestamp", { ascending: true });
      if (!error) return data.map(m => this.mapSupabaseMessage(m));
    }
    const msgs = JSON.parse(localStorage.getItem("ios27_messages")) || [];
    const idSet = new Set(groupIds);
    return msgs.filter(m => m.groupId && idSet.has(m.groupId));
  },

  async getMessageById(msgId) {
    if (isSupabaseActive) {
      const { data, error } = await supabaseClient.from("messages").select("*").eq("id", msgId).maybeSingle();
      if (!error && data) return this.mapSupabaseMessage(data);
    }
    const msgs = JSON.parse(localStorage.getItem("ios27_messages")) || [];
    return msgs.find(m => m.id === msgId) || null;
  },

  async deleteMessage(msgId) {
    if (isSupabaseActive) {
      const { error } = await supabaseClient.from("messages").delete().eq("id", msgId);
      if (error) throw error;
    } else {
      let msgs = JSON.parse(localStorage.getItem("ios27_messages")) || [];
      msgs = msgs.filter(m => m.id !== msgId);
      localStorage.setItem("ios27_messages", JSON.stringify(msgs));
    }
  },

  // Batch-mark multiple messages as seen in a single round trip
  // (avoids firing one network request per unread message)
  async markMessagesSeen(msgIds) {
    if (!msgIds || msgIds.length === 0) return;
    if (isSupabaseActive) {
      const { error } = await supabaseClient.from("messages").update({ status: "seen" }).in("id", msgIds);
      if (error) throw error;
    } else {
      const msgs = JSON.parse(localStorage.getItem("ios27_messages")) || [];
      const idSet = new Set(msgIds);
      msgs.forEach(m => { if (idSet.has(m.id)) m.status = "seen"; });
      localStorage.setItem("ios27_messages", JSON.stringify(msgs));
    }
  },

  // Helper mappings for columns naming convention differences
  mapSupabaseUser(dbUser) {
    return {
      id: dbUser.id,
      fullName: dbUser.full_name,
      username: dbUser.username,
      email: dbUser.email,
      password: dbUser.password,
      bio: dbUser.bio,
      status: dbUser.status,
      avatar: dbUser.avatar,
      friends: dbUser.friends || []
    };
  },

  mapSupabaseMessage(dbMsg) {
    return {
      id: dbMsg.id,
      senderId: dbMsg.sender_id,
      receiverId: dbMsg.receiver_id,
      groupId: dbMsg.group_id || null,
      content: dbMsg.content,
      timestamp: Number(dbMsg.timestamp),
      status: dbMsg.status,
      reaction: dbMsg.reaction,
      edited: dbMsg.edited,
      replyTo: dbMsg.reply_to,
      attachmentUrl: dbMsg.attachment_url || null,
      attachmentType: dbMsg.attachment_type || null,
      attachmentName: dbMsg.attachment_name || null,
      attachmentDuration: dbMsg.attachment_duration || null
    };
  },

  // Setup configuration loader
  async applySettings() {
    const settings = this.getSettings();
    
    // Theme setup
    const mode = localStorage.getItem("ios27_theme") || "dark";
    if (mode === "light") {
      document.documentElement.classList.add("light-mode");
    } else {
      document.documentElement.classList.remove("light-mode");
    }

    // Accent Color setup
    const accent = settings.accentColor || "blue";
    const mapped = ACCENT_COLORS[accent] || ACCENT_COLORS.blue;
    document.documentElement.style.setProperty("--accent-color", mapped.hex);
    document.documentElement.style.setProperty("--accent-color-rgb", mapped.rgb);
    document.documentElement.style.setProperty("--accent-bg", `rgba(${mapped.rgb}, 0.15)`);
    document.documentElement.style.setProperty("--glow-color", `rgba(${mapped.rgb}, 0.35)`);
    
    // Liquid Glass transparency (iOS 27) — drives the color-mix
    // interpolation between --panel-bg-clear and --panel-bg-tinted.
    const tint = typeof settings.glassTint === "number" ? settings.glassTint : 0.5;
    document.documentElement.style.setProperty("--tint-mix", tint);

    // Animation Speed adjustments
    if (settings.animations === false) {
      document.documentElement.style.setProperty("--transition-spring", "none");
      document.documentElement.style.setProperty("--transition-smooth", "none");
      document.documentElement.style.setProperty("--transition-bubble", "none");
    } else {
      document.documentElement.style.setProperty("--transition-spring", "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)");
      document.documentElement.style.setProperty("--transition-smooth", "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)");
      document.documentElement.style.setProperty("--transition-bubble", "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.25)");
    }
  }
};

/* ------------------------------------------------------------- */
/* PREMIUM SYNTHESIZED SOUND SYSTEM (Web Audio API)               */
/* ------------------------------------------------------------- */

function playSynthSound(type) {
  const settings = DBAdapter.getSettings();
  if (!settings.sounds) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "sent") {
      // High-pitched ascending iMessage sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1300, ctx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "received") {
      // Double ping alert
      const now = ctx.currentTime;
      [
        { freq: 650, start: 0, dur: 0.08 },
        { freq: 920, start: 0.07, dur: 0.15 }
      ].forEach(tone => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(tone.freq, now + tone.start);
        
        gain.gain.setValueAtTime(0.15, now + tone.start);
        gain.gain.exponentialRampToValueAtTime(0.01, now + tone.start + tone.dur);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + tone.start);
        osc.stop(now + tone.start + tone.dur);
      });
    }
  } catch (e) {
    console.warn("Audio Context sound synthesis blocked or unsupported:", e);
  }
}

/* ------------------------------------------------------------- */
/* APPLE DYNAMIC ISLAND NOTIFICATION PIPELINE                    */
/* ------------------------------------------------------------- */

function showAppleNotification(title, message) {
  const settings = DBAdapter.getSettings();
  if (!settings.notifications) return;

  // Check if notification elements exist, otherwise build
  let alertEl = document.getElementById("global-apple-alert");
  if (!alertEl) {
    alertEl = document.createElement("div");
    alertEl.id = "global-apple-alert";
    alertEl.className = "apple-notification";
    alertEl.innerHTML = `
      <div class="notification-icon">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
      </div>
      <div class="notification-content">
        <div class="notification-title" id="global-alert-title"></div>
        <div class="notification-message" id="global-alert-msg"></div>
      </div>
    `;
    document.body.appendChild(alertEl);
  }

  document.getElementById("global-alert-title").innerText = title;
  document.getElementById("global-alert-msg").innerText = message;

  alertEl.classList.add("show");
  playSynthSound("received");

  setTimeout(() => {
    alertEl.classList.remove("show");
  }, 4000);
}

/* ------------------------------------------------------------- */
/* FLOATING ISLAND NAVIGATION CONTROLLER                         */
/* ------------------------------------------------------------- */

function renderFloatingNavigation() {
  if (!currentUser) {
    document.body.classList.remove("has-floating-nav");
    return; // Hide navigation for logged out states
  }

  document.body.classList.add("has-floating-nav");

  const existingNav = document.getElementById("floating-island-nav");
  if (existingNav) existingNav.remove();

  ensureGooFilterDefs();

  const nav = document.createElement("div");
  nav.id = "floating-island-nav";
  nav.className = "floating-nav";

  const path = window.location.pathname;
  const isChat = path.includes("messenger.html");
  const isProfile = path.includes("profile.html");
  const isSettings = path.includes("settings.html");

  nav.innerHTML = `
    <div class="floating-nav-goo-layer" id="floating-nav-goo-layer">
      <div class="floating-nav-indicator" id="floating-nav-indicator"></div>
      <div class="floating-nav-hover-glass" id="floating-nav-hover-glass"></div>
    </div>
    <a href="messenger.html" class="floating-nav-item ${isChat ? 'active' : ''}" title="Chat Messages">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
    </a>
    <a href="profile.html" class="floating-nav-item ${isProfile ? 'active' : ''}" title="Edit Profile">
      <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
    </a>
    <a href="settings.html" class="floating-nav-item ${isSettings ? 'active' : ''}" title="Settings Console">
      <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
    </a>
    <div class="floating-nav-item" id="nav-logout-btn" title="Log Out Session" style="color: #ff3b30;">
      <svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
    </div>
  `;

  document.body.appendChild(nav);

  // Bind logout action
  document.getElementById("nav-logout-btn").addEventListener("click", () => {
    localStorage.removeItem("ios27_currentUser");
    window.MotionSystem.navigate("login.html");
  });

  initFloatingNavLiquidGlass(nav);
}

/* ------------------------------------------------------------- */
/* GOO FILTER DEFINITIONS                                        */
/* The classic metaball recipe: blur two shapes until their alpha */
/* fields bleed into each other, then push the alpha channel's    */
/* contrast back up so the soft overlap snaps into one continuous */
/* silhouette. This is what actually makes the active pill and    */
/* the hover pill "absorb" into each other like real Liquid Glass */
/* elements do when Apple's GlassEffectContainer groups them,     */
/* instead of two shapes simply overlapping.                      */
/* ------------------------------------------------------------- */
function ensureGooFilterDefs() {
  if (document.getElementById("nav-liquid-goo-defs")) return;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("id", "nav-liquid-goo-defs");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.overflow = "hidden";

  svg.innerHTML = `
    <defs>
      <filter id="nav-liquid-goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
        <feColorMatrix in="blur" mode="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
          result="goo" />
        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
      </filter>
    </defs>
  `;

  document.body.appendChild(svg);
}

/* ------------------------------------------------------------- */
/* HOOKE'S LAW SPRING                                             */
/* A real damped-harmonic-oscillator integrator — the same model  */
/* iOS itself uses under the hood. Apple's SwiftUI springs are    */
/* authored as (response, dampingFraction) rather than raw        */
/* (stiffness, damping), so we convert with the same relationship */
/* Apple's own spring math uses:                                  */
/*   angularFrequency = 2π / response                             */
/*   stiffness (k)     = mass · angularFrequency²                 */
/*   damping   (c)     = 4π · dampingFraction · mass / response    */
/* response  = seconds for the spring to essentially arrive       */
/* dampingFraction = 1 is critically damped (no overshoot),       */
/*                   < 1 allows a single settling overshoot       */
/* ------------------------------------------------------------- */
function springFromResponse(response, dampingFraction, mass = 1) {
  const angularFrequency = (2 * Math.PI) / response;
  const stiffness = mass * angularFrequency * angularFrequency;
  const damping = (4 * Math.PI * dampingFraction * mass) / response;
  return { stiffness, damping, mass };
}

class Spring {
  constructor(value, response, dampingFraction, mass = 1) {
    const { stiffness, damping } = springFromResponse(response, dampingFraction, mass);
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
  }

  setTarget(t) {
    this.target = t;
  }

  // Semi-implicit Euler integration of F = -k·x - c·v (Hooke's law
  // plus linear damping). Small, fixed substeps keep it stable even
  // if a frame drops (e.g. tab was backgrounded).
  update(dt) {
    const steps = dt > 0.032 ? 4 : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const displacement = this.value - this.target;
      const force = -this.stiffness * displacement - this.damping * this.velocity;
      const acceleration = force / this.mass;
      this.velocity += acceleration * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  snap(v) {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }

  isSettled(eps = 0.02) {
    return Math.abs(this.value - this.target) < eps && Math.abs(this.velocity) < eps;
  }
}

/* ------------------------------------------------------------- */
/* LIQUID GLASS NAV INDICATOR                                    */
/* Two pills live behind the icons: an accent-colored one under   */
/* whichever tab is active, and a quieter frosted one that tracks */
/* the pointer on hover. Both are driven every frame by a real    */
/* Hooke's-law spring rather than a canned CSS easing curve, so   */
/* their motion actually has mass, stiffness and damping. Each    */
/* pill also stretches along its direction of travel in           */
/* proportion to its own spring velocity — literal liquid         */
/* deformation, not a scripted keyframe — and relaxes back to a   */
/* circle as it settles. When the hover pill's path brings it     */
/* near the active pill, the shared goo filter fuses the two into */
/* one continuous shape, exactly like Liquid Glass controls       */
/* absorbing into each other, then lets them separate cleanly.    */
/* ------------------------------------------------------------- */
function initFloatingNavLiquidGlass(nav) {
  const gooLayer = nav.querySelector("#floating-nav-goo-layer");
  const indicatorEl = nav.querySelector("#floating-nav-indicator");
  const hoverEl = nav.querySelector("#floating-nav-hover-glass");
  const items = Array.from(nav.querySelectorAll(".floating-nav-item"));
  const activeItem = items.find((el) => el.classList.contains("active"));

  function centerXOf(target) {
    const navRect = nav.getBoundingClientRect();
    const itemRect = target.getBoundingClientRect();
    return itemRect.left - navRect.left + itemRect.width / 2 - 25; // 25 = half pill width
  }

  const restingY = 6;

  // Landing spring: settles in a single, controlled arrival —
  // Apple's own tab-bar default is response 0.55 / dampingFraction
  // 0.825, we use a slightly quicker response since this pill is
  // much smaller and lighter than a full-screen transition.
  const indicatorX = new Spring(0, 0.42, 0.82);
  // Stretch relaxes back to neutral with no overshoot (dampingFraction
  // 1 = critically damped) so the "liquid" elongation never wobbles.
  const indicatorStretch = new Spring(1, 0.28, 1);

  // Hover pill: Apple's interactiveSpring default (0.15 / 0.86),
  // tuned for something that must feel instantly responsive to the
  // cursor rather than a settled destination.
  const hoverX = new Spring(0, 0.22, 0.88);
  const hoverStretch = new Spring(1, 0.24, 1);
  let hoverActive = false;

  if (activeItem) {
    indicatorX.snap(centerXOf(activeItem));
    indicatorEl.style.opacity = "0";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        indicatorEl.style.transition = "opacity 0.35s ease";
        indicatorEl.style.opacity = "1";
      });
    });
  } else {
    indicatorEl.style.display = "none";
  }
  hoverX.snap(indicatorX.value);

  items.forEach((item) => {
    item.addEventListener("pointerenter", () => {
      if (item.classList.contains("active")) return;
      hoverActive = true;
      hoverEl.classList.add("is-visible");
      hoverX.setTarget(centerXOf(item));
    });
    item.addEventListener("pointerleave", () => {
      hoverActive = false;
      hoverEl.classList.remove("is-visible");
    });
  });

  window.addEventListener("resize", () => {
    if (activeItem) indicatorX.setTarget(centerXOf(activeItem));
  });

  // A max stretch of ~22% and a matching ~8% squash reads as a real,
  // slightly elastic material without tipping into cartoonish jelly.
  function applyLiquidTransform(el, spring, stretchSpring) {
    const speed = Math.abs(spring.velocity);
    const stretchTarget = 1 + Math.min(speed / 900, 0.22);
    stretchSpring.setTarget(stretchTarget);
    const sx = stretchSpring.value;
    const sy = 1 - (sx - 1) * 0.35; // inverse squash, subtler than the stretch
    el.style.transform = `translate(${spring.value}px, ${restingY}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  }

  let lastTime = performance.now();

  function frame(now) {
    if (!document.body.contains(nav)) return; // page navigated away / nav replaced
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (activeItem) {
      indicatorX.update(dt);
      indicatorStretch.update(dt);
      applyLiquidTransform(indicatorEl, indicatorX, indicatorStretch);
    }

    if (hoverActive || !hoverX.isSettled()) {
      hoverX.update(dt);
      hoverStretch.update(dt);
      applyLiquidTransform(hoverEl, hoverX, hoverStretch);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------- */
/* AURORA GRADIENT FLOATING PARTICLES                            */
/* ------------------------------------------------------------- */

function initAuroraBackground() {
  const existing = document.querySelector(".aurora-bg");
  if (existing) return;

  const aurora = document.createElement("div");
  aurora.className = "aurora-bg";
  aurora.innerHTML = `
    <div class="aurora-blob blob-1"></div>
    <div class="aurora-blob blob-2"></div>
    <div class="aurora-blob blob-3"></div>
    <div class="aurora-blob blob-4"></div>
  `;
  document.body.insertBefore(aurora, document.body.firstChild);
}

/* ------------------------------------------------------------- */
/* PAGE LOGIC COORDINATORS                                       */
/* ------------------------------------------------------------- */

// General initializer
async function initApp() {
  DBAdapter.seedLocalDatabase();

  // Load Session
  const sessionUser = localStorage.getItem("ios27_currentUser");
  if (sessionUser) {
    currentUser = JSON.parse(sessionUser);
  }

  // Load Supabase credentials.
  // Priority: (1) credentials manually saved in Settings, (2) values pulled
  // from a hosted .env file, (3) the SUPABASE_CONFIG constant baked into
  // this file above. This means the app connects out of the box even if
  // the .env file isn't served by the host.
  const settings = DBAdapter.getSettings();
  let dbUrl = settings.supabaseUrl || SUPABASE_CONFIG.url;
  let dbKey = settings.supabaseKey || SUPABASE_CONFIG.anonKey;

  try {
    const envResponse = await fetch(".env");
    if (envResponse.ok) {
      const text = await envResponse.text();
      text.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const parts = trimmed.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join("=").trim();
          if (!settings.supabaseUrl && (key === "SUPABASE_URL" || key === "NEXT_PUBLIC_SUPABASE_URL")) dbUrl = value;
          if (!settings.supabaseKey && (key === "SUPABASE_ANON_KEY" || key === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" || key === "NEXT_PUBLIC_SUPABASE_ANON_KEY")) dbKey = value;
        }
      });
    }
  } catch (e) {
    // .env not reachable (e.g. opened via file://) — fall back silently to SUPABASE_CONFIG
  }

  if (dbUrl && dbKey) {
    const connected = await DBAdapter.initSupabase(dbUrl, dbKey);
    if (connected) {
      // Persist so the Settings page reflects the active connection
      settings.supabaseUrl = dbUrl;
      settings.supabaseKey = dbKey;
      localStorage.setItem("ios27_settings", JSON.stringify(settings));
    }
  }

  // Setup Visual Settings
  DBAdapter.applySettings();
  initAuroraBackground();
  renderFloatingNavigation();

  // Route protection
  const page = window.location.pathname.split("/").pop();
  const isAuthPage = page === "login.html" || page === "signup.html";

  if (!currentUser && !isAuthPage && page !== "") {
    window.MotionSystem.navigate("login.html");
    return;
  }
  if (currentUser && isAuthPage) {
    window.MotionSystem.navigate("messenger.html");
    return;
  }

  // Route to specific controllers
  if (page === "login.html") initLoginPage();
  if (page === "signup.html") initSignupPage();
  if (page === "messenger.html") initMessengerPage();
  if (page === "profile.html") initProfilePage();
  if (page === "settings.html") initSettingsPage();
  if (page === "index.html" || page === "") {
    const targetPage = currentUser ? "messenger.html" : "login.html";
    const isPhoneViewport = window.matchMedia("(max-width: 480px)").matches;
    const introVideo = document.getElementById(
      isPhoneViewport ? "mobile-intro-video" : "desktop-intro-video"
    );

    if (introVideo) {
      // Let the opening animation play out, then continue the normal
      // route. "ended"/"error" cover the happy path and any playback
      // failure; the timeout is a safety net in case autoplay is
      // blocked entirely and neither event ever fires.
      let advanced = false;
      const proceed = () => {
        if (advanced) return;
        advanced = true;
        window.MotionSystem.navigate(targetPage);
      };
      introVideo.addEventListener("ended", proceed, { once: true });
      introVideo.addEventListener("error", proceed, { once: true });
      window.setTimeout(proceed, 6000);
      introVideo.play().catch(proceed);
    } else {
      // No matching intro video found: unchanged, immediate route.
      window.MotionSystem.navigate(targetPage);
    }
  }
}

// 1. LOGIN PAGE CONTROLLER
function initLoginPage() {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userIdInput = document.getElementById("login-userid").value.trim();
    const passwordInput = document.getElementById("login-password").value;

    const errorEl = document.getElementById("login-error");
    errorEl.innerText = "";

    try {
      const user = await DBAdapter.getUserById(userIdInput);
      if (user && user.password === passwordInput) {
        localStorage.setItem("ios27_currentUser", JSON.stringify(user));
        window.MotionSystem.navigate("messenger.html");
      } else {
        errorEl.innerText = "Invalid User ID or Password. Verify credentials.";
      }
    } catch (err) {
      errorEl.innerText = "Authentication error. Falling back to local storage.";
    }
  });
}

// 2. SIGNUP PAGE CONTROLLER
function initSignupPage() {
  const signupForm = document.getElementById("signup-form");
  if (!signupForm) return;

  const useridInput = document.getElementById("signup-userid");
  const useridMsg = document.getElementById("userid-availability-msg");
  let useridIsAvailable = false;

  const setUseridMsg = (text, color) => {
    if (!useridMsg) return;
    useridMsg.innerText = text;
    useridMsg.style.color = color || "var(--text-muted)";
  };

  // Live availability check as the user types their own User ID
  const checkUseridAvailability = debounce(async () => {
    const value = useridInput.value.trim();
    useridIsAvailable = false;

    if (!value) {
      setUseridMsg("");
      return;
    }
    if (value.length < 3 || value.length > 20) {
      setUseridMsg("User ID must be 3–20 characters.", "#ff3b30");
      return;
    }
    if (!/^[A-Za-z0-9_]+$/.test(value)) {
      setUseridMsg("Only letters, numbers, and underscores allowed.", "#ff3b30");
      return;
    }

    setUseridMsg("Checking availability...", "var(--text-muted)");
    try {
      const existing = await DBAdapter.getUserById(value);
      if (existing) {
        setUseridMsg("This User ID is already taken. Please choose another.", "#ff3b30");
        useridIsAvailable = false;
      } else {
        setUseridMsg("User ID is available.", "#34c759");
        useridIsAvailable = true;
      }
    } catch (e) {
      setUseridMsg("");
    }
  }, 400);

  if (useridInput) {
    useridInput.addEventListener("input", checkUseridAvailability);
  }

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("signup-fullname").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("signup-confirm").value;
    const userId = useridInput.value.trim();

    const errorEl = document.getElementById("signup-error");
    errorEl.innerText = "";

    if (!userId || userId.length < 3 || userId.length > 20) {
      errorEl.innerText = "Please choose a User ID between 3 and 20 characters.";
      return;
    }

    if (!/^[A-Za-z0-9_]+$/.test(userId)) {
      errorEl.innerText = "User ID can only contain letters, numbers, and underscores.";
      return;
    }

    if (password !== confirmPassword) {
      errorEl.innerText = "Passwords do not match.";
      return;
    }

    try {
      // Validate unique conditions
      const duplicateId = await DBAdapter.getUserById(userId);
      if (duplicateId) {
        errorEl.innerText = "That User ID is already taken. Please change it to something unique.";
        setUseridMsg("This User ID is already taken. Please choose another.", "#ff3b30");
        useridInput.focus();
        return;
      }

      const duplicateUser = await DBAdapter.getUserByUsername(username);
      if (duplicateUser) {
        errorEl.innerText = "Username is already taken.";
        return;
      }

      const duplicateEmail = await DBAdapter.getUserByEmail(email);
      if (duplicateEmail) {
        errorEl.innerText = "Email is already registered.";
        return;
      }

      // Safe Avatar generation (initials SVG)
      const initials = fullName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
      const randomColor = ["#2f80ed", "#34c759", "#af52de", "#ff2d55", "#ff9500"][Math.floor(Math.random() * 5)];
      const avatarSVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="${randomColor}"/><text x="50" y="58" font-size="30" font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle">${initials}</text></svg>`;

      const newUser = {
        id: userId,
        fullName,
        username,
        email,
        password,
        bio: "Hey there! I am using iOS 27 Messenger.",
        status: "Online",
        avatar: avatarSVG,
        friends: [],
        friendRequests: []
      };

      await DBAdapter.createUser(newUser);
      localStorage.setItem("ios27_currentUser", JSON.stringify(newUser));
      window.MotionSystem.navigate("messenger.html");

    } catch (err) {
      errorEl.innerText = "Error creating account. Please try again.";
      console.error(err);
    }
  });
}

// 3. MESSENGER PAGE CONTROLLER
function initMessengerPage() {
  loadFriendsList();
  loadGroupsList();
  loadConversationsList();
  renderPendingFriendRequests();
  setupContextMenus();
  setupVoicePlayback();

  document.getElementById("create-group-btn")?.addEventListener("click", openCreateGroupModal);
  
  // Realtime updates poller simulation
  let pollInFlight = false;
  setInterval(async () => {
    // If the last poll tick is still resolving (slow connection, tab was
    // backgrounded, etc.) skip this one rather than stacking a second
    // burst of requests on top of it — that pileup is exactly what was
    // making an in-the-moment click (like opening a chat) queue up behind
    // a wall of background traffic instead of firing immediately.
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      await Promise.allSettled([
        activeGroupId ? syncActiveGroupThread() : syncActiveThread(),
        loadFriendsList(),
        loadGroupsList(),
        renderPendingFriendRequests(),
        loadConversationsList()
      ]);
    } finally {
      pollInFlight = false;
    }
  }, 4000);

  // Global user searching listener
  const searchInput = document.getElementById("friend-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(performFriendSearch, 300));
  }

  // Contacts drawer (mobile/tablet): the sidebar column is the only
  // place to search users, add friends, and review pending requests,
  // so it needs to be reachable even where it can't stay permanently
  // docked on screen.
  const appCard = document.getElementById("main-app-card");
  document.getElementById("open-contacts-btn")?.addEventListener("click", () => {
    appCard?.classList.add("show-sidebar");
  });
  const closeSidebar = () => appCard?.classList.remove("show-sidebar");
  document.getElementById("sidebar-close-btn")?.addEventListener("click", closeSidebar);
  document.getElementById("sidebar-backdrop")?.addEventListener("click", closeSidebar);
}

// Helper Debouncer
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Friend Search
async function performFriendSearch() {
  const query = document.getElementById("friend-search-input").value.trim();
  const pane = document.getElementById("search-results-panel");
  if (!pane) return;

  if (query.length < 2) {
    pane.innerHTML = "";
    pane.style.display = "none";
    return;
  }

  pane.innerHTML = `<div class="skeleton" style="height: 50px; margin-bottom: 8px;"></div>`;
  pane.style.display = "block";

  try {
    const users = await DBAdapter.getUsers();
    // Filter matching IDs or usernames, excluding ourselves or current friends
    const matches = users.filter(u => 
      u.id !== currentUser.id && 
      !currentUser.friends.includes(u.id) &&
      (u.id.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()))
    );

    if (matches.length === 0) {
      pane.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:10px;">No users found</div>`;
      return;
    }

    pane.innerHTML = "";
    for (const match of matches) {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `
        <div class="avatar-wrapper" style="width: 32px; height: 32px;">
          <div class="avatar-img">${match.avatar}</div>
        </div>
        <div class="result-info">
          <div class="result-name">${match.fullName}</div>
          <div class="result-id">${match.id} (@${match.username})</div>
        </div>
        <button class="add-friend-btn" id="add-btn-${match.id}">Add</button>
      `;
      pane.appendChild(item);

      document.getElementById(`add-btn-${match.id}`).addEventListener("click", async () => {
        try {
          await DBAdapter.sendFriendRequest(currentUser.id, match.id);
          const btn = document.getElementById(`add-btn-${match.id}`);
          btn.innerText = "Sent";
          btn.className = "add-friend-btn requested";
          btn.disabled = true;
          showAppleNotification("Request Sent", `Friend request successfully transmitted to ${match.fullName}.`);
        } catch (e) {
          showAppleNotification("Error", e.message || "Failed to send request.");
        }
      });
    }
  } catch (err) {
    pane.innerHTML = `<div style="font-size:12px; color:#ff3b30; text-align:center;">Search failed.</div>`;
  }
}

// Pending Friend Requests Viewer
let _lastRequestsSnapshot = null;
async function renderPendingFriendRequests() {
  const container = document.getElementById("pending-requests-container");
  if (!container) return;

  try {
    const reqs = await DBAdapter.getFriendRequests(currentUser.id);

    if (reqs.length === 0) {
      if (_lastRequestsSnapshot === "") return;
      _lastRequestsSnapshot = "";
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:12px 0;">No pending requests</div>`;
      return;
    }

    // Fetch all profiles in one round trip instead of one lookup per request
    const users = await DBAdapter.getUsers();
    const usersById = new Map(users.map(u => [u.id, u]));

    const snapshot = JSON.stringify(reqs.map(r => r.id + r.status));
    if (snapshot === _lastRequestsSnapshot) return;
    _lastRequestsSnapshot = snapshot;

    container.classList.add("perf-list");
    container.innerHTML = "";
    for (const req of reqs) {
      const sender = usersById.get(req.senderId);
      if (!sender) continue;

      const card = document.createElement("div");
      card.className = "request-card perf-row reveal glass-panel-light";
      card.innerHTML = `
        <div class="avatar-wrapper" style="width: 32px; height: 32px;">
          <div class="avatar-img">${sender.avatar}</div>
        </div>
        <div class="result-info">
          <div class="result-name">${sender.fullName}</div>
          <div class="result-id">${sender.id}</div>
        </div>
        <div class="request-actions">
          <button class="req-btn accept" id="accept-req-${req.id}">✓</button>
          <button class="req-btn decline" id="decline-req-${req.id}">✕</button>
        </div>
      `;
      container.appendChild(card);

      document.getElementById(`accept-req-${req.id}`).addEventListener("click", async () => {
        await DBAdapter.updateFriendRequest(req.id, "accepted");
        // Reload current user profile to refresh friends state
        currentUser = await DBAdapter.getUserById(currentUser.id);
        localStorage.setItem("ios27_currentUser", JSON.stringify(currentUser));
        
        showAppleNotification("Request Accepted", `You are now friends with ${sender.fullName}.`);
        _lastRequestsSnapshot = null;
        _lastFriendsSnapshot = null;
        _lastConversationsSnapshot = null;
        renderPendingFriendRequests();
        loadFriendsList();
        loadConversationsList();
      });

      document.getElementById(`decline-req-${req.id}`).addEventListener("click", async () => {
        await DBAdapter.updateFriendRequest(req.id, "declined");
        showAppleNotification("Request Declined", `Declined invitation from ${sender.fullName}.`);
        _lastRequestsSnapshot = null;
        renderPendingFriendRequests();
      });
    }
    window.MotionSystem.refreshReveal(container);
  } catch (e) {
    console.error("Error loading pending requests:", e);
  }
}

let _lastFriendsSnapshot = null;
// Friends List Panel
async function loadFriendsList() {
  const container = document.getElementById("friends-list-container");
  if (!container) return;

  try {
    if (!currentUser.friends || currentUser.friends.length === 0) {
      if (_lastFriendsSnapshot === "") return;
      _lastFriendsSnapshot = "";
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px 0;">Add friends to start messaging</div>`;
      return;
    }

    // Fetch every profile in one round trip instead of one lookup per friend
    const users = await DBAdapter.getUsers();
    const usersById = new Map(users.map(u => [u.id, u]));
    const friends = currentUser.friends.map(id => usersById.get(id)).filter(Boolean);

    const snapshot = JSON.stringify(friends.map(f => f.id + f.status + f.fullName + f.avatar));
    if (snapshot === _lastFriendsSnapshot) return;
    _lastFriendsSnapshot = snapshot;

    container.classList.add("perf-list");
    container.innerHTML = "";
    for (const friend of friends) {
      const div = document.createElement("div");
      div.className = "friend-item perf-row reveal";
      div.innerHTML = `
        <div class="avatar-wrapper">
          <div class="avatar-img">${friend.avatar}</div>
          <div class="status-dot ${friend.status.toLowerCase() === 'online' ? '' : friend.status.toLowerCase() === 'away' ? 'away' : friend.status.toLowerCase() === 'do not disturb' ? 'dnd' : 'offline'}"></div>
        </div>
        <div class="friend-info">
          <div class="friend-name">${friend.fullName}</div>
          <div class="friend-status">${friend.status}</div>
        </div>
      `;

      div.addEventListener("click", () => {
        document.getElementById("main-app-card")?.classList.remove("show-sidebar");
        startChatSession(friend.id);
      });

      container.appendChild(div);
    }
    window.MotionSystem.refreshReveal(container);
  } catch (e) {
    console.error("Error loading friends list:", e);
  }
}

let _lastGroupsSnapshot = null;
// Groups Panel (sidebar)
async function loadGroupsList() {
  const container = document.getElementById("groups-list-container");
  if (!container) return;

  try {
    const groups = await DBAdapter.getUserGroups(currentUser.id);

    if (groups.length === 0) {
      if (_lastGroupsSnapshot === "") return;
      _lastGroupsSnapshot = "";
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:16px 0;">No groups yet</div>`;
      return;
    }

    const snapshot = JSON.stringify(groups.map(g => g.id + g.name + g.avatar + (g.memberIds || []).length));
    if (snapshot === _lastGroupsSnapshot) return;
    _lastGroupsSnapshot = snapshot;

    container.classList.add("perf-list");
    container.innerHTML = "";
    for (const group of groups) {
      const div = document.createElement("div");
      div.className = "friend-item perf-row reveal";
      div.innerHTML = `
        <div class="avatar-wrapper">
          <div class="avatar-img">${group.avatar}</div>
        </div>
        <div class="friend-info">
          <div class="friend-name">${group.name}</div>
          <div class="friend-status">${(group.memberIds || []).length} members</div>
        </div>
      `;

      div.addEventListener("click", () => {
        document.getElementById("main-app-card")?.classList.remove("show-sidebar");
        startGroupChatSession(group.id);
      });

      container.appendChild(div);
    }
    window.MotionSystem.refreshReveal(container);
  } catch (e) {
    console.error("Error loading groups list:", e);
  }
}

// New Group creation modal — built dynamically the same way the app already
// builds the Apple notification and context menu, so it doesn't need any
// dedicated markup sitting hidden in the page HTML.
async function openCreateGroupModal() {
  document.getElementById("group-modal-overlay")?.remove();

  const users = await DBAdapter.getUsers();
  const usersById = new Map(users.map(u => [u.id, u]));
  const friends = (currentUser.friends || []).map(id => usersById.get(id)).filter(Boolean);

  const overlay = document.createElement("div");
  overlay.id = "group-modal-overlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card glass-panel">
      <div class="modal-header">
        <h2 class="modal-title">New Group</h2>
        <div class="chat-action-btn modal-close-btn" id="close-group-modal">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </div>
      </div>

      <div class="glass-input-wrapper" style="margin-bottom: 18px;">
        <label class="glass-label" for="new-group-name">Group Name</label>
        <input type="text" id="new-group-name" class="glass-input" placeholder="e.g. Weekend Trip" maxlength="40" autocomplete="off">
      </div>

      <span class="section-label">Add Friends</span>
      <div class="modal-member-list" id="group-member-picker">
        ${friends.length === 0
          ? `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px 0;">Add some friends first to start a group.</div>`
          : friends.map(f => `
            <label class="member-pick-row" for="pick-${f.id}">
              <input type="checkbox" id="pick-${f.id}" value="${f.id}" class="group-member-checkbox">
              <div class="avatar-wrapper" style="width:32px; height:32px;">
                <div class="avatar-img">${f.avatar}</div>
              </div>
              <div class="result-info">
                <div class="result-name">${f.fullName}</div>
                <div class="result-id">${f.id}</div>
              </div>
            </label>
          `).join("")
        }
      </div>

      <div id="group-modal-error" style="color:#ff3b30; font-size:12px; text-align:center; min-height:16px; margin-top:12px;"></div>

      <button class="btn-primary" id="submit-create-group" style="margin-top:12px;" ${friends.length < 2 ? "disabled" : ""}>
        <span>Create Group</span>
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  const close = () => overlay.remove();
  document.getElementById("close-group-modal").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  document.getElementById("submit-create-group")?.addEventListener("click", async () => {
    const nameInput = document.getElementById("new-group-name");
    const name = nameInput.value.trim();
    const errorEl = document.getElementById("group-modal-error");
    errorEl.innerText = "";

    const picked = Array.from(document.querySelectorAll(".group-member-checkbox:checked")).map(cb => cb.value);

    if (!name) {
      errorEl.innerText = "Please enter a group name.";
      return;
    }
    if (picked.length < 2) {
      errorEl.innerText = "Select at least 2 friends to start a group.";
      return;
    }

    try {
      const memberIds = Array.from(new Set([currentUser.id, ...picked]));
      const group = await DBAdapter.createGroup({ name, memberIds, createdBy: currentUser.id });
      close();
      showAppleNotification("Group Created", `"${group.name}" is ready with ${memberIds.length} members.`);
      _lastGroupsSnapshot = null;
      _lastConversationsSnapshot = null;
      await loadGroupsList();
      document.getElementById("main-app-card")?.classList.remove("show-sidebar");
      startGroupChatSession(group.id);
    } catch (e) {
      console.error("Create group failed:", e);
      const reason = (e && (e.message || e.error_description || e.details)) || "";
      errorEl.innerText = reason
        ? `Failed to create group: ${reason}`
        : "Failed to create group. Please try again.";
    }
  });
}

// Group Info modal — view members, add friends who aren't in the group yet,
// or leave the group entirely.
async function openGroupInfoModal(groupId) {
  document.getElementById("group-modal-overlay")?.remove();

  const [group, users] = await Promise.all([DBAdapter.getGroupById(groupId), DBAdapter.getUsers()]);
  if (!group) return;
  const usersById = new Map(users.map(u => [u.id, u]));
  const members = (group.memberIds || []).map(id => usersById.get(id)).filter(Boolean);
  const nonMembers = (currentUser.friends || [])
    .map(id => usersById.get(id))
    .filter(f => f && !(group.memberIds || []).includes(f.id));

  const overlay = document.createElement("div");
  overlay.id = "group-modal-overlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card glass-panel">
      <div class="modal-header">
        <h2 class="modal-title">${group.name}</h2>
        <div class="chat-action-btn modal-close-btn" id="close-group-modal">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </div>
      </div>

      <span class="section-label">${members.length} Members</span>
      <div class="modal-member-list">
        ${members.map(m => `
          <div class="member-pick-row" style="cursor:default;">
            <div class="avatar-wrapper" style="width:32px; height:32px;">
              <div class="avatar-img">${m.avatar}</div>
            </div>
            <div class="result-info">
              <div class="result-name">${m.fullName}${m.id === group.createdBy ? ' <span style="color:var(--accent-color); font-size:10px; font-weight:700;">· Admin</span>' : ''}${m.id === currentUser.id ? ' (You)' : ''}</div>
              <div class="result-id">${m.id}</div>
            </div>
          </div>
        `).join("")}
      </div>

      ${nonMembers.length > 0 ? `
        <span class="section-label" style="margin-top: 20px;">Add Friends</span>
        <div class="modal-member-list" id="group-add-picker">
          ${nonMembers.map(f => `
            <label class="member-pick-row" for="addpick-${f.id}">
              <input type="checkbox" id="addpick-${f.id}" value="${f.id}" class="group-add-checkbox">
              <div class="avatar-wrapper" style="width:32px; height:32px;">
                <div class="avatar-img">${f.avatar}</div>
              </div>
              <div class="result-info">
                <div class="result-name">${f.fullName}</div>
                <div class="result-id">${f.id}</div>
              </div>
            </label>
          `).join("")}
        </div>
        <button class="btn-primary" id="submit-add-members" style="margin-top:14px;">
          <span>Add Selected</span>
        </button>
      ` : ""}

      <button class="btn-primary" id="leave-group-btn" style="margin-top:16px; background:rgba(255,59,48,0.15); color:#ff3b30; box-shadow:none;">
        <span>Leave Group</span>
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  const close = () => overlay.remove();
  document.getElementById("close-group-modal").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  document.getElementById("submit-add-members")?.addEventListener("click", async () => {
    const picked = Array.from(document.querySelectorAll(".group-add-checkbox:checked")).map(cb => cb.value);
    if (picked.length === 0) return;
    await DBAdapter.addGroupMembers(groupId, picked);
    showAppleNotification("Members Added", `${picked.length} new member${picked.length > 1 ? "s" : ""} joined ${group.name}.`);
    close();
    _lastGroupsSnapshot = null;
    if (activeGroupId === groupId) startGroupChatSession(groupId);
    else loadGroupsList();
  });

  document.getElementById("leave-group-btn").addEventListener("click", async () => {
    if (!confirm(`Leave "${group.name}"? You won't receive messages from this group anymore.`)) return;
    await DBAdapter.removeGroupMember(groupId, currentUser.id);
    showAppleNotification("Left Group", `You have left ${group.name}.`);
    close();
    _lastGroupsSnapshot = null;
    _lastConversationsSnapshot = null;

    if (activeGroupId === groupId) {
      activeGroupId = null;
      document.getElementById("chat-main-column").innerHTML = `
        <div class="chat-empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
          </div>
          <div>
            <h3 class="empty-state-title">Your Spatial Messages</h3>
            <p style="font-size: 13px; margin-top: 6px; opacity: 0.65;">Select a chat thread or select a contact in sidebar to begin.</p>
          </div>
        </div>
      `;
    }
    loadGroupsList();
    loadConversationsList();
  });
}

let _lastConversationsSnapshot = null;
// Conversation Threads Column
async function loadConversationsList() {
  const container = document.getElementById("conversations-list-container");
  if (!container) return;

  try {
    const users = await DBAdapter.getUsers();
    const usersById = new Map(users.map(u => [u.id, u]));
    const allMsgs = await DBAdapter.getAllMessagesForUser(currentUser.id);
    const userGroups = await DBAdapter.getUserGroups(currentUser.id);
    const groupIds = userGroups.map(g => g.id);
    const groupMsgs = await DBAdapter.getMessagesForGroups(groupIds);

    // Pinned lists (shared between DM partner ids and group ids)
    const pinnedIds = JSON.parse(localStorage.getItem("ios27_chats_pinned")) || [];

    // Find who we have DM threads with
    const activePartners = new Set();
    allMsgs.forEach(m => {
      if (m.senderId === currentUser.id) activePartners.add(m.receiverId);
      if (m.receiverId === currentUser.id) activePartners.add(m.senderId);
    });

    // Derive last message + unread count per partner from the already-fetched
    // message list instead of firing an extra query per conversation.
    const threads = [];
    for (const partnerId of activePartners) {
      const partner = usersById.get(partnerId);
      if (!partner) continue;

      const msgs = allMsgs
        .filter(m => (m.senderId === currentUser.id && m.receiverId === partnerId) || (m.senderId === partnerId && m.receiverId === currentUser.id))
        .sort((a, b) => a.timestamp - b.timestamp);
      const lastMsg = msgs[msgs.length - 1];
      const unreadCount = msgs.filter(m => m.senderId === partnerId && m.status !== "seen").length;

      threads.push({
        type: "dm",
        id: partner.id,
        title: partner.fullName,
        avatar: partner.avatar,
        statusDotClass: partner.status.toLowerCase() === 'online' ? '' : partner.status.toLowerCase() === 'away' ? 'away' : partner.status.toLowerCase() === 'do not disturb' ? 'dnd' : 'offline',
        lastMsg,
        unreadCount,
        pinned: pinnedIds.includes(partner.id)
      });
    }

    // Every group the user belongs to gets a thread too, even with zero
    // messages so far (same as friends showing up in the sidebar list
    // before a first DM is sent).
    for (const group of userGroups) {
      const msgs = groupMsgs
        .filter(m => m.groupId === group.id)
        .sort((a, b) => a.timestamp - b.timestamp);
      const lastMsg = msgs[msgs.length - 1];
      const lastRead = DBAdapter.getGroupLastRead(group.id);
      const unreadCount = msgs.filter(m => m.senderId !== currentUser.id && m.timestamp > lastRead).length;

      threads.push({
        type: "group",
        id: group.id,
        title: group.name,
        avatar: group.avatar,
        statusDotClass: null,
        lastMsg,
        unreadCount,
        pinned: pinnedIds.includes(group.id)
      });
    }

    // Sort pinned first, then last message timestamp descending
    threads.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const tA = a.lastMsg ? a.lastMsg.timestamp : 0;
      const tB = b.lastMsg ? b.lastMsg.timestamp : 0;
      return tB - tA;
    });

    if (threads.length === 0) {
      if (_lastConversationsSnapshot === "") return;
      _lastConversationsSnapshot = "";
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:40px 0;">No active threads.<br>Select a friend or group in the sidebar to start typing.</div>`;
      return;
    }

    const activeId = activeGroupId || activeChatUserId;
    const snapshot = JSON.stringify(threads.map(t => t.type + t.id + (t.lastMsg ? t.lastMsg.id + t.lastMsg.status : "") + t.unreadCount + t.pinned)) + activeId;
    if (snapshot === _lastConversationsSnapshot) return;
    _lastConversationsSnapshot = snapshot;

    container.classList.add("perf-list");
    container.innerHTML = "";
    for (const thread of threads) {
      const div = document.createElement("div");
      const isActive = thread.type === "group" ? activeGroupId === thread.id : activeChatUserId === thread.id;
      div.className = `chat-thread-item perf-row reveal ${isActive ? 'active' : ''}`;

      const timeStr = thread.lastMsg ? formatChatTime(thread.lastMsg.timestamp) : "";
      let contentStr = thread.lastMsg ? thread.lastMsg.content : "No messages";
      if (thread.type === "group" && thread.lastMsg) {
        const senderLabel = thread.lastMsg.senderId === currentUser.id
          ? "You"
          : (usersById.get(thread.lastMsg.senderId)?.fullName.split(" ")[0] || "Someone");
        contentStr = `${senderLabel}: ${contentStr}`;
      }

      const badgeMarkup = thread.statusDotClass !== null
        ? `<div class="status-dot ${thread.statusDotClass}"></div>`
        : `<div class="group-badge-icon" title="Group chat"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div>`;

      div.innerHTML = `
        <div class="avatar-wrapper">
          <div class="avatar-img">${thread.avatar}</div>
          ${badgeMarkup}
        </div>
        <div class="thread-preview">
          <div class="thread-header">
            <div class="thread-name">
              ${thread.pinned ? `<svg class="pin-icon" viewBox="0 0 24 24"><path d="M16 12V4h1v-2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>` : ""}
              ${thread.title}
            </div>
            <div class="thread-time">${timeStr}</div>
          </div>
          <div class="thread-message-row">
            <div class="thread-last-msg">${contentStr}</div>
            ${thread.unreadCount > 0 ? `<div class="unread-badge">${thread.unreadCount}</div>` : ""}
          </div>
        </div>
      `;

      div.addEventListener("click", () => {
        if (thread.type === "group") startGroupChatSession(thread.id);
        else startChatSession(thread.id);
      });

      container.appendChild(div);
    }
    window.MotionSystem.refreshReveal(container);

  } catch (e) {
    console.error("Error loading conversations list:", e);
  }
}

// Format Chat Timestamp
function formatChatTime(ts) {
  const date = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 86400000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 86400000 * 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Start Chat Thread View
async function startChatSession(friendId) {
  activeChatUserId = friendId;
  activeGroupId = null;
  activeReplyMessageId = null;
  const replyBanner = document.getElementById("active-reply-banner");
  if (replyBanner) replyBanner.style.display = "none";

  // Hide empty state, reveal chat elements
  const mainCol = document.getElementById("chat-main-column");
  if (!mainCol) return;

  // Partner lookup and message fetch are independent — firing them together
  // instead of one after another is what actually shortens the "click to
  // first bubble on screen" time on a networked (Supabase) backend, since
  // the two round trips now overlap instead of stacking.
  const partnerPromise = DBAdapter.getUserById(friendId);
  const messagesPromise = DBAdapter.getMessages(currentUser.id, friendId);

  const partner = await partnerPromise;
  if (!partner) return;

  // Mobile layout adjustment
  if (isMobileView) {
    document.getElementById("main-app-card").classList.add("show-chat");
  }

  mainCol.innerHTML = `
    <!-- Chat Header -->
    <div class="chat-header-bar">
      <div class="chat-user-profile" id="header-user-profile">
        ${isMobileView ? `<div class="chat-action-btn" id="mobile-back-btn" style="margin-right: 8px;"><svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></div>` : ""}
        <div class="avatar-wrapper" style="width: 38px; height: 38px;">
          <div class="avatar-img">${partner.avatar}</div>
          <div class="status-dot ${partner.status.toLowerCase() === 'online' ? '' : partner.status.toLowerCase() === 'away' ? 'away' : partner.status.toLowerCase() === 'do not disturb' ? 'dnd' : 'offline'}"></div>
        </div>
        <div>
          <div class="chat-user-name">${partner.fullName}</div>
          <div class="chat-user-status">${partner.status}</div>
        </div>
      </div>
      <div class="chat-header-actions">
        <button class="chat-action-btn" id="btn-pin-chat" title="Pin Conversation">
          <svg viewBox="0 0 24 24"><path d="M16 12V4h1v-2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        </button>
        <button class="chat-action-btn" id="btn-view-info" title="View Profile Bio">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
        </button>
      </div>
    </div>

    <!-- Messages Viewport -->
    <div class="chat-messages-viewport" id="messages-viewport">
      <!-- Loaded dynamically -->
    </div>

    <!-- Active Reply Banner -->
    <div class="active-reply-banner" id="active-reply-banner" style="display:none;">
      <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; font-size:11px; color:var(--accent-color);">Replying to Message</span>
        <span id="reply-banner-text" style="color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:400px;"></span>
      </div>
      <button class="close-reply-btn" id="cancel-reply-btn">✕</button>
    </div>

    <!-- Chat Footer Input -->
    <div class="chat-footer">
      <div class="chat-input-row">
        <!-- Attachment button + hidden file input -->
        <input type="file" id="chat-attachment-input" style="display:none;" accept="image/*,.pdf,.doc,.docx,.txt,.zip,.csv,video/*,audio/*">
        <button class="chat-footer-btn" id="chat-attachment-btn" title="Add Attachment">
          <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-3.31 2.69-6 6-6s6 2.69 6 6v10.5c0 4.42-3.58 8-8 8s-8-3.58-8-8V6h2v9.5c0 3.31 2.69 6 6 6s6-2.69 6-6V5c0-2.21-1.79-4-4-4s-4 1.79-4 4v12.5c0 1.1.9 2 2 2s2-.9 2-2V6h2z"/></svg>
        </button>

        <!-- Input Box -->
        <div class="chat-input-box-wrapper">
          <input type="text" class="chat-input-box" id="msg-input" placeholder="iMessage..." autocomplete="off">
          
          <!-- Emoji picker trigger button -->
          <button class="chat-footer-btn" id="emoji-trigger-btn" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); border:none; background:none; width:32px; height:32px;" title="Emojis Picker">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 4h2v2h-2V6zm-4 0h2v2H9V6zm3 11c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z"/></svg>
          </button>

          <!-- Emoji picker panel overlay -->
          <div class="emoji-picker-overlay" id="emoji-picker-panel">
            <div class="emoji-select-btn">😊</div>
            <div class="emoji-select-btn">😂</div>
            <div class="emoji-select-btn">❤️</div>
            <div class="emoji-select-btn">👍</div>
            <div class="emoji-select-btn">🔥</div>
            <div class="emoji-select-btn">😭</div>
            <div class="emoji-select-btn">👏</div>
            <div class="emoji-select-btn">🎉</div>
            <div class="emoji-select-btn">🤔</div>
            <div class="emoji-select-btn">🚀</div>
            <div class="emoji-select-btn">👀</div>
            <div class="emoji-select-btn">✨</div>
          </div>
        </div>

        <!-- Voice recording timer (shown only while recording) -->
        <span class="voice-record-timer" id="voice-record-timer" style="display:none;">0:00</span>

        <!-- Cancel recording button (shown only while recording) -->
        <button class="chat-footer-btn voice-cancel-btn" id="voice-cancel-btn" title="Cancel recording" style="display:none;">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>

        <!-- Voice message record button (tap to start, tap again to send) -->
        <button class="chat-footer-btn" id="chat-voice-btn" title="Record voice message" style="display: flex;">
          <svg class="icon-mic" viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
          <svg class="icon-stop" viewBox="0 0 24 24" style="display:none;"><path d="M6 6h12v12H6z"/></svg>
        </button>

        <button class="btn-primary" id="msg-send-btn" style="width:44px; height:44px; border-radius:50%; padding:0; flex-shrink:0; display:none;" title="Send Message">
          <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:#fff;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;

  // Bind Pin action
  const pinnedIds = JSON.parse(localStorage.getItem("ios27_chats_pinned")) || [];
  const isPinned = pinnedIds.includes(friendId);
  const pinBtn = document.getElementById("btn-pin-chat");
  if (isPinned) pinBtn.style.color = "var(--accent-color)";

  pinBtn.addEventListener("click", () => {
    let list = JSON.parse(localStorage.getItem("ios27_chats_pinned")) || [];
    if (list.includes(friendId)) {
      list = list.filter(id => id !== friendId);
      pinBtn.style.color = "";
      showAppleNotification("Chat Unpinned", `Removed ${partner.fullName} from pinned conversations.`);
    } else {
      list.push(friendId);
      pinBtn.style.color = "var(--accent-color)";
      showAppleNotification("Chat Pinned", `Pinned ${partner.fullName} at the top of conversations list.`);
    }
    localStorage.setItem("ios27_chats_pinned", JSON.stringify(list));
    loadConversationsList();
  });

  // Bind Info Bio click
  document.getElementById("btn-view-info").addEventListener("click", () => {
    showAppleNotification(`Bio - ${partner.fullName}`, partner.bio || "No status bio configured.");
  });

  // Mobile Back Button binding
  if (isMobileView) {
    document.getElementById("mobile-back-btn").addEventListener("click", () => {
      document.getElementById("main-app-card").classList.remove("show-chat");
      activeChatUserId = null;
      loadConversationsList();
    });
  }

  // Input Box keypress triggers & Dynamic Buttons switching
  const input = document.getElementById("msg-input");
  const sendBtn = document.getElementById("msg-send-btn");
  const voiceBtn = document.getElementById("chat-voice-btn");

  input.addEventListener("input", () => {
    if (input.value.trim().length > 0) {
      sendBtn.style.display = "flex";
      voiceBtn.style.display = "none";
    } else {
      sendBtn.style.display = "none";
      voiceBtn.style.display = "flex";
    }

    // Trigger typing simulation alerts in localStorage
    triggerTypingIndicator();
  });

  // Bind sending actions
  sendBtn.addEventListener("click", sendChatMessage);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });

  // Wire up real voice-message recording (mic tap to start/stop, ✕ to cancel)
  bindVoiceButton();

  // Emoji picker overlay panel triggers
  const emojiTrigger = document.getElementById("emoji-trigger-btn");
  const emojiPanel = document.getElementById("emoji-picker-panel");

  emojiTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    emojiPanel.style.display = emojiPanel.style.display === "grid" ? "none" : "grid";
  });

  document.querySelectorAll(".emoji-select-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      input.value += btn.innerText;
      sendBtn.style.display = "flex";
      voiceBtn.style.display = "none";
      emojiPanel.style.display = "none";
    });
  });

  document.addEventListener("click", () => {
    if (emojiPanel) emojiPanel.style.display = "none";
  });

  // Cancel reply trigger
  document.getElementById("cancel-reply-btn").addEventListener("click", () => {
    activeReplyMessageId = null;
    document.getElementById("active-reply-banner").style.display = "none";
  });

  // Attachment button trigger
  bindAttachmentButton();

  // Populate active messages viewport
  await syncActiveThread(messagesPromise);
  // Let the browser paint the thread first — the conversations-list
  // rebuild is heavier (users + all messages + all groups) and doesn't
  // need to delay what the person is actually waiting to see.
  requestAnimationFrame(() => loadConversationsList());
}

// Start Group Chat Thread View
async function startGroupChatSession(groupId) {
  activeGroupId = groupId;
  activeChatUserId = null;
  activeReplyMessageId = null;
  const existingBanner = document.getElementById("active-reply-banner");
  if (existingBanner) existingBanner.style.display = "none";

  const mainCol = document.getElementById("chat-main-column");
  if (!mainCol) return;

  const group = await DBAdapter.getGroupById(groupId);
  if (!group) return;

  // Mobile layout adjustment
  if (isMobileView) {
    document.getElementById("main-app-card").classList.add("show-chat");
  }

  mainCol.innerHTML = `
    <!-- Chat Header -->
    <div class="chat-header-bar">
      <div class="chat-user-profile" id="header-user-profile">
        ${isMobileView ? `<div class="chat-action-btn" id="mobile-back-btn" style="margin-right: 8px;"><svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></div>` : ""}
        <div class="avatar-wrapper" style="width: 38px; height: 38px;">
          <div class="avatar-img">${group.avatar}</div>
        </div>
        <div>
          <div class="chat-user-name">${group.name}</div>
          <div class="chat-user-status">${(group.memberIds || []).length} members</div>
        </div>
      </div>
      <div class="chat-header-actions">
        <button class="chat-action-btn" id="btn-pin-chat" title="Pin Conversation">
          <svg viewBox="0 0 24 24"><path d="M16 12V4h1v-2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        </button>
        <button class="chat-action-btn" id="btn-view-info" title="Group Info">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
        </button>
      </div>
    </div>

    <!-- Messages Viewport -->
    <div class="chat-messages-viewport" id="messages-viewport">
      <!-- Loaded dynamically -->
    </div>

    <!-- Active Reply Banner -->
    <div class="active-reply-banner" id="active-reply-banner" style="display:none;">
      <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; font-size:11px; color:var(--accent-color);">Replying to Message</span>
        <span id="reply-banner-text" style="color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:400px;"></span>
      </div>
      <button class="close-reply-btn" id="cancel-reply-btn">✕</button>
    </div>

    <!-- Chat Footer Input -->
    <div class="chat-footer">
      <div class="chat-input-row">
        <!-- Attachment button + hidden file input -->
        <input type="file" id="chat-attachment-input" style="display:none;" accept="image/*,.pdf,.doc,.docx,.txt,.zip,.csv,video/*,audio/*">
        <button class="chat-footer-btn" id="chat-attachment-btn" title="Add Attachment">
          <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-3.31 2.69-6 6-6s6 2.69 6 6v10.5c0 4.42-3.58 8-8 8s-8-3.58-8-8V6h2v9.5c0 3.31 2.69 6 6 6s6-2.69 6-6V5c0-2.21-1.79-4-4-4s-4 1.79-4 4v12.5c0 1.1.9 2 2 2s2-.9 2-2V6h2z"/></svg>
        </button>

        <!-- Input Box -->
        <div class="chat-input-box-wrapper">
          <input type="text" class="chat-input-box" id="msg-input" placeholder="iMessage..." autocomplete="off">
          
          <!-- Emoji picker trigger button -->
          <button class="chat-footer-btn" id="emoji-trigger-btn" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); border:none; background:none; width:32px; height:32px;" title="Emojis Picker">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 4h2v2h-2V6zm-4 0h2v2H9V6zm3 11c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z"/></svg>
          </button>

          <!-- Emoji picker panel overlay -->
          <div class="emoji-picker-overlay" id="emoji-picker-panel">
            <div class="emoji-select-btn">😊</div>
            <div class="emoji-select-btn">😂</div>
            <div class="emoji-select-btn">❤️</div>
            <div class="emoji-select-btn">👍</div>
            <div class="emoji-select-btn">🔥</div>
            <div class="emoji-select-btn">😭</div>
            <div class="emoji-select-btn">👏</div>
            <div class="emoji-select-btn">🎉</div>
            <div class="emoji-select-btn">🤔</div>
            <div class="emoji-select-btn">🚀</div>
            <div class="emoji-select-btn">👀</div>
            <div class="emoji-select-btn">✨</div>
          </div>
        </div>

        <!-- Voice recording timer (shown only while recording) -->
        <span class="voice-record-timer" id="voice-record-timer" style="display:none;">0:00</span>

        <!-- Cancel recording button (shown only while recording) -->
        <button class="chat-footer-btn voice-cancel-btn" id="voice-cancel-btn" title="Cancel recording" style="display:none;">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>

        <!-- Voice message record button (tap to start, tap again to send) -->
        <button class="chat-footer-btn" id="chat-voice-btn" title="Record voice message" style="display: flex;">
          <svg class="icon-mic" viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
          <svg class="icon-stop" viewBox="0 0 24 24" style="display:none;"><path d="M6 6h12v12H6z"/></svg>
        </button>

        <button class="btn-primary" id="msg-send-btn" style="width:44px; height:44px; border-radius:50%; padding:0; flex-shrink:0; display:none;" title="Send Message">
          <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:#fff;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;

  // Bind Pin action (pinned ids are shared between DM partner ids and group ids)
  const pinnedIds = JSON.parse(localStorage.getItem("ios27_chats_pinned")) || [];
  const isPinned = pinnedIds.includes(groupId);
  const pinBtn = document.getElementById("btn-pin-chat");
  if (isPinned) pinBtn.style.color = "var(--accent-color)";

  pinBtn.addEventListener("click", () => {
    let list = JSON.parse(localStorage.getItem("ios27_chats_pinned")) || [];
    if (list.includes(groupId)) {
      list = list.filter(id => id !== groupId);
      pinBtn.style.color = "";
      showAppleNotification("Chat Unpinned", `Removed ${group.name} from pinned conversations.`);
    } else {
      list.push(groupId);
      pinBtn.style.color = "var(--accent-color)";
      showAppleNotification("Chat Pinned", `Pinned ${group.name} at the top of conversations list.`);
    }
    localStorage.setItem("ios27_chats_pinned", JSON.stringify(list));
    loadConversationsList();
  });

  // Bind Group Info click
  document.getElementById("btn-view-info").addEventListener("click", () => openGroupInfoModal(groupId));

  // Mobile Back Button binding
  if (isMobileView) {
    document.getElementById("mobile-back-btn").addEventListener("click", () => {
      document.getElementById("main-app-card").classList.remove("show-chat");
      activeGroupId = null;
      loadConversationsList();
    });
  }

  // Input Box keypress triggers & Dynamic Buttons switching
  const input = document.getElementById("msg-input");
  const sendBtn = document.getElementById("msg-send-btn");
  const voiceBtn = document.getElementById("chat-voice-btn");

  input.addEventListener("input", () => {
    if (input.value.trim().length > 0) {
      sendBtn.style.display = "flex";
      voiceBtn.style.display = "none";
    } else {
      sendBtn.style.display = "none";
      voiceBtn.style.display = "flex";
    }

    triggerTypingIndicator();
  });

  // Bind sending actions
  sendBtn.addEventListener("click", sendChatMessage);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });

  // Wire up real voice-message recording (mic tap to start/stop, ✕ to cancel)
  bindVoiceButton();

  // Emoji picker overlay panel triggers
  const emojiTrigger = document.getElementById("emoji-trigger-btn");
  const emojiPanel = document.getElementById("emoji-picker-panel");

  emojiTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    emojiPanel.style.display = emojiPanel.style.display === "grid" ? "none" : "grid";
  });

  document.querySelectorAll(".emoji-select-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      input.value += btn.innerText;
      sendBtn.style.display = "flex";
      voiceBtn.style.display = "none";
      emojiPanel.style.display = "none";
    });
  });

  document.addEventListener("click", () => {
    if (emojiPanel) emojiPanel.style.display = "none";
  });

  // Cancel reply trigger
  document.getElementById("cancel-reply-btn").addEventListener("click", () => {
    activeReplyMessageId = null;
    document.getElementById("active-reply-banner").style.display = "none";
  });

  // Attachment button trigger
  bindAttachmentButton();

  // Populate active messages viewport
  await syncActiveGroupThread();
  loadConversationsList();
}

// Trigger local typing simulation
function triggerTypingIndicator() {
  const key = activeGroupId
    ? `ios27_typing_${currentUser.id}_group_${activeGroupId}`
    : `ios27_typing_${currentUser.id}_${activeChatUserId}`;
  localStorage.setItem(key, "true");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    localStorage.removeItem(key);
  }, 2000);
}

// mm:ss formatting for voice-note durations
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Deterministic pseudo-waveform bars (seeded by message id) — cosmetic
// only, since decoding real amplitude data would need Web Audio analysis.
// Rendered twice per voice bubble (once muted, once accent-colored and
// clipped by playback progress) so the two always line up visually.
function buildWaveformBars(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let bars = "";
  const BAR_COUNT = 24;
  for (let i = 0; i < BAR_COUNT; i++) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const heightPct = 25 + (hash % 75); // 25%-100% tall
    bars += `<span class="voice-bar" style="height:${heightPct}%"></span>`;
  }
  return bars;
}

// Builds the markup for a message's attachment, if it has one: an inline
// preview for images, a playable bar for voice notes, or a small
// downloadable file chip for anything else.
function renderAttachmentMarkup(m) {
  if (!m.attachmentUrl) return "";
  const safeName = (m.attachmentName || "Attachment").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  if (m.attachmentType === "image") {
    return `
      <a href="${m.attachmentUrl}" target="_blank" rel="noopener noreferrer" class="message-attachment-image-link">
        <img src="${m.attachmentUrl}" alt="${safeName}" class="message-attachment-image" loading="lazy">
      </a>
    `;
  }

  if (m.attachmentType === "audio") {
    const durLabel = formatDuration(m.attachmentDuration);
    const barsHtml = buildWaveformBars(m.id);
    return `
      <div class="voice-message" data-audio-url="${m.attachmentUrl}" data-duration="${m.attachmentDuration || 0}">
        <button class="voice-play-btn" title="Play voice message">
          <svg class="icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <svg class="icon-pause" viewBox="0 0 24 24" style="display:none;"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
        </button>
        <div class="voice-waveform">
          <div class="voice-bars-track voice-bars-muted">${barsHtml}</div>
          <div class="voice-bars-progress" style="width:0%">
            <div class="voice-bars-track voice-bars-accent">${barsHtml}</div>
          </div>
        </div>
        <span class="voice-duration">${durLabel}</span>
      </div>
    `;
  }

  return `
    <a href="${m.attachmentUrl}" target="_blank" rel="noopener noreferrer" download="${safeName}" class="message-attachment-file">
      <svg viewBox="0 0 24 24" class="attachment-file-icon"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-3.31 2.69-6 6-6s6 2.69 6 6v10.5c0 4.42-3.58 8-8 8s-8-3.58-8-8V6h2v9.5c0 3.31 2.69 6 6 6s6-2.69 6-6V5c0-2.21-1.79-4-4-4s-4 1.79-4 4v12.5c0 1.1.9 2 2 2s2-.9 2-2V6h2z"/></svg>
      <span class="attachment-file-name">${safeName}</span>
    </a>
  `;
}

// Sync current messaging feed
let _lastThreadSnapshot = null;
let _lastThreadPartnerId = null;
async function syncActiveThread(preloadedMessages) {
  if (!activeChatUserId) return;

  const viewport = document.getElementById("messages-viewport");
  if (!viewport) return;

  try {
    // The very first call after opening a chat can be handed a fetch
    // that's already in flight (kicked off in parallel with the partner
    // lookup in startChatSession) — reuse it instead of firing a second,
    // identical query. Poll-driven calls just fetch fresh as before.
    const msgs = preloadedMessages ? await preloadedMessages : await DBAdapter.getMessages(currentUser.id, activeChatUserId);

    // Mark received messages as seen. This used to block the first paint
    // on a full extra network round trip (write, then re-fetch to confirm)
    // — now we flip the status locally so rendering never waits on it, and
    // let the write happen in the background. Worst case on a failed write
    // the next poll tick reconciles it; nothing the person sees depends on it.
    const unseenIds = msgs
      .filter(m => m.senderId === activeChatUserId && m.status !== "seen")
      .map(m => m.id);
    const updatedAny = unseenIds.length > 0;
    if (updatedAny) {
      const unseenSet = new Set(unseenIds);
      for (const m of msgs) {
        if (unseenSet.has(m.id)) m.status = "seen";
      }
      DBAdapter.markMessagesSeen(unseenIds).catch(() => {});
    }

    const finalMsgs = msgs;

    // Skip the (expensive) DOM rebuild entirely if nothing actually changed
    // since the last render — this is what keeps polling from causing jank.
    const peerIsTyping = localStorage.getItem(`ios27_typing_${activeChatUserId}_${currentUser.id}`) === "true";
    const snapshot = activeChatUserId + "|" + peerIsTyping + "|" +
      JSON.stringify(finalMsgs.map(m => [m.id, m.content, m.status, m.reaction, m.edited]));
    if (snapshot === _lastThreadSnapshot && activeChatUserId === _lastThreadPartnerId) {
      return;
    }
    _lastThreadSnapshot = snapshot;
    _lastThreadPartnerId = activeChatUserId;

    // Build viewport DOM
    let html = "";
    for (const m of finalMsgs) {
      const isSent = m.senderId === currentUser.id;
      const statusLabel = isSent ? (m.status === 'seen' ? 'Seen' : m.status === 'delivered' ? 'Delivered' : 'Sent') : '';
      const timeLabel = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Handle reply attachment rendering
      let replyMarkup = "";
      if (m.replyTo) {
        const parentMsg = finalMsgs.find(p => p.id === m.replyTo) || { content: "[Deleted message]" };
        replyMarkup = `<div class="replied-message-box">⤾ ${parentMsg.content}</div>`;
      }

      // Handle reaction attachment rendering
      let reactionMarkup = m.reaction ? `<div class="message-reaction-tag">${m.reaction}</div>` : "";

      const attachmentMarkup = renderAttachmentMarkup(m);
      const hasAttachmentOnly = m.attachmentUrl && !m.content;

      html += `
        <div class="message-bubble-group reveal ${isSent ? 'sent' : 'received'}" data-msgid="${m.id}">
          ${replyMarkup}
          <div class="message-bubble ${hasAttachmentOnly ? 'attachment-only' : ''}">
            ${attachmentMarkup}
            ${m.content ? `<div class="message-text">${m.content}</div>` : ''}
            ${reactionMarkup}
          </div>
          <div class="message-meta">
            <span>${timeLabel}</span>
            ${m.edited ? '<span style="font-style:italic;">(edited)</span>' : ''}
            ${isSent ? `<span>•</span> <span>${statusLabel}</span>` : ''}
          </div>
        </div>
      `;
    }

    // Append typing indicator bubble if peer is typing
    if (peerIsTyping) {
      html += `
        <div class="typing-indicator-bubble" id="typing-bubble">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
    }

    // Keep scroll position if user is reading up, or scroll to bottom
    const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
    viewport.innerHTML = html;
    window.MotionSystem.refreshReveal(viewport);

    if (isAtBottom || updatedAny) {
      viewport.scrollTop = viewport.scrollHeight;
    }

  } catch (e) {
    console.error("Sync active thread error:", e);
  }
}

// Sync the active group's message feed. Group messages don't carry a
// meaningful single "seen" state (there's no one right answer for whether
// a group of people has "seen" something), so read tracking here is a
// local last-viewed timestamp instead of per-message status flips.
let _lastGroupThreadSnapshot = null;
let _lastGroupThreadId = null;
async function syncActiveGroupThread() {
  if (!activeGroupId) return;

  const viewport = document.getElementById("messages-viewport");
  if (!viewport) return;

  try {
    const [msgs, group, users] = await Promise.all([
      DBAdapter.getGroupMessages(activeGroupId),
      DBAdapter.getGroupById(activeGroupId),
      DBAdapter.getUsers()
    ]);
    if (!group) return;
    const usersById = new Map(users.map(u => [u.id, u]));

    // Mark as read while this thread is the one on screen
    if (msgs.length > 0) {
      DBAdapter.setGroupLastRead(activeGroupId, msgs[msgs.length - 1].timestamp);
    }

    const peerTypingKeys = (group.memberIds || []).filter(id => id !== currentUser.id);
    const someoneTyping = peerTypingKeys.some(id => localStorage.getItem(`ios27_typing_${id}_group_${activeGroupId}`) === "true");

    const snapshot = activeGroupId + "|" + someoneTyping + "|" +
      JSON.stringify(msgs.map(m => [m.id, m.content, m.reaction, m.edited]));
    if (snapshot === _lastGroupThreadSnapshot && activeGroupId === _lastGroupThreadId) {
      return;
    }
    _lastGroupThreadSnapshot = snapshot;
    _lastGroupThreadId = activeGroupId;

    let html = "";
    let prevSenderId = null;
    for (const m of msgs) {
      const isSent = m.senderId === currentUser.id;
      const sender = usersById.get(m.senderId);
      const timeLabel = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let replyMarkup = "";
      if (m.replyTo) {
        const parentMsg = msgs.find(p => p.id === m.replyTo) || { content: "[Deleted message]" };
        replyMarkup = `<div class="replied-message-box">⤾ ${parentMsg.content}</div>`;
      }

      let reactionMarkup = m.reaction ? `<div class="message-reaction-tag">${m.reaction}</div>` : "";

      // Only label the sender above a received bubble when it's a new
      // sender in the run — mirrors iMessage-style group thread grouping.
      const showSenderLabel = !isSent && sender && prevSenderId !== m.senderId;
      const senderLabelMarkup = showSenderLabel
        ? `<div class="group-sender-row"><div class="avatar-wrapper" style="width:20px; height:20px;"><div class="avatar-img">${sender.avatar}</div></div><span class="group-sender-name">${sender.fullName}</span></div>`
        : "";

      const attachmentMarkup = renderAttachmentMarkup(m);
      const hasAttachmentOnly = m.attachmentUrl && !m.content;

      html += `
        <div class="message-bubble-group reveal ${isSent ? 'sent' : 'received'}" data-msgid="${m.id}">
          ${senderLabelMarkup}
          ${replyMarkup}
          <div class="message-bubble ${hasAttachmentOnly ? 'attachment-only' : ''}">
            ${attachmentMarkup}
            ${m.content ? `<div class="message-text">${m.content}</div>` : ''}
            ${reactionMarkup}
          </div>
          <div class="message-meta">
            <span>${timeLabel}</span>
            ${m.edited ? '<span style="font-style:italic;">(edited)</span>' : ''}
          </div>
        </div>
      `;
      prevSenderId = m.senderId;
    }

    if (someoneTyping) {
      html += `
        <div class="typing-indicator-bubble" id="typing-bubble">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
    }

    const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
    viewport.innerHTML = html || `<div style="text-align:center; color:var(--text-muted); font-size:12px; margin-top:40px;">No messages yet. Say hello 👋</div>`;
    window.MotionSystem.refreshReveal(viewport);

    if (isAtBottom) {
      viewport.scrollTop = viewport.scrollHeight;
    }

  } catch (e) {
    console.error("Sync active group thread error:", e);
  }
}

// Refresh whichever thread (DM or group) is currently open
function refreshActiveThread() {
  return activeGroupId ? syncActiveGroupThread() : syncActiveThread();
}

// Send active message — works for both a 1:1 DM and a group thread,
// branching only on which id (activeChatUserId vs activeGroupId) is set.
// `attachment`, when provided, is { url, type, name } from
// DBAdapter.uploadAttachment() — lets a message carry a file/image with
// no text content at all.
async function sendChatMessage(attachment) {
  const input = document.getElementById("msg-input");
  const content = input.value.trim();
  if ((!content && !attachment) || (!activeChatUserId && !activeGroupId)) return;

  const newMsg = {
    id: "msg_" + Date.now(),
    senderId: currentUser.id,
    receiverId: activeGroupId ? null : activeChatUserId,
    groupId: activeGroupId || null,
    content,
    timestamp: Date.now(),
    status: "sent",
    reaction: null,
    edited: false,
    replyTo: activeReplyMessageId,
    attachmentUrl: attachment ? attachment.url : null,
    attachmentType: attachment ? attachment.type : null,
    attachmentName: attachment ? attachment.name : null,
    attachmentDuration: attachment ? (attachment.duration || null) : null
  };

  input.value = "";
  document.getElementById("msg-send-btn").style.display = "none";
  document.getElementById("chat-voice-btn").style.display = "flex";
  
  // Clear reply previews
  activeReplyMessageId = null;
  document.getElementById("active-reply-banner").style.display = "none";

  try {
    await DBAdapter.sendMessage(newMsg);
    playSynthSound("sent");
    if (activeGroupId) {
      DBAdapter.setGroupLastRead(activeGroupId, newMsg.timestamp);
    }
    await refreshActiveThread();
    loadConversationsList();

  } catch (e) {
    showAppleNotification("Failed to transmit", "Database channel is locked.");
  }
}

// Wires the paperclip button + hidden file input for whichever chat
// template (DM or group) is currently rendered. Uploads the chosen file
// via DBAdapter.uploadAttachment, then sends it as a message — with the
// typed text (if any) as the caption.
function bindAttachmentButton() {
  const attachBtn = document.getElementById("chat-attachment-btn");
  const fileInput = document.getElementById("chat-attachment-input");
  if (!attachBtn || !fileInput) return;

  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = ""; // reset so picking the same file twice still fires "change"
    if (!file) return;

    attachBtn.classList.add("attachment-uploading");
    attachBtn.style.pointerEvents = "none";

    try {
      const uploaded = await DBAdapter.uploadAttachment(file);
      await sendChatMessage(uploaded);
    } catch (e) {
      showAppleNotification("Attachment failed", e.message || "Could not upload that file.");
    } finally {
      attachBtn.classList.remove("attachment-uploading");
      attachBtn.style.pointerEvents = "";
    }
  });
}

// Wires the mic button for whichever chat template (DM or group) is
// currently rendered: first tap requests the microphone and starts a
// MediaRecorder; a second tap stops it, uploads the clip, and sends it
// as a voice-note message; the ✕ button stops and discards instead.
function bindVoiceButton() {
  const voiceBtn = document.getElementById("chat-voice-btn");
  const cancelBtn = document.getElementById("voice-cancel-btn");
  const timerEl = document.getElementById("voice-record-timer");
  const attachBtn = document.getElementById("chat-attachment-btn");
  const input = document.getElementById("msg-input");
  if (!voiceBtn) return;

  const iconMic = voiceBtn.querySelector(".icon-mic");
  const iconStop = voiceBtn.querySelector(".icon-stop");

  function setRecordingUI(active) {
    voiceBtn.classList.toggle("recording", active);
    if (iconMic) iconMic.style.display = active ? "none" : "";
    if (iconStop) iconStop.style.display = active ? "" : "none";
    if (cancelBtn) cancelBtn.style.display = active ? "flex" : "none";
    if (timerEl) timerEl.style.display = active ? "inline" : "none";
    if (attachBtn) attachBtn.style.display = active ? "none" : "flex";
    if (input) input.style.display = active ? "none" : "";
  }

  function startTimer() {
    voiceRecordStartTime = Date.now();
    if (timerEl) timerEl.textContent = "0:00";
    voiceRecordTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - voiceRecordStartTime) / 1000;
      if (timerEl) timerEl.textContent = formatDuration(elapsed);
    }, 250);
  }

  function stopTimer() {
    clearInterval(voiceRecordTimerInterval);
    voiceRecordTimerInterval = null;
  }

  function teardownStream() {
    if (voiceStream) {
      voiceStream.getTracks().forEach(track => track.stop());
      voiceStream = null;
    }
    voiceRecorder = null;
    isRecordingVoice = false;
    stopTimer();
    setRecordingUI(false);
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showAppleNotification("Microphone unavailable", "This browser doesn't support audio recording.");
      return;
    }
    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      showAppleNotification("Microphone blocked", "Allow microphone access to send voice messages.");
      return;
    }

    voiceChunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    voiceRecorder = mimeType ? new MediaRecorder(voiceStream, { mimeType }) : new MediaRecorder(voiceStream);

    voiceRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) voiceChunks.push(e.data);
    };

    // Discard flag lets the cancel button skip the upload/send in onstop
    // without needing a second code path.
    voiceRecorder._cancelled = false;

    voiceRecorder.onstop = async () => {
      const wasCancelled = voiceRecorder._cancelled;
      const durationSeconds = (Date.now() - voiceRecordStartTime) / 1000;
      teardownStream();
      if (wasCancelled || voiceChunks.length === 0) return;

      const blob = new Blob(voiceChunks, { type: voiceRecorder.mimeType || "audio/webm" });
      const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
      const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type });

      voiceBtn.style.pointerEvents = "none";
      voiceBtn.classList.add("attachment-uploading");
      try {
        const uploaded = await DBAdapter.uploadAttachment(file);
        uploaded.duration = durationSeconds;
        await sendChatMessage(uploaded);
      } catch (e) {
        showAppleNotification("Voice message failed", e.message || "Could not upload the recording.");
      } finally {
        voiceBtn.style.pointerEvents = "";
        voiceBtn.classList.remove("attachment-uploading");
      }
    };

    voiceRecorder.start();
    isRecordingVoice = true;
    setRecordingUI(true);
    startTimer();
  }

  voiceBtn.addEventListener("click", () => {
    if (!isRecordingVoice) {
      startRecording();
    } else if (voiceRecorder && voiceRecorder.state !== "inactive") {
      voiceRecorder.stop();
    }
  });

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (voiceRecorder && voiceRecorder.state !== "inactive") {
        voiceRecorder._cancelled = true;
        voiceRecorder.stop();
      }
    });
  }
}

// One-time setup for voice-note playback: a single shared <audio> element
// handles every voice bubble via event delegation, so only one voice
// message ever plays at once and re-rendered bubbles stay playable.
function setupVoicePlayback() {
  if (sharedVoicePlayer) return; // already wired (initMessengerPage can re-run)

  sharedVoicePlayer = new Audio();

  function resetButtonUI(btn) {
    if (!btn) return;
    const playIcon = btn.querySelector(".icon-play");
    const pauseIcon = btn.querySelector(".icon-pause");
    if (playIcon) playIcon.style.display = "";
    if (pauseIcon) pauseIcon.style.display = "none";
    const progress = btn.closest(".voice-message")?.querySelector(".voice-bars-progress");
    if (progress) progress.style.width = "0%";
  }

  sharedVoicePlayer.addEventListener("timeupdate", () => {
    if (!sharedVoicePlayerBtn || !sharedVoicePlayer.duration) return;
    const progress = sharedVoicePlayerBtn.closest(".voice-message")?.querySelector(".voice-bars-progress");
    if (progress) {
      const pct = (sharedVoicePlayer.currentTime / sharedVoicePlayer.duration) * 100;
      progress.style.width = `${pct}%`;
    }
  });

  sharedVoicePlayer.addEventListener("ended", () => {
    resetButtonUI(sharedVoicePlayerBtn);
    sharedVoicePlayerBtn = null;
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".voice-play-btn");
    if (!btn) return;
    const container = btn.closest(".voice-message");
    if (!container) return;
    const url = container.dataset.audioUrl;

    // Clicking the currently-playing bubble's button pauses it.
    if (sharedVoicePlayerBtn === btn && !sharedVoicePlayer.paused) {
      sharedVoicePlayer.pause();
      const playIcon = btn.querySelector(".icon-play");
      const pauseIcon = btn.querySelector(".icon-pause");
      if (playIcon) playIcon.style.display = "";
      if (pauseIcon) pauseIcon.style.display = "none";
      return;
    }

    // Switching to a different bubble — reset whichever one was playing.
    if (sharedVoicePlayerBtn && sharedVoicePlayerBtn !== btn) {
      resetButtonUI(sharedVoicePlayerBtn);
    }

    sharedVoicePlayerBtn = btn;
    if (sharedVoicePlayer.src !== url) {
      sharedVoicePlayer.src = url;
    }
    sharedVoicePlayer.play().catch(() => {
      showAppleNotification("Playback failed", "Couldn't play that voice message.");
    });
    const playIcon = btn.querySelector(".icon-play");
    const pauseIcon = btn.querySelector(".icon-pause");
    if (playIcon) playIcon.style.display = "none";
    if (pauseIcon) pauseIcon.style.display = "";
  });
}

// 4. SETUP CONTEXT MENUS & MESSAGES EDITING
function setupContextMenus() {
  document.addEventListener("contextmenu", (e) => {
    const bubble = e.target.closest(".message-bubble-group");
    if (!bubble) return;

    e.preventDefault();
    const msgId = bubble.getAttribute("data-msgid");
    renderCustomContextMenu(e.clientX, e.clientY, msgId);
  });

  // Touch equivalent: a long-press on a bubble opens the same menu.
  // Touch devices rarely fire a native "contextmenu" event on plain
  // divs, so without this, reply/react/edit/delete would be
  // unreachable on phones and tablets.
  let pressTimer = null;
  let pressStart = null;
  let suppressNextClick = false;

  document.addEventListener("touchstart", (e) => {
    const bubble = e.target.closest(".message-bubble-group");
    if (!bubble) return;
    const touch = e.touches[0];
    pressStart = { x: touch.clientX, y: touch.clientY };
    pressTimer = window.setTimeout(() => {
      pressTimer = null;
      suppressNextClick = true;
      const msgId = bubble.getAttribute("data-msgid");
      renderCustomContextMenu(touch.clientX, touch.clientY, msgId);
    }, 450);
  }, { passive: true });

  const cancelPress = (e) => {
    if (pressTimer === null) return;
    if (e && e.type === "touchmove" && pressStart) {
      const touch = e.touches[0];
      const moved = Math.abs(touch.clientX - pressStart.x) + Math.abs(touch.clientY - pressStart.y);
      if (moved < 10) return; // small jitter, still counts as a hold
    }
    window.clearTimeout(pressTimer);
    pressTimer = null;
  };
  document.addEventListener("touchmove", cancelPress, { passive: true });
  document.addEventListener("touchend", cancelPress, { passive: true });
  document.addEventListener("touchcancel", cancelPress, { passive: true });

  // Hide context menu on click elsewhere
  document.addEventListener("click", () => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    const menu = document.getElementById("message-context-menu");
    if (menu) menu.remove();
  });
}

async function renderCustomContextMenu(x, y, msgId) {
  const existing = document.getElementById("message-context-menu");
  if (existing) existing.remove();

  // Find message details
  const msgObj = await DBAdapter.getMessageById(msgId);
  if (!msgObj) return;

  const isSender = msgObj.senderId === currentUser.id;

  const menu = document.createElement("div");
  menu.id = "message-context-menu";
  menu.className = "custom-context-menu";
  
  // Position menu intelligently near cursor inside bounds
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 300)}px`;

  menu.innerHTML = `
    <!-- Emoji reactions panel -->
    <div class="reactions-panel">
      <span class="reaction-option" data-react="❤️">❤️</span>
      <span class="reaction-option" data-react="👍">👍</span>
      <span class="reaction-option" data-react="😂">😂</span>
      <span class="reaction-option" data-react="🔥">🔥</span>
      <span class="reaction-option" data-react="😭">😭</span>
    </div>
    <div class="menu-option" id="menu-reply-btn">
      <svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
      Reply
    </div>
    <div class="menu-option" id="menu-copy-btn">
      <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
      Copy
    </div>
    ${isSender ? `
      <div class="menu-option" id="menu-edit-btn">
        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        Edit Message
      </div>
      <div class="menu-option danger" id="menu-delete-btn">
        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        Delete
      </div>
    ` : ""}
  `;

  document.body.appendChild(menu);

  // Bind Context Menu Actions
  document.querySelectorAll(".reaction-option").forEach(opt => {
    opt.addEventListener("click", async () => {
      const emoji = opt.getAttribute("data-react");
      await DBAdapter.updateMessage(msgId, { reaction: emoji });
      refreshActiveThread();
    });
  });

  // Reply Binding
  document.getElementById("menu-reply-btn").addEventListener("click", () => {
    activeReplyMessageId = msgId;
    const banner = document.getElementById("active-reply-banner");
    const bannerText = document.getElementById("reply-banner-text");
    bannerText.innerText = msgObj.content;
    banner.style.display = "flex";
  });

  // Copy Binding
  document.getElementById("menu-copy-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(msgObj.content).then(() => {
      showAppleNotification("Copied", "Message successfully copied to clipboard.");
    });
  });

  // Edit/Delete triggers (only present if isSender is true)
  if (isSender) {
    document.getElementById("menu-edit-btn").addEventListener("click", () => {
      const newText = prompt("Edit your message:", msgObj.content);
      if (newText && newText.trim() !== msgObj.content) {
        DBAdapter.updateMessage(msgId, { content: newText.trim(), edited: true }).then(() => {
          refreshActiveThread();
        });
      }
    });

    document.getElementById("menu-delete-btn").addEventListener("click", () => {
      if (confirm("Are you sure you want to delete this message?")) {
        DBAdapter.deleteMessage(msgId).then(() => {
          refreshActiveThread();
        });
      }
    });
  }
}

// 5. PROFILE PAGE CONTROLLER
function initProfilePage() {
  const nameInput = document.getElementById("profile-fullname");
  const usernameInput = document.getElementById("profile-username");
  const useridInput = document.getElementById("profile-userid");
  const bioInput = document.getElementById("profile-bio");
  const statusInput = document.getElementById("profile-status");
  const avatarContainer = document.getElementById("profile-avatar-container");
  const fileInput = document.getElementById("avatar-file-input");

  if (!nameInput) return;

  // Populate data
  nameInput.value = currentUser.fullName;
  usernameInput.value = currentUser.username;
  useridInput.value = currentUser.id;
  bioInput.value = currentUser.bio || "";
  statusInput.value = currentUser.status || "Online";

  // Render initial avatar inside container
  avatarContainer.innerHTML = `${currentUser.avatar}<div class="profile-avatar-overlay">Upload Photo</div>`;

  // Avatar photo uploader trigger
  avatarContainer.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Convert file to Base64 image
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Img = event.target.result;
      const avatarHTML = `<img src="${base64Img}" class="avatar-img" style="border-radius:50%; width:100%; height:100%; object-fit:cover;">`;
      
      avatarContainer.innerHTML = `${avatarHTML}<div class="profile-avatar-overlay">Upload Photo</div>`;
      currentUser.avatar = avatarHTML;
    };
    reader.readAsDataURL(file);
  });

  // Profile Save Action
  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = nameInput.value.trim();
    const username = usernameInput.value.trim();
    const bio = bioInput.value.trim();
    const status = statusInput.value;

    const errorEl = document.getElementById("profile-error");
    errorEl.innerText = "";

    try {
      // Validate unique username constraints
      const duplicateUser = await DBAdapter.getUserByUsername(username);
      if (duplicateUser && duplicateUser.id !== currentUser.id) {
        errorEl.innerText = "Username is already taken by another profile.";
        return;
      }

      const updates = {
        fullName,
        username,
        bio,
        status,
        avatar: currentUser.avatar
      };

      await DBAdapter.updateUser(currentUser.id, updates);
      showAppleNotification("Profile Updated", "Your profile details have been successfully synced.");
      
      // Re-initialize nav to update avatar visuals
      renderFloatingNavigation();

    } catch (err) {
      errorEl.innerText = "Profile sync failed. Check database.";
    }
  });
}

// 6. SETTINGS PAGE CONTROLLER
function initSettingsPage() {
  const soundToggle = document.getElementById("settings-sounds");
  const alertToggle = document.getElementById("settings-alerts");
  const animationToggle = document.getElementById("settings-animations");
  const themeToggle = document.getElementById("settings-theme");
  const dbUrlInput = document.getElementById("settings-sb-url");
  const dbKeyInput = document.getElementById("settings-sb-key");
  const configForm = document.getElementById("settings-form");

  if (!soundToggle) return;

  const settings = DBAdapter.getSettings();

  // Populate form checks
  soundToggle.checked = settings.sounds;
  alertToggle.checked = settings.notifications;
  animationToggle.checked = settings.animations;
  dbUrlInput.value = settings.supabaseUrl || "";
  dbKeyInput.value = settings.supabaseKey || "";

  // Populate active theme switch
  const mode = localStorage.getItem("ios27_theme") || "dark";
  themeToggle.checked = mode === "light";

  // Liquid Glass transparency — live-updates on drag, no submit needed,
  // matching how the real Display & Brightness slider behaves.
  const glassSlider = document.getElementById("settings-glass-tint");
  const glassValueLabel = document.getElementById("glass-tint-value");
  const presetClearBtn = document.getElementById("glass-preset-clear");
  const presetTintedBtn = document.getElementById("glass-preset-tinted");

  function syncGlassPresetHighlight(tint) {
    presetClearBtn.classList.toggle("active", tint <= 0.05);
    presetTintedBtn.classList.toggle("active", tint >= 0.95);
  }

  function applyGlassTint(tint, { persist } = { persist: false }) {
    tint = Math.min(1, Math.max(0, tint));
    document.documentElement.style.setProperty("--tint-mix", tint);
    glassSlider.value = Math.round(tint * 100);
    glassValueLabel.textContent = `${Math.round(tint * 100)}%`;
    syncGlassPresetHighlight(tint);
    if (persist) {
      settings.glassTint = tint;
      DBAdapter.saveSettings(settings);
    }
  }

  const initialTint = typeof settings.glassTint === "number" ? settings.glassTint : 0.5;
  applyGlassTint(initialTint);

  glassSlider.addEventListener("input", () => {
    applyGlassTint(glassSlider.value / 100, { persist: true });
  });

  presetClearBtn.addEventListener("click", () => {
    applyGlassTint(0, { persist: true });
    showAppleNotification("Liquid Glass", "Switched to Clear.");
  });

  presetTintedBtn.addEventListener("click", () => {
    applyGlassTint(1, { persist: true });
    showAppleNotification("Liquid Glass", "Switched to Tinted.");
  });

  // Live-toggle Spring Animations — takes effect immediately, doesn't
  // require the Save Configurations submit.
  animationToggle.addEventListener("change", () => {
    settings.animations = animationToggle.checked;
    DBAdapter.saveSettings(settings);
    window.MotionSystem.setEnabled(settings.animations);
    showAppleNotification("Motion Updated", settings.animations ? "Spring animations enabled." : "Spring animations disabled.");
  });

  // Accent color dots highlighting
  const curAccent = settings.accentColor || "blue";
  document.querySelectorAll(".accent-color-dot").forEach(dot => {
    if (dot.getAttribute("data-color") === curAccent) {
      dot.classList.add("active");
    }
    
    // Bind click trigger
    dot.addEventListener("click", () => {
      document.querySelectorAll(".accent-color-dot").forEach(d => d.classList.remove("active"));
      dot.classList.add("active");
      
      const newAccent = dot.getAttribute("data-color");
      settings.accentColor = newAccent;
      DBAdapter.saveSettings(settings);
      showAppleNotification("Accent Changed", `Visual highlights set to ${newAccent}.`);
    });
  });

  // Settings Save Form Action
  configForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    settings.sounds = soundToggle.checked;
    settings.notifications = alertToggle.checked;
    settings.animations = animationToggle.checked;
    settings.supabaseUrl = dbUrlInput.value.trim();
    settings.supabaseKey = dbKeyInput.value.trim();

    DBAdapter.saveSettings(settings);
    window.MotionSystem.setEnabled(settings.animations);
    showAppleNotification("Settings Saved", "Your messaging preferences have been updated.");

    // Attempt database reconnection
    if (settings.supabaseUrl && settings.supabaseKey) {
      const connected = await DBAdapter.initSupabase(settings.supabaseUrl, settings.supabaseKey);
      if (connected) {
        showAppleNotification("Supabase Connected", "Switched connection to cloud backend.");
      } else {
        showAppleNotification("Connection Failed", "Defaulted database engine back to Local Storage.");
      }
    }
  });

  // Bind Theme switch
  themeToggle.addEventListener("change", () => {
    const isLight = themeToggle.checked;
    localStorage.setItem("ios27_theme", isLight ? "light" : "dark");
    DBAdapter.applySettings();
    showAppleNotification("Theme Mode Shifted", `Visual styling set to ${isLight ? 'Light Mode' : 'Dark Mode'}.`);
  });
}

// Window load pipeline initiation
window.addEventListener("DOMContentLoaded", initApp);
