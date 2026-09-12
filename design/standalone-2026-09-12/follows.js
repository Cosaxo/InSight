(function () {
  const LS = "insight.friends.v2";
  const SEED = ["f1", "f2", "f4", "f6", "f3", "f8", "f9", "f10", "f11", "f12", "f13"];
  const SEED_REQ = ["f15", "f16"];
  let S;
  try {
    S = JSON.parse(localStorage.getItem(LS) || "null");
  } catch (e) {
    S = null;
  }
  if (!S || !Array.isArray(S.friends)) S = {
    friends: SEED.slice(),
    invited: {},
    requests: SEED_REQ.slice(),
    dismissed: []
  };
  S.invited = S.invited && typeof S.invited === "object" ? S.invited : {};
  S.requests = Array.isArray(S.requests) ? S.requests : [];
  S.dismissed = Array.isArray(S.dismissed) ? S.dismissed : [];
  const listeners = new Set();
  const fire = () => listeners.forEach(f => {
    try {
      f();
    } catch (e) {}
  });
  const save = () => {
    try {
      localStorage.setItem(LS, JSON.stringify(S));
    } catch (e) {}
    fire();
  };
  function delayMs(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = h * 31 + id.charCodeAt(i) >>> 0;
    return 10000 + h % 20000;
  }
  function sweep() {
    const now = Date.now();
    let hit = false;
    Object.keys(S.invited).forEach(id => {
      if (now - S.invited[id] >= delayMs(id)) {
        delete S.invited[id];
        if (!S.friends.includes(id)) S.friends.push(id);
        hit = true;
      }
    });
    if (hit) save();
  }
  let timer = null;
  function ensureTimer() {
    if (timer) return;
    timer = setInterval(() => {
      if (!Object.keys(S.invited).length) {
        clearInterval(timer);
        timer = null;
        return;
      }
      sweep();
    }, 2500);
  }
  if (Object.keys(S.invited).length) ensureTimer();
  const dropReq = id => {
    S.requests = S.requests.filter(x => x !== id);
  };
  function accept(id) {
    if (!S.requests.includes(id)) return;
    dropReq(id);
    if (!S.friends.includes(id)) S.friends.push(id);
    save();
  }
  window.FRIENDS = {
    status: id => S.friends.includes(id) ? "friends" : S.invited[id] != null ? "invited" : S.requests.includes(id) ? "requested" : "none",
    isFriend: id => S.friends.includes(id),
    invite: id => {
      if (!id || S.friends.includes(id)) return;
      if (S.requests.includes(id)) return accept(id);
      if (S.invited[id] == null) {
        S.invited[id] = Date.now();
        ensureTimer();
        save();
      }
    },
    cancel: id => {
      delete S.invited[id];
      save();
    },
    unfriend: id => {
      S.friends = S.friends.filter(x => x !== id);
      delete S.invited[id];
      dropReq(id);
      save();
    },
    list: () => S.friends.slice(),
    invitedList: () => Object.keys(S.invited),
    count: () => S.friends.length,
    requests: () => S.requests.slice(),
    accept,
    ignore: id => {
      dropReq(id);
      save();
    },
    dismiss: id => {
      if (id && !S.dismissed.includes(id)) {
        S.dismissed.push(id);
        save();
      }
    },
    dismissed: () => S.dismissed.slice(),
    isDismissed: id => S.dismissed.includes(id),
    subscribe: f => {
      listeners.add(f);
      return () => listeners.delete(f);
    }
  };
})();
