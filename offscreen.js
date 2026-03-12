let audioContext = null;
let loopTimer = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "offscreen-play") {
    playBeep();
  }
  if (message?.type === "offscreen-start") {
    startLoop(message.intervalMs);
  }
  if (message?.type === "offscreen-stop") {
    stopLoop();
  }
});

function getContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playBeep() {
  const ctx = getContext();
  const now = ctx.currentTime;

  for (let i = 0; i < 3; i += 1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, now + i * 0.6);
    gain.gain.linearRampToValueAtTime(0.4, now + i * 0.6 + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + i * 0.6 + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.6);
    osc.stop(now + i * 0.6 + 0.4);
  }
}

function startLoop(intervalMs = 2500) {
  stopLoop();
  playBeep();
  loopTimer = setInterval(() => {
    playBeep();
  }, Math.max(1200, intervalMs));
}

function stopLoop() {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}
