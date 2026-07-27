// follows.js — friendships (mutual). Your friends ARE your circle: they feed the
// 1v1s, the groups, and the circle populations. Adding someone sends a request;
// in this prototype the other side accepts after a short, believable delay.
// Persisted locally.
(function () {
  const LS = 'insight.friends.v1';
  const SEED = ['f1', 'f2', 'f4', 'f6', 'f3'];
  let S;
  try { S = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { S = null; }
  if (!S || !Array.isArray(S.friends)) S = { friends: SEED.slice(), invited: {} };
  S.invited = S.invited && typeof S.invited === 'object' ? S.invited : {};
  const listeners = new Set();
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) {} });
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} fire(); };
  // deterministic per-person acceptance delay (10–30 s) — "they saw it on their phone"
  function delayMs(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return 10000 + (h % 20000); }
  function sweep() {
    const now = Date.now(); let hit = false;
    Object.keys(S.invited).forEach((id) => {
      if (now - S.invited[id] >= delayMs(id)) { delete S.invited[id]; if (!S.friends.includes(id)) S.friends.push(id); hit = true; }
    });
    if (hit) save();
  }
  let timer = null;
  function ensureTimer() {
    if (timer) return;
    timer = setInterval(() => { if (!Object.keys(S.invited).length) { clearInterval(timer); timer = null; return; } sweep(); }, 2500);
  }
  if (Object.keys(S.invited).length) ensureTimer();
  window.FRIENDS = {
    status: (id) => (S.friends.includes(id) ? 'friends' : S.invited[id] != null ? 'invited' : 'none'),
    isFriend: (id) => S.friends.includes(id),
    invite: (id) => { if (id && !S.friends.includes(id) && S.invited[id] == null) { S.invited[id] = Date.now(); ensureTimer(); save(); } },
    cancel: (id) => { delete S.invited[id]; save(); },
    unfriend: (id) => { S.friends = S.friends.filter((x) => x !== id); delete S.invited[id]; save(); },
    list: () => S.friends.slice(),
    invitedList: () => Object.keys(S.invited),
    count: () => S.friends.length,
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();
