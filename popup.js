import {
  parseTimeString,
  splitInputs,
  defaultDaysForRepeat,
  computeNextOccurrence
} from "./time.js";

const STORAGE_KEY = "alarms";

const timeInput = document.getElementById("timeInput");
const advanceEnabled = document.getElementById("advanceEnabled");
const advanceMinutes = document.getElementById("advanceMinutes");
const advanceSeconds = document.getElementById("advanceSeconds");
const addError = document.getElementById("addError");
const listEl = document.getElementById("list");
const template = document.getElementById("itemTemplate");
const refreshBtn = document.getElementById("refreshBtn");
const usageBtn = document.getElementById("usageBtn");
const usageTooltip = document.getElementById("usageTooltip");
const quickList = document.getElementById("quickList");
const quickAddBtn = document.getElementById("quickAddBtn");
const quickHint = document.getElementById("quickHint");
const toast = document.getElementById("toast");
const alarmBanner = document.getElementById("alarmBanner");
const alarmCountdown = document.getElementById("alarmCountdown");
const alarmNow = document.getElementById("alarmNow");
const alarmTitleText = document.getElementById("alarmTitleText");
const alarmStopBtn = document.getElementById("alarmStopBtn");
const durationInput = document.getElementById("durationInput");
const intervalInput = document.getElementById("intervalInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsHint = document.getElementById("settingsHint");
let liveTimer = null;
let alarmTimer = null;
let toastTimer = null;
const ACTIVE_KEY = "alarmActive";
const SETTINGS_KEY = "alarmSettings";
const QUICK_KEY = "quickPhrases";
const QUICK_VERSION_KEY = "quickPhrasesVersion";
const QUICK_VERSION = 2;
const ADVANCE_KEY = "advanceReserveSettings";

refreshBtn.addEventListener("click", () => loadAndRender());
timeInput.focus();

timeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    onAdd();
  }
});

usageBtn.addEventListener("click", () => {
  usageTooltip.hidden = !usageTooltip.hidden;
});

document.addEventListener("click", (event) => {
  if (usageTooltip.hidden) return;
  if (usageBtn.contains(event.target) || usageTooltip.contains(event.target)) return;
  usageTooltip.hidden = true;
});

quickAddBtn.addEventListener("click", async () => {
  const raw = timeInput.value.trim();
  if (!raw) {
    quickHint.textContent = "등록할 문구를 입력해주세요.";
    return;
  }
  const parts = splitInputs(raw);
  if (!parts.length) {
    quickHint.textContent = "등록할 문구를 입력해주세요.";
    return;
  }
  const phrases = await loadQuickPhrases();
  for (const part of parts) {
    if (!phrases.includes(part)) {
      phrases.push(part);
    }
  }
  await saveQuickPhrases(phrases);
  renderQuickPhrases(phrases);
  quickHint.textContent = "";
});

advanceEnabled.addEventListener("change", async () => {
  syncAdvanceInputsState();
  await saveAdvanceSettings();
});

advanceMinutes.addEventListener("change", async () => {
  advanceMinutes.value = normalizeAdvanceValue(advanceMinutes.value, 0, 180);
  await saveAdvanceSettings();
});

advanceSeconds.addEventListener("change", async () => {
  advanceSeconds.value = normalizeAdvanceValue(advanceSeconds.value, 0, 59);
  await saveAdvanceSettings();
});

loadAndRender();
loadAlarmBanner();
loadSettings();
loadAdvanceSettings();
loadQuickPhrases().then(renderQuickPhrases);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[ACTIVE_KEY]) {
    loadAlarmBanner();
  }
});

async function loadAndRender() {
  const items = await loadItems();
  await rescheduleLocal(items);
  const refreshed = await loadItems();
  render(refreshed);
}

async function onAdd() {
  addError.hidden = true;
  const raw = timeInput.value;
  const inputs = splitInputs(raw);
  if (inputs.length === 0) {
    addError.textContent = "시간을 입력해주세요.";
    addError.hidden = false;
    return;
  }

  await addFromInputs(inputs);
}

function render(items) {
  listEl.innerHTML = "";
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "등록된 알람이 없습니다.";
    listEl.appendChild(empty);
    return;
  }

  const now = Date.now();
  const sortedItems = [...items].sort((a, b) => {
    const aEnabled = a.enabled !== false;
    const bEnabled = b.enabled !== false;
    if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;
    const aNext = typeof a.nextAt === "number" ? a.nextAt : Number.POSITIVE_INFINITY;
    const bNext = typeof b.nextAt === "number" ? b.nextAt : Number.POSITIVE_INFINITY;
    const aRemain = aNext - now;
    const bRemain = bNext - now;
    return aRemain - bRemain;
  });

  for (const item of sortedItems) {
    const node = template.content.cloneNode(true);
    const root = node.querySelector(".item");
    const timeEl = node.querySelector(".time");
    const messageEl = node.querySelector(".message");
    const repeatEl = node.querySelector(".repeat");
    const enabledEl = node.querySelector(".enabled");
    const daysEl = node.querySelector(".days");
    const nextEl = node.querySelector(".next");
    const errorEl = node.querySelector(".error");
    const saveBtn = node.querySelector(".save");
    const deleteBtn = node.querySelector(".delete");

    timeEl.value = formatTime(item.hour, item.minute, item.second, item.hasSeconds);
    messageEl.value = item.message || "";
    repeatEl.value = item.repeat || "once";
    enabledEl.checked = item.enabled !== false;

    setupDays(daysEl, item);
    toggleDaysVisibility(daysEl, repeatEl.value);

    nextEl.textContent = formatNextAt(item);

    repeatEl.addEventListener("change", () => {
      toggleDaysVisibility(daysEl, repeatEl.value);
      if (repeatEl.value !== "custom") {
        setDaysFromRepeat(daysEl, repeatEl.value);
      }
    });

    saveBtn.addEventListener("click", async () => {
      errorEl.hidden = true;
      const parsed = parseTimeString(timeEl.value, new Date());
      if (!parsed) {
        errorEl.textContent = "시간 형식을 확인해주세요.";
        errorEl.hidden = false;
        return;
      }
      if (isDuplicateAlarm(items, parsed, item.id)) {
        errorEl.textContent = "이미 등록된 시간입니다.";
        errorEl.hidden = false;
        return;
      }

      item.raw = parsed.normalized;
      item.hour = parsed.hour;
      item.minute = parsed.minute;
      item.message = messageEl.value.trim() || "알람";
      item.repeat = repeatEl.value;
      item.enabled = enabledEl.checked;
      item.days = readDays(daysEl);
      item.oneOffAt = parsed.absoluteAt ?? null;
      item.second = parsed.second ?? 0;
      item.hasSeconds = parsed.hasSeconds ?? false;
      item.isRelativeInput = parsed.isRelative === true;

      if (parsed.absoluteAt) {
        item.repeat = "once";
      }

      if (item.repeat !== "custom") {
        item.days = defaultDaysForRepeat(item.repeat);
      }

      try {
        await rescheduleLocal(items);
        const stored = await loadItems();
        if (!await verifyStoredItems(stored, [{ id: item.id, title: item.message || "알람" }])) {
          errorEl.textContent = "저장 실패: 변경사항이 저장되지 않았습니다.";
          errorEl.hidden = false;
          return;
        }
        await loadAndRender();
      } catch (err) {
        errorEl.textContent = "저장 실패: 변경사항을 저장하지 못했습니다.";
        errorEl.hidden = false;
      }
    });

    deleteBtn.addEventListener("click", async () => {
      const index = items.findIndex((entry) => entry.id === item.id);
      if (index >= 0) items.splice(index, 1);
      await rescheduleLocal(items);
      await loadAndRender();
    });

    listEl.appendChild(root);
    root.dataset.id = item.id;
  }

  liveTimer = setInterval(() => {
    updateRemaining(sortedItems);
  }, 1000);
  updateRemaining(sortedItems);
}

async function loadAlarmBanner() {
  const result = await chrome.storage.local.get(ACTIVE_KEY);
  const active = result[ACTIVE_KEY];
  if (!active || !active.endsAt) {
    alarmBanner.hidden = true;
    if (alarmTimer) {
      clearInterval(alarmTimer);
      alarmTimer = null;
    }
    return;
  }

  alarmBanner.hidden = false;
  alarmTitleText.textContent = active.title || "알람 울림 중";
  updateAlarmCountdown(active.endsAt);
  if (alarmTimer) clearInterval(alarmTimer);
  alarmTimer = setInterval(() => updateAlarmCountdown(active.endsAt), 1000);
}

function updateAlarmCountdown(endsAt) {
  const remaining = Math.max(0, endsAt - Date.now());
  const totalSec = Math.ceil(remaining / 1000);
  alarmCountdown.textContent = `자동 종료까지 ${totalSec}초`;
  alarmNow.textContent = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

alarmStopBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "stopAlarm" });
  await loadAlarmBanner();
  window.close();
});

saveSettingsBtn.addEventListener("click", async () => {
  const durationSec = Number(durationInput.value);
  const intervalSec = Number(intervalInput.value);
  if (!Number.isFinite(durationSec) || durationSec < 5 || durationSec > 900) {
    settingsHint.textContent = "지속 시간은 5~900초 사이로 입력해주세요.";
    return;
  }
  if (!Number.isFinite(intervalSec) || intervalSec < 1 || intervalSec > 30) {
    settingsHint.textContent = "소리 간격은 1~30초 사이로 입력해주세요.";
    return;
  }
  await chrome.storage.local.set({
    [SETTINGS_KEY]: {
      durationMs: Math.round(durationSec * 1000),
      intervalMs: Math.round(intervalSec * 1000)
    }
  });
  settingsHint.textContent = "설정이 저장되었습니다.";
});

async function loadSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = result[SETTINGS_KEY] || {};
  const durationMs = typeof settings.durationMs === "number" ? settings.durationMs : 60000;
  const intervalMs = typeof settings.intervalMs === "number" ? settings.intervalMs : 2500;
  durationInput.value = Math.round(durationMs / 1000);
  intervalInput.value = Math.round(intervalMs / 1000);
  settingsHint.textContent = "현재 설정값을 반영했습니다.";
}

function setupDays(daysEl, item) {
  const selected = new Set(item.days || []);
  for (const input of daysEl.querySelectorAll("input[type=checkbox]")) {
    input.checked = selected.has(Number(input.value));
  }
}

function toggleDaysVisibility(daysEl, repeat) {
  const visible = repeat === "custom";
  daysEl.hidden = !visible;
}

function setDaysFromRepeat(daysEl, repeat) {
  const defaults = defaultDaysForRepeat(repeat);
  for (const input of daysEl.querySelectorAll("input[type=checkbox]")) {
    input.checked = defaults.includes(Number(input.value));
  }
}

function readDays(daysEl) {
  const days = [];
  for (const input of daysEl.querySelectorAll("input[type=checkbox]")) {
    if (input.checked) days.push(Number(input.value));
  }
  return days;
}

function formatNextAt(item) {
  if (!item.enabled) return "비활성";
  if (!item.nextAt) return "다음 알람 없음";
  const next = new Date(item.nextAt);
  const date = next.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const time = next.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: shouldDisplaySeconds(item) ? "2-digit" : undefined,
    hour12: false
  });
  return `${date} ${time}`;
}

function updateRemaining(items) {
  const now = Date.now();
  for (const item of items) {
    const root = listEl.querySelector(`.item[data-id="${item.id}"]`);
    if (!root) continue;
    const nextEl = root.querySelector(".next");
    if (!nextEl) continue;

    if (!item.enabled) {
      nextEl.textContent = "비활성";
      continue;
    }
    if (!item.nextAt) {
      nextEl.textContent = "다음 알람 없음";
      continue;
    }

    const diffMs = item.nextAt - now;
    if (diffMs <= 0) {
      nextEl.textContent = "곧 알람";
      continue;
    }

    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    let remain = "";
    if (hours > 0) {
      remain = `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      remain = `${minutes}분 ${seconds}초`;
    } else {
      remain = `${seconds}초`;
    }

    nextEl.textContent = `${formatNextAt(item)} · ${remain} 남음`;
  }
}

function formatTime(hour, minute, second = 0, hasSeconds = false) {
  const base = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  if (hasSeconds) {
    return `${base}:${String(second).padStart(2, "0")}`;
  }
  return base;
}

async function loadItems() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const items = result[STORAGE_KEY];
  if (Array.isArray(items)) return items;
  return [];
}

async function saveItems(items) {
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

async function rescheduleLocal(items) {
  await chrome.alarms.clearAll();
  const now = new Date();
  for (const item of items) {
    const next = computeNextOccurrence(item, now);
    item.nextAt = next ? next.getTime() : null;
    if (item.nextAt) {
      chrome.alarms.create(`alarm:${item.id}`, { when: item.nextAt });
    } else if (item.enabled !== false && item.oneOffAt) {
      item.enabled = false;
      item.oneOffAt = null;
    }
  }
  await saveItems(items);
}

async function addFromInputs(inputs) {
  const items = await loadItems();
  const advanceConfig = getAdvanceConfigFromInputs();
  const invalid = [];
  const duplicates = [];
  let addedCount = 0;
  const addedMeta = [];

  for (const entry of inputs) {
    const { parsed, title } = parseEntryWithTitle(entry);
    if (!parsed) {
      invalid.push(entry);
      continue;
    }

    if (isDuplicateAlarm(items, parsed)) {
      duplicates.push(entry);
      continue;
    }

    const shouldApplyAdvance = !parsed.isRelative && advanceConfig.enabled && advanceConfig.totalSeconds > 0;

    items.push({
      id: crypto.randomUUID(),
      raw: entry,
      hour: parsed.hour,
      minute: parsed.minute,
      second: parsed.second ?? 0,
      hasSeconds: parsed.hasSeconds ?? false,
      message: title || "알람",
      repeat: "once",
      days: [],
      enabled: true,
      oneOffAt: parsed.absoluteAt ?? null,
      leadEnabled: shouldApplyAdvance,
      leadSeconds: shouldApplyAdvance ? advanceConfig.totalSeconds : 0,
      isRelativeInput: parsed.isRelative === true,
      nextAt: null,
      lastFired: null,
      createdAt: Date.now()
    });
    addedMeta.push({ id: items[items.length - 1].id, title: title || "알람" });
    addedCount += 1;
  }

  if (invalid.length) {
    addError.textContent = `인식할 수 없는 입력: ${invalid.join(", ")}`;
    addError.hidden = false;
  }
  if (duplicates.length) {
    addError.textContent = `이미 등록된 시간: ${duplicates.join(", ")}`;
    addError.hidden = false;
  }

  timeInput.value = "";
  try {
    await rescheduleLocal(items);
    const stored = await loadItems();
    if (!await verifyStoredItems(stored, addedMeta)) {
      addError.textContent = "저장 실패: 일부 알람이 저장되지 않았습니다.";
      addError.hidden = false;
      showToast("저장 실패");
      return;
    }
    await loadAndRender();
  } catch (err) {
    addError.textContent = "저장 실패: 알람을 저장하지 못했습니다.";
    addError.hidden = false;
    showToast("저장 실패");
    return;
  }
  if (addedCount > 0) {
    showToast(`알람 ${addedCount}개 등록됨`);
  }
}

function parseEntryWithTitle(entry) {
  const tokens = entry.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { parsed: null, title: "" };
  for (let i = tokens.length; i >= 1; i -= 1) {
    const prefix = tokens.slice(0, i).join(" ");
    const parsed = parseTimeString(prefix, new Date());
    if (parsed) {
      const title = tokens.slice(i).join(" ").trim();
      return { parsed, title };
    }
  }
  return { parsed: null, title: "" };
}

function isDuplicateAlarm(items, parsed, excludeId = null) {
  return items.some((item) => {
    if (excludeId && item.id === excludeId) return false;
    const itemOneOff = typeof item.oneOffAt === "number" ? item.oneOffAt : null;
    const parsedOneOff = typeof parsed.absoluteAt === "number" ? parsed.absoluteAt : null;
    if (itemOneOff || parsedOneOff) {
      return itemOneOff !== null && parsedOneOff !== null && itemOneOff === parsedOneOff;
    }
    const itemSec = typeof item.second === "number" ? item.second : 0;
    const parsedSec = typeof parsed.second === "number" ? parsed.second : 0;
    return item.hour === parsed.hour && item.minute === parsed.minute && itemSec === parsedSec;
  });
}

async function verifyStoredItems(stored, metas) {
  if (!metas.length) return true;
  const targetIds = metas.map((meta) => meta?.id).filter(Boolean);
  if (!targetIds.length) return true;

  // Retry to absorb eventual consistency or overlapping storage writes.
  const maxRetries = 6;
  const retryDelay = 80; // ms

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      stored = await loadItems();
    }

    const storedIds = new Set(stored.map((item) => item?.id).filter(Boolean));
    const allFound = targetIds.every((id) => storedIds.has(id));
    if (allFound) return true;
  }

  return false;
}

async function loadAdvanceSettings() {
  const result = await chrome.storage.local.get(ADVANCE_KEY);
  const raw = result[ADVANCE_KEY] || {};
  const enabled = raw.enabled === true;
  advanceEnabled.checked = enabled;
  advanceMinutes.value = normalizeAdvanceValue(raw.minutes ?? 0, 0, 180);
  advanceSeconds.value = normalizeAdvanceValue(raw.seconds ?? 0, 0, 59);
  syncAdvanceInputsState();
}

async function saveAdvanceSettings() {
  await chrome.storage.local.set({
    [ADVANCE_KEY]: {
      enabled: advanceEnabled.checked,
      minutes: Number(advanceMinutes.value) || 0,
      seconds: Number(advanceSeconds.value) || 0
    }
  });
}

function syncAdvanceInputsState() {
  const enabled = advanceEnabled.checked;
  advanceMinutes.disabled = !enabled;
  advanceSeconds.disabled = !enabled;
}

function normalizeAdvanceValue(value, min, max) {
  let n = Number(value);
  if (!Number.isFinite(n)) n = min;
  n = Math.floor(n);
  if (n < min) n = min;
  if (n > max) n = max;
  return String(n);
}

function getAdvanceConfigFromInputs() {
  const minutes = Number(advanceMinutes.value) || 0;
  const seconds = Number(advanceSeconds.value) || 0;
  return {
    enabled: advanceEnabled.checked,
    totalSeconds: Math.max(0, minutes * 60 + seconds)
  };
}

function shouldDisplaySeconds(item) {
  if (item?.hasSeconds) return true;
  if (item?.isRelativeInput) return false;
  if (item?.leadEnabled !== true) return false;
  if (!Number.isFinite(item?.leadSeconds)) return false;
  return item.leadSeconds % 60 !== 0;
}


async function loadQuickPhrases() {
  const result = await chrome.storage.local.get([QUICK_KEY, QUICK_VERSION_KEY]);
  const phrases = result[QUICK_KEY];
  const version = result[QUICK_VERSION_KEY] || 0;
  if (version < QUICK_VERSION) {
    const defaults = ["25분후", "5분후"];
    await saveQuickPhrases(defaults);
    return defaults;
  }
  if (Array.isArray(phrases)) return phrases;
  return ["25분후", "5분후"];
}

async function saveQuickPhrases(phrases) {
  await chrome.storage.local.set({
    [QUICK_KEY]: phrases,
    [QUICK_VERSION_KEY]: QUICK_VERSION
  });
}

function renderQuickPhrases(phrases) {
  quickList.innerHTML = "";
  for (const phrase of phrases) {
    const wrapper = document.createElement("div");
    wrapper.className = "quick-item";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quick";
    btn.textContent = phrase;
    btn.addEventListener("click", () => addFromInputs([phrase]));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "quick-delete";
    del.textContent = "x";
    del.addEventListener("click", async () => {
      const next = phrases.filter((p) => p !== phrase);
      await saveQuickPhrases(next);
      renderQuickPhrases(next);
    });
    wrapper.appendChild(btn);
    wrapper.appendChild(del);
    quickList.appendChild(wrapper);
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, 1400);
}
