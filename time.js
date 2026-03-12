export function parseTimeString(input, now = new Date()) {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/\s+/g, "");

  const relativeMatch = s.match(/^(?:(\d{1,3})시간)?(?:(\d{1,3})분)?(?:(\d{1,3})초)?(후|뒤)$/);
  if (relativeMatch) {
    const hours = parseInt(relativeMatch[1] || "0", 10);
    const minutes = parseInt(relativeMatch[2] || "0", 10);
    const seconds = parseInt(relativeMatch[3] || "0", 10);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds <= 0) return null;
    const absoluteAt = new Date(now.getTime() + totalSeconds * 1000);
    return {
      hour: absoluteAt.getHours(),
      minute: absoluteAt.getMinutes(),
      second: absoluteAt.getSeconds(),
      hasSeconds: true,
      normalized: `${String(absoluteAt.getHours()).padStart(2, "0")}:${String(
        absoluteAt.getMinutes()
      ).padStart(2, "0")}:${String(absoluteAt.getSeconds()).padStart(2, "0")}`,
      absoluteAt: absoluteAt.getTime()
    };
  }

  const dateParsed = parseDateBasedInput(s, now);
  if (dateParsed) return dateParsed;

  const clock = parseClockString(s);
  if (!clock) return null;
  return {
    ...clock
  };
}

function parseDateBasedInput(input, now) {
  let date = null;
  let rest = "";

  const keywordMatch = input.match(/^(오늘|내일|모레)(.*)$/);
  if (keywordMatch) {
    const keyword = keywordMatch[1];
    rest = keywordMatch[2] || "";
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let offsetDays = 0;
    if (keyword === "내일") offsetDays = 1;
    if (keyword === "모레") offsetDays = 2;
    date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
  }

  if (!date) {
    const fullMatch = input.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(.*)$/);
    if (fullMatch) {
      const year = parseInt(fullMatch[1], 10);
      const month = parseInt(fullMatch[2], 10) - 1;
      const day = parseInt(fullMatch[3], 10);
      rest = fullMatch[4] || "";
      date = new Date(year, month, day);
    }
  }

  if (!date) {
    const shortMatch = input.match(/^(\d{1,2})[./-](\d{1,2})(.*)$/);
    if (shortMatch) {
      const year = now.getFullYear();
      const month = parseInt(shortMatch[1], 10) - 1;
      const day = parseInt(shortMatch[2], 10);
      rest = shortMatch[3] || "";
      date = new Date(year, month, day);
    }
  }

  if (!date) {
    const koreanFull = input.match(/^(\d{4})년(\d{1,2})월(\d{1,2})일(.*)$/);
    if (koreanFull) {
      const year = parseInt(koreanFull[1], 10);
      const month = parseInt(koreanFull[2], 10) - 1;
      const day = parseInt(koreanFull[3], 10);
      rest = koreanFull[4] || "";
      date = new Date(year, month, day);
    }
  }

  if (!date) {
    const koreanShort = input.match(/^(\d{1,2})월(\d{1,2})일(.*)$/);
    if (koreanShort) {
      const year = now.getFullYear();
      const month = parseInt(koreanShort[1], 10) - 1;
      const day = parseInt(koreanShort[2], 10);
      rest = koreanShort[3] || "";
      date = new Date(year, month, day);
    }
  }

  if (!date) return null;

  if (!rest) return null;

  const clock = parseClockString(rest);
  if (!clock) return null;

  const absoluteAt = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    clock.hour,
    clock.minute,
    clock.second || 0,
    0,
    0
  );

  return {
    ...clock,
    absoluteAt: absoluteAt.getTime()
  };
}

function parseClockString(input) {
  let s = input;
  const ampmMatch = s.match(/(am|pm|오전|오후)/);
  let ampm = null;
  if (ampmMatch) {
    ampm = ampmMatch[1];
    s = s.replace(/(am|pm|오전|오후)/g, "").trim();
  }

  const koreanMatch = s.match(/^(\d{1,2})시(\d{1,2})?분?(\d{1,2})?초?$/);
  if (koreanMatch) {
    const h = koreanMatch[1];
    const m = koreanMatch[2] || "0";
    const sec = koreanMatch[3];
    s = sec ? `${h}:${m}:${sec}` : `${h}:${m}`;
  }

  s = s.replace(/\./g, ":");

  let hour = null;
  let minute = 0;
  let second = 0;
  let hasSeconds = false;

  if (s.includes(":")) {
    const parts = s.split(":");
    if (parts.length < 2 || parts.length > 3) return null;
    if (!parts.every((part) => /^\d+$/.test(part))) return null;
    hour = parseInt(parts[0], 10);
    minute = parseInt(parts[1], 10);
    if (parts.length === 3) {
      second = parseInt(parts[2], 10);
      hasSeconds = true;
    }
  } else if (/^\d+$/.test(s)) {
    if (s.length <= 2) {
      hour = parseInt(s, 10);
      minute = 0;
    } else if (s.length === 3 || s.length === 4) {
      hour = parseInt(s.slice(0, -2), 10);
      minute = parseInt(s.slice(-2), 10);
    } else if (s.length === 5 || s.length === 6) {
      hour = parseInt(s.slice(0, -4), 10);
      minute = parseInt(s.slice(-4, -2), 10);
      second = parseInt(s.slice(-2), 10);
      hasSeconds = true;
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) return null;

  if (ampm) {
    const isPm = ampm === "pm" || ampm === "오후";
    const isAm = ampm === "am" || ampm === "오전";
    if (hour < 1 || hour > 12) return null;
    if (isPm && hour < 12) hour += 12;
    if (isAm && hour === 12) hour = 0;
  }

  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;

  return {
    hour,
    minute,
    second,
    hasSeconds,
    normalized: hasSeconds
      ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`
      : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  };
}

export function splitInputs(raw) {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function formatTime(hour, minute, second = null) {
  const base = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  if (typeof second === "number" && !Number.isNaN(second)) {
    return `${base}:${String(second).padStart(2, "0")}`;
  }
  return base;
}

export function computeNextOccurrence(item, fromDate = new Date()) {
  if (!item.enabled) return null;
  if (item.oneOffAt) {
    const target = new Date(item.oneOffAt);
    if (target > fromDate) return target;
    return null;
  }
  const { hour, minute, second = 0, repeat, days } = item;
  if (typeof hour !== "number" || typeof minute !== "number") return null;

  const from = new Date(fromDate.getTime());
  for (let i = 0; i <= 7; i += 1) {
    const candidate = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate() + i,
      hour,
      minute,
      second,
      0
    );

    if (candidate <= from) continue;

    if (repeat === "once" || repeat === "daily") return candidate;

    const day = candidate.getDay();
    if (repeat === "weekdays" && day >= 1 && day <= 5) return candidate;
    if (repeat === "weekends" && (day === 0 || day === 6)) return candidate;
    if (repeat === "custom" && Array.isArray(days) && days.includes(day)) return candidate;
  }

  return null;
}

export function defaultDaysForRepeat(repeat) {
  if (repeat === "weekdays") return [1, 2, 3, 4, 5];
  if (repeat === "weekends") return [0, 6];
  return [];
}
