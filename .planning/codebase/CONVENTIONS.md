# Code Conventions

**Analysis Date:** 2026-02-24

## Language and Module System

**JavaScript (ES Modules)**
- All `.js` files use ES6+ syntax
- Import/export with `import`/`export` keywords
- Manifest declares `"type": "module"` for ES module support
- No transpilation or build step (direct browser execution)

## Code Style

### Indentation and Formatting
- Indentation: 2 spaces (consistent across all files)
- Line endings: LF (Unix style)
- Semicolons: Required at end of statements
- String quotes: Double quotes preferred (`"string"`)
- Template literals: Used for multi-line strings and interpolation
- Object/array trailing commas: Inconsistent (sometimes present, sometimes not)

### Line Length
- No strict limit, but most lines under 100 characters
- Long lines broken at logical points (after operators, commas)

### Whitespace
- Space after keywords: `if (condition)`, `function name()`
- Space around operators: `a + b`, `x === y`
- No space before function call parentheses: `func()`
- Space after commas: `[a, b, c]`, `{x: 1, y: 2}`

## Naming Conventions

### Variables and Functions
- **camelCase** for variables and functions: `timeInput`, `loadItems`, `parseTimeString`
- **UPPER_SNAKE_CASE** for constants: `STORAGE_KEY`, `ACTIVE_KEY`, `DEFAULT_ALARM_DURATION_MS`
- Descriptive names preferred over abbreviations
- DOM element variables often include element type: `timeInput`, `addError`, `refreshBtn`
- Boolean variables use `is`/`has` prefix: `hasSeconds`, `enabled`

### Functions
- Verb-first naming: `parseTimeString`, `loadItems`, `saveItems`, `computeNextOccurrence`
- Async functions use same naming as sync (no special prefix)
- Event handlers prefix with `on`: `onAdd()`, `onDelete()`
- Private/internal functions: No special prefix (no strict public/private convention)

### Files
- Lowercase with hyphens for HTML: `popup.html`, `offscreen.html`
- camelCase for JavaScript: `background.js`, `popup.js`, `time.js`
- Descriptive names: Files named after primary purpose (`time.js` for time utilities)

## Function Design

### Function Length
- Functions range from 5-80 lines
- Longer functions (e.g., `render()` ~120 lines) handle complex DOM operations
- No strict limit, but functions generally focused on single responsibility

### Function Parameters
- 1-3 parameters typical
- Optional parameters use default values: `parseTimeString(input, now = new Date())`
- No parameter validation in most functions (assumes valid input from caller)
- Complex objects passed by reference (e.g., `item` object)

### Return Values
- Functions return meaningful values or `null` for failure
- Parse functions return objects or `null`: `parseTimeString()` → `{hour, minute, ...}` or `null`
- Async functions return Promises (implicit with `async`)
- Boolean functions return `true`/`false`: `Array.isArray(items)`
- No explicit error throwing (errors handled with try/catch or null returns)

## Async/Await Patterns

### Async Functions
- Use `async`/`await` consistently (no raw Promises or callbacks)
- Chrome API calls use Promise-based wrappers
- Example pattern:
  ```javascript
  async function loadItems() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  }
  ```

### Error Handling with Async
- `try`/`catch` blocks wrap risky async operations
- Errors often logged to console: `console.error("message", err)`
- Silent failures common (no user-facing error messages in many cases)
- Example:
  ```javascript
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: items });
  } catch (err) {
    console.error("Storage save failed:", err);
  }
  ```

## Error Handling

### Try/Catch Usage
- Used around Chrome API calls that may fail
- Used around JSON parsing or complex operations
- Not used for control flow (only for error handling)
- Example locations:
  - Storage operations: `background.js` lines 73-74, `popup.js` lines 483-487
  - Notification creation: `background.js` lines 67-75
  - Window management: `background.js` line 196

### Error Logging
- Errors logged to console with descriptive messages
- No structured logging framework
- No error tracking service integration
- User-facing errors displayed in UI via `#addError` element

### Error Recovery
- Limited error recovery mechanisms
- Failed operations often silent (no retry logic)
- Storage failures may result in data loss
- No backup or rollback mechanism

## DOM Manipulation

### Element Selection
- `document.getElementById()` for ID-based selection (cached at module top level)
- Example: `const timeInput = document.getElementById("timeInput");`
- Elements cached as module-level constants

### Element Creation
- `document.createElement()` for new elements
- Template cloning: `template.content.cloneNode(true)` for alarm items
- Property assignment: `el.textContent = "value"`, `el.hidden = true`
- Event listeners: `el.addEventListener("click", handler)`

### DOM Updates
- Full re-render pattern: Clear container, rebuild all elements
- Example in `render()`: `listEl.innerHTML = ""`; then append all items
- No virtual DOM or incremental updates
- Direct property manipulation: `el.textContent`, `el.hidden`, `el.value`

### Event Handling
- `addEventListener` for all event binding
- Inline handlers not used
- Event delegation: Click handler on list container checks `event.target`
- Keyboard events: `keydown` listener checks `event.key === "Enter"`

## Comments

### Comment Density
- Sparse comments (most code self-documenting)
- No function-level JSDoc comments
- No type annotations

### Comment Style
- Single-line comments: `// comment`
- No multi-line comments (`/* */`) used
- Comments explain "why" more than "what"
- Example: `// Stop alarm after duration expires`

### Comment Locations
- Above complex logic blocks
- Inline with tricky operations
- No header comments in files

## Import/Export Patterns

### Exports
- Named exports only (no default exports)
- Export declarations at definition: `export function parseTimeString() { ... }`
- Multiple exports per file: `time.js` exports ~10 functions

### Imports
- Named imports: `import { func1, func2 } from "./module.js"`
- File extension required: `./time.js` (not `./time`)
- Destructuring in import: `import { parseTimeString, splitInputs } from "./time.js"`
- Chrome API accessed via global: `chrome.storage`, `chrome.runtime` (no import)

## Chrome API Usage

### Storage
- Always use `chrome.storage.local` (not `chrome.storage.sync`)
- Pattern: `await chrome.storage.local.get(key)` → returns object with key
- Pattern: `await chrome.storage.local.set({ [key]: value })`
- No data validation on read (assumes storage contains valid data)

### Alarms
- Create with `chrome.alarms.create(name, { when: timestamp })`
- Clear all: `await chrome.alarms.clearAll()`
- Listener: `chrome.alarms.onAlarm.addListener(async (alarm) => { ... })`
- Alarm names use prefix: `alarm:${id}` for item alarms, `alarm-stop` for stop timer

### Messaging
- Send message: `chrome.runtime.sendMessage({ type: "...", ... })`
- Message listener: `chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { ... })`
- Return `true` from listener for async sendResponse
- Message types: `"reschedule"`, `"playSound"`, `"stopAlarm"`, `"start-sound"`, `"stop-sound"`

### Notifications
- Create with `chrome.notifications.create(id, options, callback)`
- Options: `{ type: "basic", iconUrl, title, message, priority, requireInteraction }`
- Error handling via `chrome.runtime.lastError` in callback

## State Management

### Storage as State
- Chrome storage is source of truth
- No in-memory state cache (always read from storage)
- State updates: Read → Modify → Write pattern
- Concurrent updates may race (no locking mechanism)

### Message Passing for Sync
- Background script triggers reschedule via message: `chrome.runtime.sendMessage({ type: "reschedule" })`
- Storage change listeners: `chrome.storage.onChanged.addListener()`
- Popup reacts to storage changes for live updates

### Timers and Intervals
- Module-level variables for interval IDs: `let liveTimer = null;`
- Clear before setting: Check if timer exists, call `clearInterval()`, then set new
- Not cleaned up on window unload (potential memory leak)

## Data Structures

### Alarm Item Object
```javascript
{
  id: string,              // Unique ID (timestamp + random)
  hour: number,            // 0-23
  minute: number,          // 0-59
  second: number | undefined,  // 0-59 (optional)
  message: string,         // User message
  repeat: "once" | "daily" | "weekly" | "weekday",
  days: number[] | undefined,  // 0-6 for weekly (0=Sunday)
  enabled: boolean,        // Can be disabled without deletion
  nextAt: number | null,   // Timestamp of next occurrence
  lastFired: number | undefined,  // Timestamp of last fire
  oneOffAt: number | undefined    // For absolute one-time alarms
}
```

### Settings Object
```javascript
{
  duration: number,   // Alarm duration in milliseconds
  interval: number    // Sound repeat interval in milliseconds
}
```

### Active Alarm Object
```javascript
{
  id: string,         // ID of firing alarm
  startedAt: number   // Timestamp when alarm started
}
```

## Patterns and Idioms

### Null Checks
- Truthy checks: `if (value)`, `if (!value)`
- Explicit null checks: `if (value === null)`, `if (value !== undefined)`
- Optional chaining: `message?.type`, `alarm?.name`
- Array checks: `Array.isArray(items)`

### Default Values
- Function parameters: `function parse(input, now = new Date()) { ... }`
- Fallback with OR: `const duration = settings.duration || DEFAULT_DURATION`
- Ternary for defaults: `const msg = item.message?.trim() || "알람"`

### Array Operations
- Functional methods: `.map()`, `.filter()`, `.find()`, `.findIndex()`, `.forEach()`
- Imperative loops rare (only for complex logic)
- Array spread for copying: `[...items]` (not used frequently)
- Array mutation: `.push()`, `.splice()` common (not pure functional style)

### Object Construction
- Object literals: `{ key: value, ... }`
- Spread for copying: Not commonly used
- Property shorthand: `{ id, hour, minute }` when variable names match keys
- Computed property names: `{ [STORAGE_KEY]: items }`

### String Manipulation
- Template literals for concatenation: `` `${a} · ${b}` ``
- `.trim()` on user input
- `.toLowerCase()` for normalization
- `.padStart(2, "0")` for zero-padding numbers
- `.replace(/regex/, "")` for cleaning input

## Testing Approach

### No Automated Tests
- No test framework present (no Jest, Mocha, etc.)
- No test files (`*.test.js`, `*.spec.js`)
- No test scripts in `package.json` (no package.json exists)

### Manual Testing
- Testing done manually in browser
- Extension loaded as unpacked for development
- Console logs used for debugging

### Validation Strategy
- Validation mostly at input parsing level (`time.js`)
- UI validation minimal (no schema validation on storage reads)
- Rely on Chrome API error handling

---

*Conventions audit: 2026-02-24*
