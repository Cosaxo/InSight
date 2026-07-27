// world-feed-comments.js — takes on the feed questions. Part of the
// pre-population promise: every question ships with a couple of live takes.
// opt = index of the option the commenter voted for (null on rankings).
window.WORLD_FEED_COMMENTS = {
  'tq-political-8': [
    { name: 'Omar K.', init: 'OK', opt: 1, time: '2h', ups: 167, text: 'My grandmother video-calls her sister across an ocean every day. Case closed.' },
    { name: 'Bea L.', init: 'BL', opt: 3, time: '6h', ups: 121, text: 'Better at what? Faster, sure. Happier is a different question.' },
  ],
  'tq-values-5': [
    { name: 'Nina R.', init: 'NR', opt: 0, time: '3h', ups: 143, text: 'Do the dishes first and the movie is twice as good.' },
    { name: 'Theo J.', init: 'TJ', opt: 4, time: '7h', ups: 98, text: 'The obligations never end. Take the joy when it shows up.' },
  ],
  'tq-attachment-2': [
    { name: 'Carla M.', init: 'CM', opt: 1, time: '4h', ups: 132, text: 'Showing up is 90% of friendship. The rest is snacks.' },
    { name: 'Idris A.', init: 'IA', opt: 2, time: '9h', ups: 74, text: 'I want to be that friend. Working on it.' },
  ],
  f01: [
    { name: 'Marco B.', init: 'MB', opt: 0, time: '3h', ups: 214, text: '90 minutes of flow, no ad breaks. Not close.' },
    { name: 'Dana W.', init: 'DW', opt: 1, time: '5h', ups: 158, text: 'The halftime show alone beats the entire final.' },
    { name: 'Lukas F.', init: 'LF', opt: 0, time: '1d', ups: 77, text: 'One game decides everything. That\u2019s sport.' },
  ],
  f02: [
    { name: 'Ines V.', init: 'IV', opt: 0, time: '2h', ups: 190, text: 'A gold medal is yours alone, forever.' },
    { name: 'Tom A.', init: 'TA', opt: 1, time: '6h', ups: 143, text: 'Nobody rewatches your 100m final at Christmas. World Cups live forever.' },
    { name: 'Rafa M.', init: 'RM', opt: 1, time: '1d', ups: 61, text: 'Ask any kid with a poster on their wall.' },
  ],
  f03: [
    { name: 'Yuki T.', init: 'YT', opt: null, time: '4h', ups: 201, text: 'Gymnasts do everything sprinters do, upside down.' },
    { name: 'Sam H.', init: 'SH', opt: null, time: '7h', ups: 88, text: 'Climbers are criminally underrated here.' },
  ],
  f04: [
    { name: 'Pete R.', init: 'PR', opt: 1, time: '2h', ups: 240, text: 'We traded 30 seconds of doubt for 4 minutes of lines.' },
    { name: 'Aisha B.', init: 'AB', opt: 0, time: '5h', ups: 129, text: 'Ask the fans who got robbed pre-VAR.' },
    { name: 'Jon D.', init: 'JD', opt: 1, time: '1d', ups: 96, text: 'Celebrating a goal now requires a lawyer.' },
  ],
  f05: [
    { name: 'Lena G.', init: 'LG', opt: 0, time: '3h', ups: 178, text: '80,000 people singing the same song. Nothing touches it.' },
    { name: 'Priya S.', init: 'PS', opt: 2, time: '8h', ups: 84, text: 'Center court at dusk is church.' },
    { name: 'Marcus T.', init: 'MT', opt: 1, time: '1d', ups: 66, text: 'Courtside you hear the sneakers squeak. Different sport.' },
  ],
  f06: [
    { name: 'Dev M.', init: 'DM', opt: 0, time: '2h', ups: 151, text: 'Pro gamers\u2019 reaction times are measurably elite.' },
    { name: 'Karl B.', init: 'KB', opt: 1, time: '6h', ups: 137, text: 'If you can do it in a hotel chair, it\u2019s a skill, not a sport.' },
  ],
  f07: [
    { name: 'Sofia B.', init: 'SB', opt: 1, time: '3h', ups: 199, text: 'The watching IS the point. The trophy is a bonus.' },
    { name: 'Chris D.', init: 'CD', opt: 0, time: '5h', ups: 168, text: 'My team never wins anything. Where do I sign?' },
  ],
  f08: [
    { name: 'Ana L.', init: 'AL', opt: 0, time: '2h', ups: 187, text: 'Pasta shapes alone outnumber most cuisines.' },
    { name: 'Ken T.', init: 'KT', opt: 1, time: '4h', ups: 142, text: 'Japanese does elegant AND comfort. Rare double.' },
    { name: 'Marta K.', init: 'MK', opt: 0, time: '1d', ups: 90, text: 'You will miss bread. Everyone misses bread.' },
  ],
  f09: [
    { name: 'June O.', init: 'JO', opt: 0, time: '1h', ups: 220, text: 'The cereal calibrates the milk. Physics.' },
    { name: 'Ben A.', init: 'BA', opt: 1, time: '9h', ups: 58, text: 'Same bowl either way. Eat your breakfast.' },
  ],
  f10: [
    { name: 'Omar F.', init: 'OF', opt: null, time: '2h', ups: 133, text: 'Fries winning is the least surprising data in history.' },
    { name: 'Kat W.', init: 'KW', opt: null, time: '6h', ups: 71, text: 'Mashed over crisps is a crime scene.' },
  ],
  f11: [
    { name: 'Nadia H.', init: 'NH', opt: 0, time: '3h', ups: 164, text: 'Same molecule, no animal. This is only weird culturally.' },
    { name: 'Ivo R.', init: 'IR', opt: 1, time: '7h', ups: 121, text: 'I don\u2019t eat software updates.' },
  ],
  f12: [
    { name: 'Rosa P.', init: 'RP', opt: 1, time: '2h', ups: 231, text: 'Dinner is the only meeting I never want to skip.' },
    { name: 'Leo C.', init: 'LC', opt: 0, time: '8h', ups: 89, text: 'Cooking is a chore dressed up as culture. Pill me.' },
  ],
  f13: [
    { name: 'Elif K.', init: 'EK', opt: 0, time: '3h', ups: 118, text: 'Coffee, cream and regret. Perfect food.' },
    { name: 'Dan O.', init: 'DO', opt: 1, time: '6h', ups: 97, text: 'Cheesecake is the only dessert that\u2019s also breakfast.' },
  ],
  f14: [
    { name: 'Femi A.', init: 'FA', opt: 0, time: '1h', ups: 176, text: 'Pain is just flavor with commitment.' },
    { name: 'Hana K.', init: 'HK', opt: 1, time: '5h', ups: 104, text: 'I want to taste my food, not survive it.' },
  ],
  f15: [
    { name: 'Jonas W.', init: 'JW', opt: 1, time: '4h', ups: 156, text: 'Jaws the movie beats the book and it\u2019s not close.' },
    { name: 'Ruth E.', init: 'RE', opt: 0, time: '7h', ups: 93, text: 'Books let you cast everyone yourself.' },
  ],
  f16: [
    { name: 'Diego V.', init: 'DV', opt: null, time: '3h', ups: 84, text: 'Documentaries last is exactly right \u2014 you can\u2019t unlearn the twist.' },
    { name: 'Maya R.', init: 'MR', opt: null, time: '9h', ups: 62, text: 'Comedies age with you. Correct crowd.' },
  ],
  f17: [
    { name: 'Ingrid M.', init: 'IM', opt: 1, time: '2h', ups: 143, text: 'Space opera has no fresh bread. Cozy fantasy it is.' },
    { name: 'Luc F.', init: 'LF', opt: 0, time: '6h', ups: 117, text: 'I did not sign up for a quiet life. Give me the stars.' },
  ],
  f18: [
    { name: 'Marta K.', init: 'MK', opt: 0, time: '2h', ups: 201, text: 'You\u2019re not watching it, you\u2019re clearing it.' },
    { name: 'Pete R.', init: 'PR', opt: 1, time: '5h', ups: 149, text: 'Directors pad, I trim. We\u2019re even.' },
  ],
  f19: [
    { name: 'Sam H.', init: 'SH', opt: 1, time: '3h', ups: 122, text: 'Two hours is a promise a movie can keep.' },
    { name: 'Ana L.', init: 'AL', opt: 2, time: '8h', ups: 55, text: 'If it\u2019s great, I never want it to end.' },
  ],
  f20: [
    { name: 'Sofia B.', init: 'SB', opt: 1, time: '2h', ups: 187, text: 'The first time only happens once. Guard it.' },
    { name: 'Dev M.', init: 'DM', opt: 0, time: '4h', ups: 98, text: 'Studies keep showing spoiled readers enjoy stories more.' },
  ],
  f21: [
    { name: 'Ken T.', init: 'KT', opt: 1, time: '3h', ups: 173, text: 'You hum melodies in the shower, not lyrics.' },
    { name: 'June O.', init: 'JO', opt: 0, time: '7h', ups: 130, text: 'A great line lives in your head for decades.' },
  ],
  f22: [
    { name: 'Omar F.', init: 'OF', opt: null, time: '2h', ups: 91, text: 'Small club #1 is right \u2014 you feel the kick drum in your ribs.' },
    { name: 'Elif K.', init: 'EK', opt: null, time: '8h', ups: 64, text: 'Festivals are for the story, not the sound.' },
  ],
  f23: [
    { name: 'Marcus T.', init: 'MT', opt: 1, time: '3h', ups: 158, text: 'It\u2019s the sitting down and listening that sounds better.' },
    { name: 'Ivo R.', init: 'IR', opt: 0, time: '9h', ups: 72, text: 'Warmth is real. Fight me.' },
  ],
  f24: [
    { name: 'Nadia H.', init: 'NH', opt: 1, time: '2h', ups: 119, text: 'Words in songs use the same brain as words in work.' },
    { name: 'Kat W.', init: 'KW', opt: 0, time: '5h', ups: 95, text: 'Silence lets the anxious thoughts in. Never.' },
  ],
  f25: [
    { name: 'Dan O.', init: 'DO', opt: 0, time: '4h', ups: 141, text: 'The 70s invented everything the 2000s remixed.' },
    { name: 'Priya S.', init: 'PS', opt: 1, time: '7h', ups: 126, text: 'Peak pop, peak hip-hop, first streaming. Easy.' },
  ],
  f26: [
    { name: 'Karl B.', init: 'KB', opt: 1, time: '2h', ups: 265, text: 'My phone already knows too much and it\u2019s OUTSIDE my skull.' },
    { name: 'Leo C.', init: 'LC', opt: 0, time: '6h', ups: 108, text: 'Glasses were once creepy too.' },
  ],
  f27: [
    { name: 'Ruth E.', init: 'RE', opt: 0, time: '3h', ups: 190, text: 'Teachers voted with detention slips years ago.' },
    { name: 'Diego V.', init: 'DV', opt: 1, time: '8h', ups: 112, text: 'The phones aren\u2019t leaving the world. Teach the world.' },
  ],
  f28: [
    { name: 'Chris D.', init: 'CD', opt: null, time: '3h', ups: 77, text: 'Maps second? You\u2019ve clearly never been lost lost.' },
    { name: 'Hana K.', init: 'HK', opt: null, time: '6h', ups: 145, text: 'Social feeds dead last says everything.' },
  ],
  f29: [
    { name: 'Maya R.', init: 'MR', opt: 0, time: '2h', ups: 133, text: 'Every embarrassing photo, gone. Freedom.' },
    { name: 'Jonas W.', init: 'JW', opt: 1, time: '7h', ups: 81, text: 'My data is my diary. Keep it.' },
  ],
  f30: [
    { name: 'Ingrid M.', init: 'IM', opt: 1, time: '3h', ups: 172, text: 'I\u2019ll do my own dishes, thanks. Cheaper than surveillance.' },
    { name: 'Luc F.', init: 'LF', opt: 0, time: '5h', ups: 154, text: 'My phone already listens and doesn\u2019t even fold laundry.' },
  ],
  f31: [
    { name: 'Dev M.', init: 'DM', opt: 0, time: '2h', ups: 129, text: 'It doesn\u2019t text, drink or rage. Get in.' },
    { name: 'Rosa P.', init: 'RP', opt: 1, time: '6h', ups: 98, text: 'I want someone to yell at. Not yet.' },
  ],
  f32: [
    { name: 'June O.', init: 'JO', opt: 0, time: '1h', ups: 244, text: 'Pay people wages, print the real price. Done.' },
    { name: 'Femi A.', init: 'FA', opt: 1, time: '7h', ups: 89, text: 'In some rooms it\u2019s the only raise anyone gets.' },
  ],
  f33: [
    { name: 'Sofia B.', init: 'SB', opt: 0, time: '3h', ups: 167, text: 'Early is on time. On time is late.' },
    { name: 'Ben A.', init: 'BA', opt: 1, time: '8h', ups: 103, text: 'Arriving early just moves the waiting to a hallway.' },
  ],
  f34: [
    { name: 'Lena G.', init: 'LG', opt: null, time: '2h', ups: 96, text: 'Big night out at #3 means we\u2019re all getting old together.' },
    { name: 'Kat W.', init: 'KW', opt: null, time: '9h', ups: 58, text: 'Full-reset clean is the real luxury.' },
  ],
  f35: [
    { name: 'Marco B.', init: 'MB', opt: 1, time: '4h', ups: 152, text: 'Old enough to afford it, young enough to enjoy it.' },
    { name: 'Ruth E.', init: 'RE', opt: 3, time: '1d', ups: 47, text: '75 with health is the cheat code nobody picks.' },
  ],
  f36: [
    { name: 'Ana L.', init: 'AL', opt: 0, time: '3h', ups: 128, text: 'The ocean never shows you the same thing twice.' },
    { name: 'Ivo R.', init: 'IR', opt: 1, time: '6h', ups: 115, text: 'Mountains change with the light. And no hurricanes.' },
  ],
  f37: [
    { name: 'Nadia H.', init: 'NH', opt: 0, time: '2h', ups: 139, text: 'Every big conversation I\u2019ve had started as a small one.' },
    { name: 'Karl B.', init: 'KB', opt: 1, time: '7h', ups: 122, text: 'We both know we\u2019re performing. Let me go.' },
  ],
  f38: [
    { name: 'Ingrid M.', init: 'IM', opt: 1, time: '2h', ups: 287, text: 'Every friendship survives on unsaid things.' },
    { name: 'Dan O.', init: 'DO', opt: 0, time: '8h', ups: 76, text: 'I\u2019d take it just for negotiations.' },
  ],
  f39: [
    { name: 'Marta K.', init: 'MK', opt: 1, time: '3h', ups: 312, text: 'The 13% pressing this are why we have laws.' },
    { name: 'Diego V.', init: 'DV', opt: 0, time: '9h', ups: 104, text: 'A stranger somewhere loses everything every day. I just don\u2019t see it.' },
  ],
  f40: [
    { name: 'Hana K.', init: 'HK', opt: 1, time: '2h', ups: 233, text: 'The countdown would be the only thing I think about.' },
    { name: 'Leo C.', init: 'LC', opt: 0, time: '6h', ups: 118, text: 'I\u2019d finally stop wasting Tuesdays.' },
  ],
  f41: [
    { name: 'Omar F.', init: 'OF', opt: 0, time: '1h', ups: 276, text: 'I hate my job now and there\u2019s no exit date. Deal.' },
    { name: 'Priya S.', init: 'PS', opt: 1, time: '7h', ups: 141, text: 'Five years is 6% of a life. Too rich.' },
  ],
  f42: [
    { name: 'Rosa P.', init: 'RP', opt: 1, time: '3h', ups: 298, text: 'Everyone I love exists because of my wrong turns.' },
    { name: 'Ben A.', init: 'BA', opt: 0, time: '8h', ups: 187, text: 'Buying certain stocks at 12 sounds fine to me.' },
  ],
  f43: [
    { name: 'Yuki T.', init: 'YT', opt: 1, time: '2h', ups: 224, text: 'Forgetting is a feature. Ask anyone with a grudge.' },
    { name: 'Chris D.', init: 'CD', opt: 0, time: '9h', ups: 92, text: 'I\u2019d never lose my keys or an argument again.' },
  ],
  f44: [
    { name: 'Elif K.', init: 'EK', opt: 1, time: '2h', ups: 209, text: 'I don\u2019t need him to talk. I need him to get me.' },
    { name: 'Lena G.', init: 'LG', opt: 0, time: '4h', ups: 133, text: 'One day is enough to learn where it itches.' },
  ],
  f45: [
    { name: 'Marcus T.', init: 'MT', opt: 0, time: '3h', ups: 156, text: 'We mandate jury duty. Democracy can cost you a Tuesday.' },
    { name: 'Luc F.', init: 'LF', opt: 1, time: '7h', ups: 134, text: 'Forced votes are noise, not signal.' },
  ],
  f46: [
    { name: 'Dev M.', init: 'DM', opt: 0, time: '2h', ups: 218, text: 'Every pilot study says the same thing. It\u2019s coming.' },
    { name: 'Karl B.', init: 'KB', opt: 1, time: '8h', ups: 97, text: 'Your boss read those studies too. Notice nothing changed.' },
  ],
  f47: [
    { name: 'June O.', init: 'JO', opt: 0, time: '3h', ups: 183, text: 'Every city that tried it kept it. Every one.' },
    { name: 'Ivo R.', init: 'IR', opt: 1, time: '6h', ups: 121, text: 'Great until you\u2019re carrying a couch.' },
  ],
  f48: [
    { name: 'Ana L.', init: 'AL', opt: 0, time: '2h', ups: 147, text: 'Home is a person, not a postcode.' },
    { name: 'Marta K.', init: 'MK', opt: 1, time: '7h', ups: 109, text: 'Visiting is romance. Living is paperwork.' },
  ],
  f49: [
    { name: 'Ruth E.', init: 'RE', opt: 1, time: '3h', ups: 176, text: 'The money goes to the artist. There\u2019s no separating that.' },
    { name: 'Dan O.', init: 'DO', opt: 0, time: '8h', ups: 138, text: 'Half the canon is gone if we don\u2019t.' },
  ],
  f50: [
    { name: 'Pete R.', init: 'PR', opt: 0, time: '6h', ups: 187, text: 'Sing. Act. Log off.' },
    { name: 'Diego V.', init: 'DV', opt: 1, time: '2h', ups: 149, text: 'They\u2019re citizens with microphones. Same rights, bigger volume.' },
  ],
  f51: [
    { name: 'Nadia H.', init: 'NH', opt: 0, time: '4h', ups: 112, text: 'Scientists actually answer follow-up questions.' },
    { name: 'Ken T.', init: 'KT', opt: 1, time: '7h', ups: 95, text: 'You can\u2019t hum a lecture afterwards.' },
  ],
  f52: [
    { name: 'Yuki T.', init: 'YT', opt: 0, time: '3h', ups: 231, text: 'You didn\u2019t choose your genes, parents or country. What\u2019s left?' },
    { name: 'Sofia B.', init: 'SB', opt: 1, time: '8h', ups: 144, text: 'The feeling of choosing is itself evidence.' },
  ],
  f53: [
    { name: 'Leo C.', init: 'LC', opt: 0, time: '2h', ups: 264, text: 'The math says yes. The distances say we\u2019ll never meet.' },
    { name: 'Karl B.', init: 'KB', opt: 1, time: '9h', ups: 118, text: 'Where is everybody, then?' },
  ],
  f54: [
    { name: 'Omar F.', init: 'OF', opt: 0, time: '1h', ups: 253, text: 'Money buys sleep, safety and dentists. That\u2019s happiness adjacent.' },
    { name: 'Ingrid M.', init: 'IM', opt: 1, time: '6h', ups: 172, text: 'Past rent and groceries, the graph goes flat.' },
  ],
  f55: [
    { name: 'Femi A.', init: 'FA', opt: 0, time: '3h', ups: 196, text: 'Every generation thought the end was near. Every one was wrong.' },
    { name: 'Hana K.', init: 'HK', opt: 1, time: '8h', ups: 133, text: 'The graphs I see don\u2019t agree.' },
  ],
  f56: [
    { name: 'Rosa P.', init: 'RP', opt: null, time: '2h', ups: 154, text: 'People #1 by a landslide. The deathbed consensus.' },
    { name: 'Marcus T.', init: 'MT', opt: null, time: '7h', ups: 88, text: 'Legacy last \u2014 you won\u2019t be there to enjoy it.' },
  ],
};
