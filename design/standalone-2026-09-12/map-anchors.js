(function () {
  function topDims(key, n) {
    const R = (window.IS_TEST_RESULTS || {})[key];
    if (!R || !R.dims) return "";
    return R.dims.slice().sort((a, b) => b.value - a.value).slice(0, n || 2).map(d => d.label + " " + d.value).join(" · ");
  }
  function list() {
    const me = (window.IS_DATA || {}).me || {};
    const s = me.stats || {};
    return [{
      id: "age",
      label: "Age",
      hue: 265,
      value: "age " + (s.age || 34),
      sub: "born " + (s.birthYear || 1991)
    }, {
      id: "job",
      label: "Work",
      hue: 85,
      value: me.job || "Editor",
      sub: "from your profile"
    }, {
      id: "edu",
      label: "Study",
      hue: 190,
      value: me.education || "MA Literature",
      sub: "from your profile"
    }, {
      id: "big5",
      label: "Big Five",
      hue: 40,
      value: topDims("big5"),
      sub: tTaken("big5")
    }, {
      id: "political",
      label: "Politics",
      hue: 235,
      value: topDims("political"),
      sub: tTaken("political")
    }, {
      id: "values",
      label: "Values",
      hue: 28,
      value: topDims("values"),
      sub: tTaken("values")
    }, {
      id: "attachment",
      label: "Social",
      hue: 320,
      value: topDims("attachment"),
      sub: tTaken("attachment")
    }];
  }
  function tTaken(key) {
    const R = (window.IS_TEST_RESULTS || {})[key];
    return R && R.taken ? R.title + " · taken " + R.taken : "";
  }
  const REL = {
    dq30: [["age", 2, "this rivalry ran through your twenties — most 34-year-olds hold a side"], ["values", 2, "beauty at 78 tends to side with the playmaker"]],
    dq29: [["big5", 2, "openness 78 predicts strong director loyalties"], ["edu", 2, "literature grads pick by authorship, not genre"]],
    dq28: [["big5", 1, "openness 78 usually says yes to odd toppings"], ["age", 1, "the debate splits every age group about evenly"]],
    dq27: [["values", 3, "meaning 71 — the wanting usually points at time and quiet"], ["big5", 2, "mid extraversion wants closeness and quiet in equal parts"], ["job", 2, "editors run on other people’s deadlines — time is the common ask"]],
    dq26: [["big5", 2, "conscientiousness 62 agrees, with a small guilty pause"], ["values", 2, "pleasure at 52 — rest is allowed, not worshipped"]],
    dq25: [["political", 1, "climate-first people split evenly — both are the outdoors"], ["big5", 1, "openness mostly decides how far, not which"]],
    dq24: [["big5", 3, "agreeableness 71 hands it in far more often than not"], ["values", 2, "circle 46 — care leans close, but strangers still register"], ["political", 1, "flat-authority types still mostly choose the honest desk"]],
    dq23: [["values", 3, "future 58 — cautious hope is exactly this question"], ["political", 2, "tech-optimists at 64 rate the decade higher"], ["big5", 2, "low sensitivity keeps the number from sinking"]],
    dq22: [["big5", 3, "agreeableness 71 is the single best predictor of yes"], ["attachment", 2, "open 64 — people who let others in expect good faith"], ["political", 1, "internationalists lean trusting"]],
    dq21: [["big5", 3, "conscientiousness 62 books the first nights, then loosens"], ["job", 1, "editors plan by default — an itinerary is a draft"]],
    dq20: [["big5", 2, "mid extraversion starts quiet more often than social"], ["job", 1, "print people guard slow mornings"], ["age", 1, "mid-thirties mornings drift earlier"]],
    dq19: [["attachment", 3, "loyal 84 — this one stays, or finds the third way"], ["values", 2, "duty 64 outweighs the title"], ["job", 2, "editing is a networked trade — moving costs the web"]],
    dq18: [["age", 2, "mid-thirties is when watching quietly overtakes playing"], ["big5", 2, "extraversion 48 — plays with few, watches with many"]],
    dq17: [["values", 3, "meaning 71 says yes — struggle carries weight for you"], ["edu", 2, "literature degrees agree; it’s half the syllabus"], ["big5", 2, "openness 78 sits with the hard idea rather than around it"]],
    dq16: [["big5", 1, "sensitivity 42 keeps the daily swings small"], ["age", 1, "energy at 34 is mostly sleep, not age"]],
    dq15: [["big5", 3, "extraversion 48 texts first, calls the inner few"], ["attachment", 2, "warm 78 is why the calls still happen at all"], ["age", 2, "your cohort texts by default"]],
    dq14: [["job", 2, "editing runs on coffee — the trade’s oldest tool"], ["age", 1, "coffee peaks right around your decade"]],
    dq13: [["political", 3, "surveillance-wary but tech-hopeful — agrees, with reservations"], ["values", 2, "tech 62 resists the bleakest reading"], ["age", 1, "the generation that remembers both sides of the divide"]],
    dq12: [["values", 3, "meaning 71 and beauty 78 point at creation"], ["attachment", 2, "warm 78 keeps connection a close second"]],
    dq11: [["big5", 2, "sensitivity 42 — low dread makes “know” thinkable"], ["values", 2, "meaning-seekers ask what the number would change"]],
    dq10: [["age", 1, "rest at 34 tracks habits more than years"], ["big5", 1, "conscientiousness 62 protects the bedtime, mostly"]],
    dq09: [["big5", 3, "extraversion 48 — the textbook few-and-deep profile"], ["attachment", 3, "loyal 84 was never going to say many"]],
    dq08: [["big5", 2, "mid extraversion — a book wins most weeks, friends some"], ["edu", 2, "the MA never really left the reading chair"], ["job", 1, "reading for a living rarely spoils reading for joy"]],
    dq07: [["big5", 3, "agreeableness 71 bends the truth toward kindness"], ["attachment", 2, "warm 78 breaks ties in kindness’s favour"]],
    dq06: [["age", 2, "chronotypes drift earlier through the thirties"], ["big5", 2, "conscientiousness 62 leans lark, weekends excepted"]],
    dq05: [["big5", 2, "sensitivity 42 reads life as steerable"], ["job", 2, "independent-press work keeps the number honest"], ["values", 1, "future 58 — hopeful, hands on the wheel"]],
    dq04: [["job", 3, "people in making trades answer “what I make”"], ["edu", 2, "literature people split between make and believe"], ["values", 2, "meaning 71 rules out “what I do” alone"]],
    dq03: [["big5", 2, "openness 78 almost always takes the new day"], ["age", 1, "the relive vote grows with age — not yet"]],
    dq02: [["values", 2, "beauty 78 picks the melancholy seasons at twice the rate"], ["big5", 1, "open types feel the seasons harder"]],
    dq01: [["values", 3, "circle 46 — believes it mildly, helps locally"], ["big5", 2, "agreeableness 71 says yes on people’s behalf"], ["political", 1, "trust in strangers leans left of centre"]]
  };
  const FALLBACK = {
    Sport: [["age", 2, "sport taste is generational"], ["big5", 1, "extraversion shapes how you engage"]],
    Film: [["big5", 2, "openness 78 drives taste breadth"], ["edu", 1, "trained readers watch like readers"]],
    Food: [["age", 1, "food splits run young–old"], ["big5", 1, "openness says try it"]],
    Travel: [["big5", 2, "openness 78 sets the range"], ["political", 1, "green politics travels lighter"]],
    Mind: [["big5", 2, "temperament questions map onto the Big Five"], ["values", 1, "meaning 71 colours the answer"]],
    Morals: [["big5", 2, "agreeableness 71 leans generous"], ["values", 2, "ethics 44 — your morals lean situational"]],
    Values: [["values", 2, "closest to your values test"], ["big5", 2, "openness and agreeableness pull the answer"]],
    Body: [["age", 2, "the body keeps the calendar"], ["big5", 1, "conscientiousness runs the routine"]],
    Skills: [["job", 2, "craft answers track the trade"], ["big5", 1, "openness picks the next craft"]],
    Interests: [["big5", 2, "openness 78 is the collector"], ["edu", 1, "the degree shows in the shelf"]],
    Home: [["age", 1, "home answers settle with the decade"], ["values", 1, "beauty 78 arranges the rooms"]],
    Story: [["age", 2, "the timeline is the anchor"], ["edu", 1, "the study years bent the path"]],
    Goals: [["values", 2, "meaning 71 sets the horizon"], ["job", 1, "the trade shapes the ambition"]],
    Music: [["big5", 2, "openness 78 sets the playlist"], ["age", 1, "the ear is set young"]]
  };
  function relate(qid, top) {
    const rows = REL[qid] || FALLBACK[top] || [["big5", 1, "temperament shapes this one"]];
    return rows.map(r => ({
      a: r[0],
      s: r[1],
      line: r[2]
    }));
  }
  window.MapAnchors = {
    list,
    relate
  };
})();
