
"use strict";

/* ==========================================
   STREAKX — Local-first habit tracker
   HTML + CSS + vanilla JavaScript
   ========================================== */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const STORAGE_KEY = "streakx_premium_v1";

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const dateKey = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseDate = key => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const uid = () =>
  window.crypto?.randomUUID?.() ||
  `h${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);

const DEFAULT_HABITS = [
  { id: "read", name: "Read 10 pages", category: "Mind", emoji: "📚", schedule: "daily", target: "10 pages" },
  { id: "water", name: "Drink enough water", category: "Health", emoji: "💧", schedule: "daily", target: "8 glasses" },
  { id: "move", name: "Move your body", category: "Health", emoji: "🏃", schedule: "daily", target: "20 minutes" },
  { id: "journal", name: "Write in your journal", category: "Wellness", emoji: "✍️", schedule: "daily", target: "5 minutes" }
];

const CHALLENGES = [
  {
    id: "reset7",
    name: "The 7-Day Reset",
    description: "Build a little momentum every day for one week.",
    duration: 7,
    reward: 150,
    emoji: "🌱",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80"
  },
  {
    id: "focus14",
    name: "Focus Mode",
    description: "Make space for focused work and intentional breaks.",
    duration: 14,
    reward: 300,
    emoji: "🎯",
    image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=700&q=80"
  },
  {
    id: "wellness30",
    name: "The Wellness Arc",
    description: "Create a consistent routine for your mind and body.",
    duration: 30,
    reward: 700,
    emoji: "✨",
    image: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=700&q=80"
  }
];

const ACHIEVEMENTS = [
  { id: "first", name: "First Step", description: "Complete your first habit.", emoji: "🌱", test: s => s.totalCompletions >= 1 },
  { id: "five", name: "Getting Started", description: "Complete five habits.", emoji: "⚡", test: s => s.totalCompletions >= 5 },
  { id: "twentyfive", name: "Momentum Maker", description: "Complete 25 habits.", emoji: "🚀", test: s => s.totalCompletions >= 25 },
  { id: "hundred", name: "Century Club", description: "Complete 100 habits.", emoji: "💯", test: s => s.totalCompletions >= 100 },
  { id: "streak3", name: "Three in a Row", description: "Build a three-day streak.", emoji: "🔥", test: s => s.bestStreak >= 3 },
  { id: "streak7", name: "One Week Strong", description: "Build a seven-day streak.", emoji: "🏆", test: s => s.bestStreak >= 7 },
  { id: "streak30", name: "Unstoppable", description: "Build a 30-day streak.", emoji: "👑", test: s => s.bestStreak >= 30 },
  { id: "planner", name: "The Architect", description: "Create five habits.", emoji: "🧠", test: s => s.habitsCreated >= 5 },
  { id: "perfect", name: "Perfect Day", description: "Complete every scheduled habit in a day.", emoji: "💎", test: s => s.perfectDay },
  { id: "level5", name: "Rising Star", description: "Reach level five.", emoji: "🌟", test: s => s.level >= 5 },
  { id: "early", name: "Challenge Accepted", description: "Join a challenge.", emoji: "🎯", test: s => s.challengesJoined >= 1 },
  { id: "all", name: "Collector", description: "Unlock five achievements.", emoji: "🎖️", test: s => s.unlockedCount >= 5 }
];

function freshState() {
  return {
    version: 1,
    profile: { name: "Alex", tagline: "Consistency is my superpower." },
    habits: DEFAULT_HABITS.map(h => ({ ...h })),
    logs: {},
    xp: 0,
    createdCount: DEFAULT_HABITS.length,
    challenges: {},
    claimedRewards: [],
    theme: "green",
    dailyGoal: 3,
    joinedAt: todayKey()
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();

    const saved = JSON.parse(raw);
    const defaults = freshState();

    if (!saved || !Array.isArray(saved.habits) || !saved.logs || typeof saved.logs !== "object") {
      return defaults;
    }

    return {
      ...defaults,
      ...saved,
      profile: { ...defaults.profile, ...(saved.profile || {}) },
      habits: saved.habits,
      logs: saved.logs,
      challenges: saved.challenges || {},
      claimedRewards: saved.claimedRewards || [],
      createdCount: Number.isFinite(saved.createdCount) ? saved.createdCount : saved.habits.length,
      xp: Number.isFinite(saved.xp) ? Math.max(0, saved.xp) : 0,
      dailyGoal: Math.min(30, Math.max(1, Number(saved.dailyGoal) || 3))
    };
  } catch (error) {
    console.error("Could not load STREAKX data:", error);
    return freshState();
  }
}

let state = loadState();
let selectedEmoji = "✦";
let editingId = null;
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDate = todayKey();
let toastTimers = [];

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Could not save STREAKX data:", error);
    showToast("Storage is full or unavailable. Export a backup if possible.");
    return false;
  }
}

function scheduledOn(habit, key) {
  const day = parseDate(key).getDay();
  if (habit.schedule === "weekdays") return day >= 1 && day <= 5;
  if (habit.schedule === "weekends") return day === 0 || day === 6;
  return true;
}

function logFor(key) {
  if (!state.logs[key] || typeof state.logs[key] !== "object") {
    state.logs[key] = {};
  }
  return state.logs[key];
}

function isDone(habitId, key = todayKey()) {
  return Boolean(state.logs[key]?.[habitId]);
}

function scheduledHabits(key) {
  return state.habits.filter(h => scheduledOn(h, key));
}

function completedCount(key) {
  return scheduledHabits(key).filter(h => isDone(h.id, key)).length;
}

function completionRate(key) {
  const habits = scheduledHabits(key);
  if (!habits.length) return 0;
  return Math.round(completedCount(key) / habits.length * 100);
}

function isPerfectDay(key) {
  const habits = scheduledHabits(key);
  return habits.length > 0 && habits.every(h => isDone(h.id, key));
}

function hasActivity(key) {
  return completedCount(key) > 0;
}

function dateOffset(key, amount) {
  const date = parseDate(key);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function currentStreak() {
  let cursor = todayKey();

  // A streak can remain active through the rest of today if yesterday
  // was the last active day.
  if (!hasActivity(cursor)) cursor = dateOffset(cursor, -1);

  let streak = 0;
  for (let i = 0; i < 4000; i++) {
    if (!hasActivity(cursor)) break;
    streak++;
    cursor = dateOffset(cursor, -1);
  }
  return streak;
}

function longestStreak() {
  const dates = Object.keys(state.logs)
    .filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key) && hasActivity(key))
    .sort();

  if (!dates.length) return 0;

  let best = 1;
  let run = 1;

  for (let i = 1; i < dates.length; i++) {
    if (dates[i] === dateOffset(dates[i - 1], 1)) {
      run++;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }

  return best;
}

function totalCompletions() {
  return Object.values(state.logs).reduce((sum, log) => {
    if (!log || typeof log !== "object") return sum;
    return sum + Object.values(log).filter(Boolean).length;
  }, 0);
}

function earnedXP() {
  return Math.max(0, Number(state.xp) || 0);
}

function levelInfo() {
  const xp = earnedXP();
  const level = Math.floor(xp / 100) + 1;
  const intoLevel = xp % 100;
  return { xp, level, intoLevel, next: 100 };
}

function statsSnapshot() {
  const total = totalCompletions();
  const best = longestStreak();
  const info = levelInfo();
  const perfect = Object.keys(state.logs).some(isPerfectDay);
  const snapshot = {
    totalCompletions: total,
    bestStreak: best,
    habitsCreated: state.createdCount,
    perfectDay: perfect,
    level: info.level,
    challengesJoined: Object.values(state.challenges).filter(c => c && c.joined).length,
    unlockedCount: 0
  };
  snapshot.unlockedCount = ACHIEVEMENTS.filter(a => a.test(snapshot)).length;
  return snapshot;
}

function unlocks() {
  const stats = statsSnapshot();
  return ACHIEVEMENTS.map(a => ({ ...a, unlocked: Boolean(a.test(stats)) }));
}

function showToast(message) {
  const region = $("#toastRegion");
  if (!region) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  region.appendChild(toast);

  const timer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 220);
  }, 3200);

  toastTimers.push(timer);
}

function updateTheme() {
  const theme = ["green", "purple", "blue"].includes(state.theme) ? state.theme : "green";
  document.documentElement.dataset.theme = theme;
  $$(".theme-option").forEach(button => {
    button.classList.toggle("selected", button.dataset.theme === theme);
  });
}

function niceDate(key, options = { weekday: "long", month: "long", day: "numeric" }) {
  return parseDate(key).toLocaleDateString(undefined, options);
}

function renderHeader() {
  const name = state.profile.name.trim() || "Alex";
  $("#avatarInitial").textContent = [...name][0]?.toUpperCase() || "A";
  $("#headerDate").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric"
  }).toUpperCase();
  $("#greetingTitle").innerHTML = `Build your <span>momentum.</span>`;
  $("#sideStreak").textContent = currentStreak();
  $("#sideProgress").style.width = `${completionRate(todayKey())}%`;
}

function renderHabits() {
  const key = todayKey();
  const habits = scheduledHabits(key);
  const list = $("#habitList");
  $("#habitCount").textContent = habits.length;

  if (!habits.length) {
    list.innerHTML = `<div class="empty-state"><strong>Your routine starts here.</strong>Add a habit and start building momentum.<br><button class="btn btn-primary" data-action="add" style="margin-top:14px">＋ Create a habit</button></div>`;
    return;
  }

  list.innerHTML = habits.map((habit, index) => {
    const done = isDone(habit.id, key);
    const streak = habitStreak(habit.id);
    const target = habit.target ? `<span>◎ ${escapeHTML(habit.target)}</span>` : "";
    return `
      <article class="habit-card ${done ? "done" : ""}" style="animation-delay:${index * 45}ms">
        <div class="habit-emoji">${escapeHTML(habit.emoji || "✦")}</div>
        <div class="habit-copy">
          <div class="habit-title-row">
            <span class="habit-title">${escapeHTML(habit.name)}</span>
            <span class="habit-category">${escapeHTML(habit.category || "Personal")}</span>
          </div>
          <div class="habit-meta">
            ${target}
            <span class="habit-streak">♨ ${streak} day${streak === 1 ? "" : "s"}</span>
            <span>${done ? "Completed today" : "In progress"}</span>
          </div>
        </div>
        <div class="habit-menu">
          <button type="button" data-action="edit" data-id="${escapeHTML(habit.id)}" aria-label="Edit ${escapeHTML(habit.name)}" title="Edit habit">⋯</button>
        </div>
        <button type="button" class="habit-check" data-action="toggle" data-id="${escapeHTML(habit.id)}" aria-label="${done ? "Undo" : "Complete"} ${escapeHTML(habit.name)}" aria-pressed="${done}">${done ? "✓" : "✓"}</button>
      </article>`;
  }).join("");
}

function habitStreak(habitId) {
  let cursor = todayKey();
  if (!state.logs[cursor]?.[habitId]) cursor = dateOffset(cursor, -1);
  let count = 0;

  for (let i = 0; i < 4000; i++) {
    if (!state.logs[cursor]?.[habitId]) break;
    count++;
    cursor = dateOffset(cursor, -1);
  }
  return count;
}

function renderHome() {
  const key = todayKey();
  const total = scheduledHabits(key).length;
  const done = completedCount(key);
  const rate = completionRate(key);
  const streak = currentStreak();
  const level = levelInfo();

  $("#heroStreak").textContent = streak;
  $("#heroPercent").textContent = `${rate}%`;
  $("#heroRing").style?.setProperty("--unused", rate);
  $(".hero-ring").style.background =
    `conic-gradient(var(--accent) ${rate * 3.6}deg, rgba(255,255,255,.15) ${rate * 3.6}deg)`;

  $("#dailyPercent").textContent = rate;
  $("#dailyProgress").style.width = `${rate}%`;
  $("#completedLabel").textContent = `${done} of ${total} habits`;
  $("#remainingLabel").textContent = total === 0
    ? "Add a habit to begin"
    : rate === 100 ? "Everything done!" : `${total - done} left today`;

  $("#xpValue").textContent = `${level.xp} XP`;
  $("#levelValue").textContent = `Level ${level.level}`;

  $("#streakMessage").textContent = streak >= 7
    ? "You're building something powerful. Keep going."
    : streak >= 3
      ? "You're finding your rhythm. Protect that momentum."
      : "Every completed habit is another step forward.";

  $("#dailyQuote").textContent = [
    "You don't need to be perfect. You just need to keep showing up.",
    "The person you become is built by what you repeat.",
    "Small steps still move you forward.",
    "Discipline is choosing what matters over what feels easy.",
    "Make today a vote for the person you want to become."
  ][parseDate(key).getDay()];

  renderHeader();
  renderHabits();
}

function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  $("#monthTitle").textContent = calendarMonth.toLocaleDateString(undefined, {
    month: "long", year: "numeric"
  });

  $("#calCurrent").textContent = currentStreak();
  $("#calLongest").textContent = longestStreak();
  $("#calCompleted").textContent = totalCompletions();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(day => {
    cells.push(`<div class="calendar-weekday">${day}</div>`);
  });

  for (let i = 0; i < firstDay; i++) {
    cells.push(`<div class="calendar-day empty"></div>`);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const count = completedCount(key);
    const total = scheduledHabits(key).length;
    const rate = total ? count / total : 0;
    const level = count === 0 ? 0 : rate >= 1 ? 3 : rate >= .5 ? 2 : 1;
    const classes = [
      "calendar-day",
      `level-${level}`,
      key === todayKey() ? "today" : "",
      key === selectedCalendarDate ? "selected" : ""
    ].filter(Boolean).join(" ");

    cells.push(`
      <button type="button" class="${classes}" data-date="${key}" aria-label="${niceDate(key)}, ${count} completed">
        <span class="day-number">${day}</span>
        <span class="day-dot"></span>
      </button>`);
  }

  $("#calendarGrid").innerHTML = cells.join("");
  renderSelectedDay();
}

function renderSelectedDay() {
  const key = selectedCalendarDate;
  $("#selectedDateTitle").textContent = niceDate(key);
  const habits = scheduledHabits(key);
  const done = completedCount(key);

  $("#selectedDateInfo").textContent = habits.length
    ? `${done} of ${habits.length} scheduled habits completed (${completionRate(key)}%).`
    : "No habits were scheduled for this day.";

  $("#selectedDayHabits").innerHTML = habits.length
    ? habits.map(h => `
      <div class="selected-habit">
        <span>${escapeHTML(h.emoji || "✦")}</span>
        <strong>${escapeHTML(h.name)}</strong>
        <span class="${isDone(h.id, key) ? "done-mark" : ""}">${isDone(h.id, key) ? "✓ Completed" : "Not completed"}</span>
      </div>`).join("")
    : `<div class="empty-state">No scheduled habits for this day.</div>`;
}

function renderInsights() {
  const total = totalCompletions();
  const activeDays = Object.keys(state.logs).filter(key => hasActivity(key));
  const average = activeDays.length
    ? Math.round(activeDays.reduce((sum, key) => sum + completionRate(key), 0) / activeDays.length)
    : 0;

  $("#insightTotal").textContent = total;
  $("#insightAverage").textContent = `${average}%`;
  $("#insightBest").textContent = `${longestStreak()} days`;

  const today = parseDate(todayKey());
  const lastSeven = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    lastSeven.push(dateKey(d));
  }

  const values = lastSeven.map(key => completedCount(key));
  const max = Math.max(1, ...values);
  $("#weeklyChart").innerHTML = lastSeven.map((key, i) => {
    const value = values[i];
    const height = value ? Math.max(5, value / max * 100) : 2;
    const label = parseDate(key).toLocaleDateString(undefined, { weekday: "short" });
    return `
      <div class="bar-column" title="${niceDate(key)}: ${value} completed">
        <span class="bar-value">${value}</span>
        <div class="bar-rail"><div class="bar-fill" style="height:${height}%"></div></div>
        <span class="bar-label">${label}</span>
      </div>`;
  }).join("");

  const sum = values.reduce((a, b) => a + b, 0);
  $("#weeklyTotal").textContent = `${sum} completion${sum === 1 ? "" : "s"}`;

  const ranking = state.habits.map(h => {
    let count = 0;
    for (const [key, log] of Object.entries(state.logs)) {
      if (log?.[h.id]) count++;
    }
    return { ...h, count };
  }).sort((a, b) => b.count - a.count);

  $("#habitRanking").innerHTML = ranking.length
    ? ranking.map(h => {
      const percent = total ? Math.round(h.count / total * 100) : 0;
      return `
        <div class="ranking-row">
          <div class="ranking-emoji">${escapeHTML(h.emoji || "✦")}</div>
          <div>
            <div class="ranking-title">${escapeHTML(h.name)}</div>
            <div class="ranking-sub">${h.count} completion${h.count === 1 ? "" : "s"} · ${escapeHTML(h.category || "Personal")}</div>
            <div class="ranking-bar"><span style="width:${percent}%"></span></div>
          </div>
          <div class="ranking-value">${h.count}</div>
        </div>`;
    }).join("")
    : `<div class="empty-state"><strong>Your insights will appear here.</strong>Create your first habit to get started.</div>`;
}

function renderChallenges() {
  $("#challengeGrid").innerHTML = CHALLENGES.map(challenge => {
    const progress = challengeProgress(challenge);
    const joined = Boolean(state.challenges[challenge.id]?.joined);
    const claimed = state.claimedRewards.includes(challenge.id);
    const complete = progress >= challenge.duration;

    return `
      <article class="challenge-card">
        <div class="challenge-cover" style="background-image:linear-gradient(0deg,rgba(5,10,5,.45),transparent),url('${challenge.image}')">
          <span>${challenge.duration}-DAY MISSION</span>
        </div>
        <div class="challenge-card-body">
          <h3>${challenge.emoji} ${escapeHTML(challenge.name)}</h3>
          <p>${escapeHTML(challenge.description)}</p>
          <div class="challenge-card-foot"><span>♜ ${challenge.reward} XP</span><span>${joined ? `${Math.min(progress, challenge.duration)}/${challenge.duration} days` : "Ready to start"}</span></div>
          <button class="btn ${joined ? "btn-outline" : "btn-primary"}" data-challenge="${challenge.id}">
            ${claimed ? "Reward claimed ✓" : complete ? "Claim reward ↗" : joined ? "Continue mission ↗" : "Start challenge ↗"}
          </button>
        </div>
      </article>`;
  }).join("");

  const active = CHALLENGES.filter(c => state.challenges[c.id]?.joined);
  $("#activeChallenges").innerHTML = active.length
    ? active.map(c => {
      const progress = Math.min(challengeProgress(c), c.duration);
      const pct = Math.round(progress / c.duration * 100);
      const claimed = state.claimedRewards.includes(c.id);
      return `
        <div class="mission-row">
          <div class="mission-icon">${c.emoji}</div>
          <div class="mission-copy">
            <strong>${escapeHTML(c.name)}</strong>
            <p>${progress} / ${c.duration} active days · ${pct}%</p>
            <div class="progress-track" style="margin-top:9px"><span style="width:${pct}%"></span></div>
          </div>
          <div class="mission-status">${claimed ? "✓ Claimed" : pct === 100 ? "Reward ready" : `${c.reward} XP`}</div>
        </div>`;
    }).join("")
    : `<div class="empty-state"><strong>No active missions yet.</strong>Choose a challenge above and start building momentum.</div>`;
}

function challengeProgress(challenge) {
  const joined = state.challenges[challenge.id];
  if (!joined?.joined) return 0;

  const start = joined.startDate;
  const end = todayKey();
  let count = 0;
  let cursor = start;

  for (let i = 0; i < challenge.duration && cursor <= end; i++) {
    if (hasActivity(cursor)) count++;
    cursor = dateOffset(cursor, 1);
  }
  return count;
}

function renderAchievements() {
  const items = unlocks();
  const unlocked = items.filter(a => a.unlocked).length;

  $("#badgeUnlocked").textContent = unlocked;
  $("#badgeTotal").textContent = items.length;
  $("#badgeProgress").style.width = `${unlocked / items.length * 100}%`;

  $("#achievementGrid").innerHTML = items.map(a => `
    <article class="achievement-card ${a.unlocked ? "unlocked" : ""}">
      <div class="achievement-art">${escapeHTML(a.emoji)}</div>
      <h3>${escapeHTML(a.name)}</h3>
      <p>${escapeHTML(a.description)}</p>
      <div class="achievement-status">${a.unlocked ? "✓ UNLOCKED" : "○ LOCKED"}</div>
    </article>`).join("");
}

function renderProfile() {
  const name = state.profile.name.trim() || "Alex";
  const level = levelInfo();

  $("#profileNameDisplay").textContent = name;
  $("#profileAvatar").textContent = [...name][0]?.toUpperCase() || "A";
  $("#profileTagline").textContent = state.profile.tagline || "Consistency is my superpower.";
  $("#nameInput").value = state.profile.name;
  $("#taglineInput").value = state.profile.tagline;
  $("#profileLevel").textContent = `Level ${level.level}`;
  $("#profileXPBar").style.width = `${level.intoLevel}%`;
  $("#profileXPText").textContent = `${level.intoLevel} / 100 XP to next level`;
  $("#profileStreak").textContent = currentStreak();
  $("#profileTotal").textContent = totalCompletions();
  $("#profileBadges").textContent = unlocks().filter(a => a.unlocked).length;
}

function renderAll() {
  updateTheme();
  renderHome();
  renderCalendar();
  renderInsights();
  renderChallenges();
  renderAchievements();
  renderProfile();
}

const PAGE_TITLES = {
  today: "Overview",
  calendar: "Streak calendar",
  insights: "Insights",
  challenges: "Challenges",
  achievements: "Achievements",
  profile: "My profile",
  settings: "Settings"
};

function goToPage(page) {
  if (!PAGE_TITLES[page]) page = "today";

  $$(".page").forEach(section => {
    section.classList.toggle("active", section.id === `page-${page}`);
  });

  $$(".nav-item[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("#breadcrumbTitle").textContent = PAGE_TITLES[page];

  if (page === "calendar") renderCalendar();
  if (page === "insights") renderInsights();
  if (page === "challenges") renderChallenges();
  if (page === "achievements") renderAchievements();
  if (page === "profile") renderProfile();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openHabitModal(habit = null) {
  editingId = habit?.id || null;
  $("#modalTitle").textContent = habit ? "Edit your habit" : "Create a habit";
  $("#saveHabitButton").textContent = habit ? "Save changes ↗" : "Save habit ↗";
  $("#habitId").value = habit?.id || "";
  $("#habitName").value = habit?.name || "";
  $("#habitCategory").value = habit?.category || "Mind";
  $("#habitSchedule").value = habit?.schedule || "daily";
  $("#habitTarget").value = habit?.target || "";
  selectedEmoji = habit?.emoji || "✦";

  $$(".emoji-option").forEach(button => {
    button.classList.toggle("selected", button.dataset.emoji === selectedEmoji);
  });

  $("#habitModal").classList.add("open");
  $("#habitModal").setAttribute("aria-hidden", "false");
  setTimeout(() => $("#habitName").focus(), 50);
}

function closeHabitModal() {
  $("#habitModal").classList.remove("open");
  $("#habitModal").setAttribute("aria-hidden", "true");
  editingId = null;
}

function addOrEditHabit(event) {
  event.preventDefault();

  const name = $("#habitName").value.trim();
  if (!name) {
    showToast("Give your habit a name first.");
    $("#habitName").focus();
    return;
  }

  const existing = editingId
    ? state.habits.find(h => h.id === editingId)
    : null;

  const habit = {
    id: editingId || uid(),
    name,
    category: $("#habitCategory").value,
    emoji: selectedEmoji,
    schedule: $("#habitSchedule").value,
    target: $("#habitTarget").value.trim()
  };

  if (existing) {
    Object.assign(existing, habit);
    showToast("Habit updated successfully.");
  } else {
    state.habits.push(habit);
    state.createdCount++;
    showToast("New habit added. Let's build momentum!");
  }

  saveState();
  closeHabitModal();
  renderAll();
}

function toggleHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  const key = todayKey();
  const log = logFor(key);
  const wasDone = Boolean(log[id]);

  if (wasDone) {
    delete log[id];
    state.xp = Math.max(0, state.xp - 10);
    showToast("Habit unchecked. You can complete it again anytime.");
  } else {
    log[id] = true;
    state.xp += 10;
    showToast(`Nice work! +10 XP for ${habit.name}.`);
    celebrateIfNeeded();
  }

  if (!Object.keys(log).length) delete state.logs[key];

  saveState();
  renderAll();
}

function celebrateIfNeeded() {
  const key = todayKey();
  if (isPerfectDay(key)) {
    showToast("🔥 Perfect day! Every scheduled habit is complete.");
  }
}

function deleteHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  const confirmed = window.confirm(`Delete "${habit.name}"? Its history for this habit will also be removed.`);
  if (!confirmed) return;

  state.habits = state.habits.filter(h => h.id !== id);

  for (const key of Object.keys(state.logs)) {
    if (state.logs[key] && id in state.logs[key]) {
      delete state.logs[key][id];
      if (!Object.keys(state.logs[key]).length) delete state.logs[key];
    }
  }

  saveState();
  renderAll();
  showToast("Habit deleted.");
}

function joinOrClaimChallenge(id) {
  const challenge = CHALLENGES.find(c => c.id === id);
  if (!challenge) return;

  if (!state.challenges[id]?.joined) {
    state.challenges[id] = { joined: true, startDate: todayKey() };
    saveState();
    renderAll();
    showToast(`${challenge.name} started. Your mission begins today!`);
    return;
  }

  const progress = challengeProgress(challenge);
  if (progress < challenge.duration) {
    showToast(`Keep going! ${progress} of ${challenge.duration} active days completed.`);
    return;
  }

  if (state.claimedRewards.includes(id)) {
    showToast("You've already claimed this reward.");
    return;
  }

  state.claimedRewards.push(id);
  state.xp += challenge.reward;
  saveState();
  renderAll();
  showToast(`Challenge completed! +${challenge.reward} XP earned.`);
}

function exportBackup() {
  const payload = {
    app: "STREAKX",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `streakx-backup-${todayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Your backup has been exported.");
}

function importBackup(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const incoming = parsed?.data || parsed;

      if (!incoming || !Array.isArray(incoming.habits) ||
          !incoming.logs || typeof incoming.logs !== "object" ||
          !incoming.profile) {
        throw new Error("Invalid backup");
      }

      const validHabits = incoming.habits.every(h =>
        h && typeof h.id === "string" && typeof h.name === "string"
      );
      if (!validHabits) throw new Error("Invalid habit data");

      const confirmed = window.confirm("Import this backup and replace your current STREAKX data?");
      if (!confirmed) return;

      state = {
        ...freshState(),
        ...incoming,
        profile: { ...freshState().profile, ...incoming.profile },
        habits: incoming.habits,
        logs: incoming.logs,
        challenges: incoming.challenges || {},
        claimedRewards: Array.isArray(incoming.claimedRewards) ? incoming.claimedRewards : []
      };

      saveState();
      renderAll();
      showToast("Backup imported successfully.");
    } catch (error) {
      console.error(error);
      showToast("That file isn't a valid STREAKX backup.");
    } finally {
      $("#importFile").value = "";
    }
  };

  reader.onerror = () => showToast("Could not read the selected file.");
  reader.readAsText(file);
}

/* ==========================================
   Event handlers
   ========================================== */

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-page]");
  if (nav) {
    event.preventDefault();
    goToPage(nav.dataset.page);
    return;
  }

  const action = event.target.closest("[data-action]");
  if (action) {
    const id = action.dataset.id;
    if (action.dataset.action === "add") openHabitModal();
    if (action.dataset.action === "toggle") toggleHabit(id);
    if (action.dataset.action === "edit") {
      const habit = state.habits.find(h => h.id === id);
      if (!habit) return;

      // Use a compact native menu for edit/delete to keep habit rows clean.
      const choice = window.prompt(
        `Manage "${habit.name}"\nType EDIT to change it or DELETE to remove it.`,
        "EDIT"
      );

      if (choice?.trim().toUpperCase() === "EDIT") openHabitModal(habit);
      if (choice?.trim().toUpperCase() === "DELETE") deleteHabit(id);
    }
    return;
  }

  const dateButton = event.target.closest("[data-date]");
  if (dateButton) {
    selectedCalendarDate = dateButton.dataset.date;
    renderCalendar();
    return;
  }

  const challengeButton = event.target.closest("[data-challenge]");
  if (challengeButton) {
    joinOrClaimChallenge(challengeButton.dataset.challenge);
  }
});

$("#openAddHabit").addEventListener("click", () => openHabitModal());
$("#closeModal").addEventListener("click", closeHabitModal);
$("#cancelModal").addEventListener("click", closeHabitModal);
$("#habitForm").addEventListener("submit", addOrEditHabit);

$("#habitModal").addEventListener("click", event => {
  if (event.target === $("#habitModal")) closeHabitModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeHabitModal();
});

$("#emojiPicker").addEventListener("click", event => {
  const button = event.target.closest("[data-emoji]");
  if (!button) return;
  selectedEmoji = button.dataset.emoji;
  $$(".emoji-option").forEach(item => {
    item.classList.toggle("selected", item === button);
  });
});

$("#prevMonth").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});

$("#nextMonth").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});

$("#todayMonth").addEventListener("click", () => {
  calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  selectedCalendarDate = todayKey();
  renderCalendar();
});

$("#joinFeatured").addEventListener("click", () => joinOrClaimChallenge("reset7"));

$("#saveProfile").addEventListener("click", () => {
  const name = $("#nameInput").value.trim();
  const tagline = $("#taglineInput").value.trim();

  if (!name) {
    showToast("Please enter a display name.");
    $("#nameInput").focus();
    return;
  }

  state.profile.name = name;
  state.profile.tagline = tagline || "Consistency is my superpower.";
  saveState();
  renderAll();
  showToast("Your profile has been saved.");
});

$("#exportData").addEventListener("click", exportBackup);
$("#importData").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", event => importBackup(event.target.files[0]));

$$(".theme-option").forEach(button => {
  button.addEventListener("click", () => {
    state.theme = button.dataset.theme;
    saveState();
    updateTheme();
    showToast(`${button.textContent.trim()} theme applied.`);
  });
});

$("#saveGoal").addEventListener("click", () => {
  const value = Number($("#goalInput").value);
  if (!Number.isInteger(value) || value < 1 || value > 30) {
    showToast("Choose a daily target between 1 and 30.");
    return;
  }

  state.dailyGoal = value;
  saveState();
  showToast(`Daily target set to ${value} habits.`);
});

$("#goalInput").value = state.dailyGoal;

$("#resetData").addEventListener("click", () => {
  const confirmed = window.confirm(
    "Reset all STREAKX data, including habits, XP and history? Export a backup first if you want to keep your progress."
  );
  if (!confirmed) return;

  state = freshState();
  calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  selectedCalendarDate = todayKey();
  saveState();
  $("#goalInput").value = state.dailyGoal;
  renderAll();
  goToPage("today");
  showToast("STREAKX has been reset.");
});

/* ==========================================
   Start application
   ========================================== */

function init() {
  updateTheme();
  renderAll();

  // Recalculate date-sensitive views if the app stays open overnight.
  let lastDate = todayKey();
  setInterval(() => {
    const current = todayKey();
    if (current !== lastDate) {
      lastDate = current;
      renderAll();
    }
  }, 60000);
}

init();
