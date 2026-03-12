import { computeNextOccurrence, formatTime } from "./time.js";

const STORAGE_KEY = "alarms";
const STORAGE_ACTIVE_KEY = "alarmActive";
const SETTINGS_KEY = "alarmSettings";
const OFFSCREEN_URL = "offscreen.html";
const POPUP_URL = chrome.runtime.getURL("popup.html");
let alarmPopupWindowId = null;
const DEFAULT_ALARM_DURATION_MS = 60 * 1000;
const DEFAULT_SOUND_INTERVAL_MS = 2500;

chrome.runtime.onInstalled.addListener(() => {
  rescheduleAll();
});

chrome.runtime.onStartup.addListener(() => {
  rescheduleAll();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "reschedule") {
    rescheduleAll().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "playSound") {
    playAlarmSound();
  }
  if (message?.type === "stopAlarm") {
    stopActiveAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
  return undefined;
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (alarmPopupWindowId === windowId) {
    alarmPopupWindowId = null;
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm?.name === "alarm-stop") {
    await stopActiveAlarm();
    return;
  }

  const id = alarm?.name?.replace("alarm:", "");
  if (!id) return;

  const items = await loadItems();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  const timeText = formatTime(item.hour, item.minute, item.second ?? null);
  const message = item.message?.trim() || "알람";

  const notificationId = `alarm-${id}-${Date.now()}`;
  const notificationOptions = {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "Typing Alarm",
    message: `${timeText} · ${message}`,
    priority: 2,
    requireInteraction: true
  };

  try {
    chrome.notifications.create(notificationId, notificationOptions, () => {
      if (chrome.runtime.lastError) {
        console.error("Notification error:", chrome.runtime.lastError.message);
      }
    });
  } catch (err) {
    console.error("Notification exception:", err);
  }

  await startActiveAlarm(id);
  await openAlarmPopup();

  item.lastFired = Date.now();
  if (item.repeat === "once" || item.oneOffAt) {
    const index = items.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      items.splice(index, 1);
    }
  } else {
    const next = computeNextOccurrence(item, new Date());
    item.nextAt = next ? next.getTime() : null;
    if (item.nextAt) {
      chrome.alarms.create(`alarm:${id}`, { when: item.nextAt });
    }
  }

  await saveItems(items);
});

async function rescheduleAll() {
  const items = await loadItems();
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

async function loadItems() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const items = result[STORAGE_KEY];
  if (Array.isArray(items)) return items;
  return [];
}

async function saveItems(items) {
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play alarm sound when a timer fires."
  });
}

async function playAlarmSound() {
  await ensureOffscreen();
  await chrome.runtime.sendMessage({ type: "offscreen-play" });
}

async function loadSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = result[SETTINGS_KEY];
  return {
    durationMs: typeof settings?.durationMs === "number" ? settings.durationMs : DEFAULT_ALARM_DURATION_MS,
    intervalMs: typeof settings?.intervalMs === "number" ? settings.intervalMs : DEFAULT_SOUND_INTERVAL_MS
  };
}

async function startActiveAlarm(id) {
  const items = await loadItems();
  const item = items.find((entry) => entry.id === id);
  const title = item?.message?.trim() || "알람 울림 중";
  const settings = await loadSettings();
  const now = Date.now();
  const endsAt = now + settings.durationMs;
  await chrome.storage.local.set({
    [STORAGE_ACTIVE_KEY]: {
      id,
      title,
      startedAt: now,
      endsAt
    }
  });
  await ensureOffscreen();
  await chrome.runtime.sendMessage({
    type: "offscreen-start",
    intervalMs: settings.intervalMs
  });
  chrome.alarms.create("alarm-stop", { when: endsAt });
}

async function stopActiveAlarm() {
  await chrome.storage.local.remove(STORAGE_ACTIVE_KEY);
  await ensureOffscreen();
  await chrome.runtime.sendMessage({ type: "offscreen-stop" });
  await chrome.alarms.clear("alarm-stop");
}

async function openAlarmPopup() {
  try {
    if (alarmPopupWindowId) {
      await chrome.windows.update(alarmPopupWindowId, { focused: true });
      return;
    }
  } catch (err) {
    alarmPopupWindowId = null;
  }

  try {
    const win = await chrome.windows.create({
      url: POPUP_URL,
      type: "popup",
      width: 380,
      height: 560,
      focused: true
    });
    alarmPopupWindowId = win?.id ?? null;
  } catch (err) {
    console.error("Popup open failed:", err);
  }
}
