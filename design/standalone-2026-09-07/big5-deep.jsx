// big5-deep.jsx — the Big Five in depth: five domains first, thirty facets behind
// them. Level one lives on the Big 5 tab as five rows (name · band · summary ·
// the six facet scores as dots on one track). Tapping a row unfolds the domain
// in place — definition, your summary, then each facet with its score on a
// 4–20 track (tap a facet to read it). One domain open at a time: opening
// another closes the last. Report text is the IPIP-NEO narrative, kept verbatim.
(function () {
  const INK = 'var(--c-around)'; // the Big Five's colour everywhere else in the app
  const MIN = 4,
    MAX = 20,
    MID = 12;
  const pos = s => (s - MIN) / (MAX - MIN) * 100;
  const DOMAINS = [{
    id: 'N',
    name: 'Neuroticism',
    band: 'low',
    trait: 'calm, composed, unflappable',
    def: 'Neuroticism refers to the tendency to experience negative feelings.',
    you: 'Your score on Neuroticism is low, indicating that you are exceptionally calm, composed and unflappable. You do not react with intense emotions, even to situations that most people would describe as stressful.',
    facets: [{
      name: 'Anxiety',
      lo: 'calm, fearless',
      hi: 'tense, on alert',
      score: 7,
      band: 'low',
      text: 'The "fight-or-flight" system of the brain of anxious individuals is too easily and too often engaged. Therefore, people who are high in anxiety often feel like something dangerous is about to happen. They may be afraid of specific situations or be just generally fearful. They feel tense, jittery, and nervous. Persons low in Anxiety are generally calm and fearless.'
    }, {
      name: 'Anger',
      lo: 'slow to anger',
      hi: 'quick to resent',
      score: 4,
      band: 'low',
      text: 'Persons who score high in Anger feel enraged when things do not go their way. They are sensitive about being treated fairly and feel resentful and bitter when they feel they are being cheated. This scale measures the tendency to feel angry; whether or not the person expresses annoyance and hostility depends on the individual\u2019s level on Agreeableness. Low scorers do not get angry often or easily.'
    }, {
      name: 'Depression',
      lo: 'free of the blues',
      hi: 'dejected, low energy',
      score: 5,
      band: 'low',
      text: 'This scale measures the tendency to feel sad, dejected, and discouraged. High scorers lack energy and have difficulty initiating activities. Low scorers tend to be free from these depressive feelings.'
    }, {
      name: 'Self-Consciousness',
      lo: 'unbothered by judgment',
      hi: 'easily embarrassed',
      score: 10,
      band: 'low',
      text: 'Self-conscious individuals are sensitive about what others think of them. Their concern about rejection and ridicule cause them to feel shy and uncomfortable around others. They are easily embarrassed and often feel ashamed. Their fears that others will criticize or make fun of them are exaggerated and unrealistic, but their awkwardness and discomfort may make these fears a self-fulfilling prophecy. Low scorers, in contrast, do not suffer from the mistaken impression that everyone is watching and judging them. They do not feel nervous in social situations.'
    }, {
      name: 'Immoderation',
      lo: 'resists cravings',
      hi: 'strong cravings',
      score: 13,
      band: 'high',
      text: 'Immoderate individuals feel strong cravings and urges that they have have difficulty resisting. They tend to be oriented toward short-term pleasures and rewards rather than long- term consequences. Low scorers do not experience strong, irresistible cravings and consequently do not find themselves tempted to overindulge.'
    }, {
      name: 'Vulnerability',
      lo: 'poised under stress',
      hi: 'panics under pressure',
      score: 6,
      band: 'low',
      text: 'High scorers on Vulnerability experience panic, confusion, and helplessness when under pressure or stress. Low scorers feel more poised, confident, and clear-thinking when stressed.'
    }]
  }, {
    id: 'E',
    name: 'Extraversion',
    band: 'low',
    trait: 'introverted, reserved, quiet',
    def: 'Extraversion is marked by pronounced engagement with the external world.',
    you: 'Your score on Extraversion is low, indicating you are introverted, reserved, and quiet. You enjoy solitude and solitary activities. Your socialization tends to be restricted to a few close friends.',
    facets: [{
      name: 'Friendliness',
      lo: 'reserved, distant',
      hi: 'warm, quick to bond',
      score: 11,
      band: 'low',
      text: 'Friendly people genuinely like other people and openly demonstrate positive feelings toward others. They make friends quickly and it is easy for them to form close, intimate relationships. Low scorers on Friendliness are not necessarily cold and hostile, but they do not reach out to others and are perceived as distant and reserved.'
    }, {
      name: 'Gregariousness',
      lo: 'avoids crowds',
      hi: 'loves a crowd',
      score: 8,
      band: 'low',
      text: 'Gregarious people find the company of others pleasantly stimulating and rewarding. They enjoy the excitement of crowds. Low scorers tend to feel overwhelmed by, and therefore actively avoid, large crowds. They do not necessarily dislike being with people sometimes, but their need for privacy and time to themselves is much greater than for individuals who score high on this scale.'
    }, {
      name: 'Assertiveness',
      lo: 'lets others lead',
      hi: 'takes charge',
      score: 13,
      band: 'high',
      text: 'High scorers Assertiveness like to speak out, take charge, and direct the activities of others. They tend to be leaders in groups. Low scorers tend not to talk much and let others control the activities of groups.'
    }, {
      name: 'Activity Level',
      lo: 'leisurely pace',
      hi: 'fast-paced, busy',
      score: 11,
      band: 'low',
      text: 'Active individuals lead fast-paced, busy lives. They move about quickly, energetically, and vigorously, and they are involved in many activities. People who score low on this scale follow a slower and more leisurely, relaxed pace.'
    }, {
      name: 'Excitement-Seeking',
      lo: 'averse to thrills',
      hi: 'thrill-seeking',
      score: 7,
      band: 'low',
      text: 'High scorers on this scale are easily bored without high levels of stimulation. They love bright lights and hustle and bustle. They are likely to take risks and seek thrills. Low scorers are overwhelmed by noise and commotion and are adverse to thrill-seeking.'
    }, {
      name: 'Cheerfulness',
      lo: 'even-keeled',
      hi: 'high spirits',
      score: 17,
      band: 'high',
      text: 'This scale measures positive mood and feelings, not negative emotions (which are a part of the Neuroticism domain). Persons who score high on this scale typically experience a range of positive feelings, including happiness, enthusiasm, optimism, and joy. Low scorers are not as prone to such energetic, high spirits.'
    }]
  }, {
    id: 'O',
    name: 'Openness To Experience',
    short: 'Openness',
    band: 'high',
    trait: 'curious, imaginative, creative',
    def: 'Openness to Experience describes a dimension of cognitive style that distinguishes imaginative, creative people from down-to-earth, conventional people.',
    you: 'Your score on Openness to Experience is high, indicating you enjoy novelty, variety, and change. You are curious, imaginative, and creative.',
    facets: [{
      name: 'Imagination',
      lo: 'fact-oriented',
      hi: 'rich fantasy life',
      score: 20,
      band: 'high',
      text: 'To imaginative individuals, the real world is often too plain and ordinary. High scorers on this scale use fantasy as a way of creating a richer, more interesting world. Low scorers are on this scale are more oriented to facts than fantasy.'
    }, {
      name: 'Artistic Interests',
      lo: 'little pull to beauty',
      hi: 'absorbed by beauty',
      score: 17,
      band: 'high',
      text: 'High scorers on this scale love beauty, both in art and in nature. They become easily involved and absorbed in artistic and natural events. They are not necessarily artistically trained nor talented, although many will be. The defining features of this scale are interest in, and appreciation of natural and artificial beauty. Low scorers lack aesthetic sensitivity and interest in the arts.'
    }, {
      name: 'Emotionality',
      lo: 'feelings kept in',
      hi: 'in touch with feelings',
      score: 16,
      band: 'high',
      text: 'Persons high on Emotionality have good access to and awareness of their own feelings. Low scorers are less aware of their feelings and tend not to express their emotions openly.'
    }, {
      name: 'Adventurousness',
      lo: 'prefers routine',
      hi: 'eager for the new',
      score: 15,
      band: 'high',
      text: 'High scorers on adventurousness are eager to try new activities, travel to foreign lands, and experience different things. They find familiarity and routine boring, and will take a new route home just because it is different. Low scorers tend to feel uncomfortable with change and prefer familiar routines.'
    }, {
      name: 'Intellect',
      lo: 'people over ideas',
      hi: 'plays with ideas',
      score: 19,
      band: 'high',
      text: 'Intellect and artistic interests are the two most important, central aspects of openness to experience. High scorers on Intellect love to play with ideas. They are open-minded to new and unusual ideas, and like to debate intellectual issues. They enjoy riddles, puzzles, and brain teasers. Low scorers on Intellect prefer dealing with either people or things rather than ideas. They regard intellectual exercises as a waste of time. Intellect should not be equated with intelligence. Intellect is an intellectual style, not an intellectual ability, although high scorers on Intellect score slightly higher than low-Intellect individuals on standardized intelligence tests.'
    }, {
      name: 'Liberalism',
      lo: 'values tradition',
      hi: 'challenges convention',
      score: 17,
      band: 'high',
      text: 'Psychological liberalism refers to a readiness to challenge authority, convention, and traditional values. In its most extreme form, psychological liberalism can even represent outright hostility toward rules, sympathy for law-breakers, and love of ambiguity, chaos, and disorder. Psychological conservatives prefer the security and stability brought by conformity to tradition. Psychological liberalism and conservatism are not identical to political affiliation, but certainly incline individuals toward certain political parties.'
    }]
  }, {
    id: 'A',
    name: 'Agreeableness',
    band: 'high',
    trait: 'pleasant, sympathetic, cooperative',
    def: 'Agreeableness reflects individual differences in concern with cooperation and social harmony. Agreeable individuals value getting along with others.',
    you: 'Your high level of Agreeableness indicates a strong interest in others\u2019 needs and well-being. You are pleasant, sympathetic, and cooperative.',
    facets: [{
      name: 'Trust',
      lo: 'guarded',
      hi: 'assumes good intent',
      score: 13,
      band: 'high',
      text: 'A person with high trust assumes that most people are fair, honest, and have good intentions. Persons low in trust see others as selfish, devious, and potentially dangerous.'
    }, {
      name: 'Morality',
      lo: 'guarded, strategic',
      hi: 'candid, sincere',
      score: 13,
      band: 'high',
      text: 'High scorers on this scale see no need for pretense or manipulation when dealing with others and are therefore candid, frank, and sincere. Low scorers believe that a certain amount of deception in social relationships is necessary. People find it relatively easy to relate to the straightforward high-scorers on this scale. They generally find it more difficult to relate to the unstraightforward low-scorers on this scale. It should be made clear that low scorers are not unprincipled or immoral; they are simply more guarded and less willing to openly reveal the whole truth.'
    }, {
      name: 'Altruism',
      lo: 'help feels imposed',
      hi: 'helping rewards',
      score: 13,
      band: 'high',
      text: 'Altruistic people find helping other people genuinely rewarding. Consequently, they are generally willing to assist those who are in need. Altruistic people find that doing things for others is a form of self-fulfillment rather than self-sacrifice. Low scorers on this scale do not particularly like helping those in need. Requests for help feel like an imposition rather than an opportunity for self-fulfillment.'
    }, {
      name: 'Cooperation',
      lo: 'will push back hard',
      hi: 'avoids confrontation',
      score: 17,
      band: 'high',
      text: 'Individuals who score high on this scale dislike confrontations. They are perfectly willing to compromise or to deny their own needs in order to get along with others. Those who score low on this scale are more likely to intimidate others to get their way.'
    }, {
      name: 'Modesty',
      lo: 'claims the credit',
      hi: 'self-effacing',
      score: 9,
      band: 'low',
      text: 'High scorers on this scale do not like to claim that they are better than other people. In some cases this attitude may derive from low self-confidence or self-esteem. Nonetheless, some people with high self-esteem find immodesty unseemly. Those who are willing to describe themselves as superior tend to be seen as disagreeably arrogant by other people.'
    }, {
      name: 'Sympathy',
      lo: 'reason over mercy',
      hi: 'tender-hearted',
      score: 16,
      band: 'high',
      text: 'People who score high on this scale are tenderhearted and compassionate. They feel the pain of others vicariously and are easily moved to pity. Low scorers are not affected strongly by human suffering. They pride themselves on making objective judgments based on reason. They are more concerned with truth and impartial justice than with mercy.'
    }]
  }, {
    id: 'C',
    name: 'Conscientiousness',
    band: 'high',
    trait: 'reliable, hard-working',
    def: 'Conscientiousness concerns the way in which we control, regulate, and direct our impulses.',
    you: 'Your score on Conscientiousness is high. This means you set clear goals and pursue them with determination. People regard you as reliable and hard-working.',
    facets: [{
      name: 'Self-Efficacy',
      lo: 'feels ineffective',
      hi: 'confident, capable',
      score: 15,
      band: 'high',
      text: 'Self-Efficacy describes confidence in one\u2019s ability to accomplish things. High scorers believe they have the intelligence (common sense), drive, and self-control necessary for achieving success. Low scorers do not feel effective, and may have a sense that they are not in control of their lives.'
    }, {
      name: 'Orderliness',
      lo: 'scattered',
      hi: 'well-organized',
      score: 11,
      band: 'low',
      text: 'Persons with high scores on orderliness are well-organized. They like to live according to routines and schedules. They keep lists and make plans. Low scorers tend to be disorganized and scattered.'
    }, {
      name: 'Dutifulness',
      lo: 'rules feel confining',
      hi: 'strong sense of duty',
      score: 13,
      band: 'high',
      text: 'This scale reflects the strength of a person\u2019s sense of duty and obligation. Those who score high on this scale have a strong sense of moral obligation. Low scorers find contracts, rules, and regulations overly confining. They are likely to be seen as unreliable or even irresponsible.'
    }, {
      name: 'Achievement-Striving',
      lo: 'content to get by',
      hi: 'driven to excel',
      score: 13,
      band: 'high',
      text: 'Individuals who score high on this scale strive hard to achieve excellence. Their drive to be recognized as successful keeps them on track toward their lofty goals. They often have a strong sense of direction in life, but extremely high scores may be too single-minded and obsessed with their work. Low scorers are content to get by with a minimal amount of work, and might be seen by others as lazy.'
    }, {
      name: 'Self-Discipline',
      lo: 'procrastinates',
      hi: 'sees tasks through',
      score: 14,
      band: 'high',
      text: 'Self-discipline-what many people call will-power-refers to the ability to persist at difficult or unpleasant tasks until they are completed. People who possess high self-discipline are able to overcome reluctance to begin tasks and stay on track despite distractions. Those with low self-discipline procrastinate and show poor follow-through, often failing to complete tasks-even tasks they want very much to complete.'
    }, {
      name: 'Cautiousness',
      lo: 'acts on impulse',
      hi: 'deliberates first',
      score: 18,
      band: 'high',
      text: 'Cautiousness describes the disposition to think through possibilities before acting. High scorers on the Cautiousness scale take their time when making decisions. Low scorers often say or do first thing that comes to mind without deliberating alternatives and the probable consequences of those alternatives.'
    }]
  }];
  window.BIG5_DEEP = DOMAINS;
  const kicker = {
    fontFamily: 'var(--sans)',
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: 'var(--ink-3)'
  };
  const bandStyle = {
    ...kicker,
    color: 'var(--ink-2)',
    whiteSpace: 'nowrap'
  };

  // one shared 4–20 track: hairline, a grey tick at the midpoint, dots for scores
  function Track({
    scores,
    size,
    height
  }) {
    const h = height || 22;
    return /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: 'relative',
        height: h
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 2,
        marginTop: -1,
        borderRadius: 999,
        background: 'var(--surface-3)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: '50%',
        left: `${pos(MID)}%`,
        transform: 'translate(-50%,-50%)',
        width: 2,
        height: 12,
        borderRadius: 2,
        background: 'var(--ink-3)'
      }
    }), scores.map((s, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        position: 'absolute',
        top: '50%',
        left: `${pos(s)}%`,
        transform: 'translate(-50%,-50%)',
        width: size,
        height: size,
        borderRadius: '50%',
        background: INK,
        border: '2px solid var(--surface)'
      }
    })));
  }

  // ── level one: five rows on the Big 5 tab; the open one unfolds in place ──
  function DomainRow({
    d,
    first,
    open,
    onToggle
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: first ? 'none' : '0.5px solid var(--rule)'
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => onToggle(d.id),
      "aria-expanded": open,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '15px 0',
        cursor: 'pointer',
        border: 'none',
        background: 'none',
        color: 'inherit',
        WebkitAppearance: 'none',
        appearance: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-0.015em',
        color: 'var(--ink)'
      }
    }, d.short || d.name), /*#__PURE__*/React.createElement("span", {
      style: bandStyle
    }, d.band)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 13.5,
        fontWeight: 500,
        color: 'var(--ink-2)'
      }
    }, d.trait), /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement(Track, {
      scores: d.facets.map(f => f.score),
      size: 10,
      height: 20
    }))), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        flexShrink: 0,
        display: 'inline-block',
        fontFamily: 'var(--sans)',
        fontSize: 20,
        lineHeight: 1,
        color: 'var(--ink-3)',
        transform: open ? 'rotate(90deg)' : 'none',
        transition: 'transform 0.22s var(--ease-out)'
      }
    }, '\u203a')), open ? /*#__PURE__*/React.createElement(DomainPanel, {
      d: d
    }) : null);
  }

  // ── level two: the domain unfolded under its row ──
  function DomainPanel({
    d
  }) {
    const [open, setOpen] = React.useState(null);
    const LW = 104; // label column; the axis is the rest
    return /*#__PURE__*/React.createElement("div", {
      style: {
        paddingBottom: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--serif)',
        fontSize: 17.5,
        fontWeight: 500,
        lineHeight: 1.35,
        color: 'var(--ink)',
        textWrap: 'pretty'
      }
    }, d.def), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        fontFamily: 'var(--sans)',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.45,
        color: 'var(--ink-2)',
        textWrap: 'pretty'
      }
    }, d.you), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 20,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: kicker
    }, "Facets"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, "tap one to read it")), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: 'absolute',
        top: 6,
        bottom: 22,
        left: `calc(${LW}px + (100% - ${LW}px - 30px) * ${pos(MID) / 100})`,
        width: 1,
        background: 'var(--ink-3)',
        opacity: 0.55
      }
    }), d.facets.map(f => {
      const on = open === f.name;
      const reading = f.band === 'high' ? f.hi : f.lo;
      return /*#__PURE__*/React.createElement("div", {
        key: f.name,
        style: {
          borderTop: '0.5px solid var(--rule)'
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "press",
        onClick: () => setOpen(on ? null : f.name),
        "aria-expanded": on,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          width: '100%',
          textAlign: 'left',
          padding: '10px 0',
          border: 'none',
          background: 'none',
          color: 'inherit',
          cursor: 'pointer',
          WebkitAppearance: 'none',
          appearance: 'none'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: LW,
          flexShrink: 0,
          paddingRight: 10,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--sans)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
          lineHeight: 1.2,
          textWrap: 'balance'
        }
      }, f.name), /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--sans)',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--ink-2)',
          lineHeight: 1.3,
          textWrap: 'pretty'
        }
      }, reading)), /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0,
          position: 'relative',
          height: 22
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 2,
          marginTop: -1,
          borderRadius: 999,
          background: 'var(--surface-3)'
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          top: '50%',
          left: `${pos(MIN)}%`,
          width: `${pos(f.score)}%`,
          height: 2,
          marginTop: -1,
          borderRadius: 999,
          background: INK,
          opacity: 0.35
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          top: '50%',
          left: `${pos(f.score)}%`,
          transform: 'translate(-50%,-50%)',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: INK,
          border: '2px solid var(--surface)'
        }
      })), /*#__PURE__*/React.createElement("span", {
        style: {
          width: 30,
          flexShrink: 0,
          textAlign: 'right',
          fontFamily: 'var(--sans)',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--ink)'
        }
      }, f.score)), on ? /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '0 0 14px',
          fontFamily: 'var(--sans)',
          fontSize: 13.5,
          fontWeight: 500,
          lineHeight: 1.55,
          color: 'var(--ink-2)',
          textWrap: 'pretty'
        }
      }, f.text) : null);
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 6,
        paddingLeft: LW,
        paddingRight: 30,
        borderTop: '0.5px solid var(--rule)',
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: 'var(--ink-3)'
      }
    }, /*#__PURE__*/React.createElement("span", null, MIN), /*#__PURE__*/React.createElement("span", null, "midpoint"), /*#__PURE__*/React.createElement("span", null, MAX))));
  }
  function Big5Deep() {
    const [open, setOpen] = React.useState(null);
    const toggle = id => setOpen(cur => cur === id ? null : id);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 26
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 4,
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: kicker
    }, "In depth"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, "five domains ", '\u00b7', " thirty facets")), /*#__PURE__*/React.createElement("div", null, DOMAINS.map((x, i) => /*#__PURE__*/React.createElement(DomainRow, {
      key: x.id,
      d: x,
      first: i === 0,
      open: open === x.id,
      onToggle: toggle
    }))));
  }
  window.Big5Deep = Big5Deep;
})();