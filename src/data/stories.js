/* =====================================================================
   Aqua Zero Heavens Arena - fighter stories, creeds and rivalries
   Luminara Digital

   The roster already has dossiers: height, reach, three strengths, a
   signature. What it did not have is a reason to care. A dossier tells
   you what a fighter can do; it never tells you what they want, and a
   fighter who wants nothing is a stat block wearing a face.

   So every entry here answers five questions in the fighter's own voice:
   what are they chasing, what do they believe, what do they say to you
   at the bell, what do they say when you beat them, and what do they say
   when they beat you. Those five lines are the whole character budget -
   there is no cutscene coming, so each line has to carry.

   Everything is written off the real dossier. Yamsiri is from Phuket and
   has iron shins, so he talks about legs and about money. Horiuchi is
   fifty years old and still chain wrestling, so he talks about time.
   Nobody says "I will destroy you", because nobody who has actually done
   this for a living talks like that.

   Keyed by fighter INDEX, not name, so the table survives a rename and
   lines up with FIGHTERS without a lookup.

   Pure data and lookups. No rendering, no input, no save writes - the
   only thing that touches a save here is grudgeBonus, and it only reads.
   ===================================================================== */

const STORIES = {};
const RIVAL_LINE = {};      /* what they say when there is history in the air */
const REMATCH_LINE = {};    /* what they say when you have already beaten them */

/* One builder per fighter. The rival and rematch lines are split out of
   the STORIES entry on purpose: the entry shape stays exactly the five
   fields the card UI expects, and calloutFor owns the variants. */
function STORY(fid, o) {
  STORIES[fid] = { goal: o.goal, creed: o.creed, callout: o.callout,
                   respect: o.respect, grudge: o.grudge };
  RIVAL_LINE[fid] = o.rival || null;
  REMATCH_LINE[fid] = o.rematch || null;
}

/* --- 0  Akin "Divinus" Celsus - 18, Melbourne, Muay Thai / Lethwei --- */
/* Ogun Celsus's son. Polite, unhurried, and eighteen, which is the
   frightening part. He never raises his voice because he has never had
   to - the flying knee does the shouting. */
STORY(0, {
  goal: "To break his father's record before anyone can call him a veteran, and to be announced by his own first name.",
  creed: "The plum is a door. I only have to open it once.",
  callout: "My father was thirty before he had this. I am eighteen.",
  respect: "Good. Now I know what the gap actually feels like.",
  grudge: "You let me get the plum. Everybody lets me get the plum.",
  rival: "This one has history in it. Good. History makes people careless.",
  rematch: "You beat me once. I was seventeen then. I am not now.",
});

/* --- 1  Kwon Won-Ri "Pretty Boy" - 31, Daejeon, Taekwondo --- */
/* A showman who is also a genuine technician, which is rarer than it
   sounds. The nickname is not vanity about his face. It is vanity about
   the shape of the knockout. */
STORY(1, {
  goal: "To prove taekwondo is a fighting art and not a school sport, and to prove it by knockout so no judge can take it back.",
  creed: "If it did not look good, it did not count.",
  callout: "Watch my feet. Everyone watches my hands, and then they wake up.",
  respect: "You made it ugly. That was the only way you were winning.",
  grudge: "Ask them to play that one back slowly. That is the picture.",
  rival: "Grudges are good for the gate. They are terrible for your defence.",
  rematch: "You took my picture off the wall. I have painted a new one.",
});

/* --- 2  Zhang Kai "King Kai" - 21, Shaoyang, Wrestling / Wushu --- */
/* Wushu got him the cartwheel kick; wrestling got him everything else.
   He is aware which half the province respects and it is not the half
   they filmed. */
STORY(2, {
  goal: "To take the lightweight belt off Ruslan Magomedov and carry the first one home to Hunan.",
  creed: "The kick is the question. The shot is the answer.",
  callout: "You will guard high. You always guard high. Then I am at your knees.",
  respect: "I went low too early. Next time I make you honest first.",
  grudge: "In Shaoyang they said the wushu was dancing. Show them the tape.",
  rival: "Two camps, one answer. Mine is faster than yours has ever been.",
  rematch: "I have watched you win that fight four hundred times. It ends differently.",
});

/* --- 3  Paul Thomas "The English Gentleman" - 37, Salford, BJJ / Boxing --- */
/* Salford dry. The politeness is real and so is the anaconda, and he
   has never once seen a contradiction there. */
STORY(3, {
  goal: "To retire with the heavyweight belt and a clean record of never having said a bad word about anyone he put to sleep.",
  creed: "Manners cost nothing. Neither does the choke.",
  callout: "I will shake your hand first. After that I make no promises.",
  respect: "Well fought. I would say I was robbed, but I was not.",
  grudge: "Nothing personal. You put your head there, and I am a gentleman.",
  rival: "There is bad blood, apparently. I will still shake your hand.",
  rematch: "You had me once. I have thought about very little else since.",
});

/* --- 4  Ryoto Katou "Karate Boi" - 36, Yokohama, Shotokan --- */
/* One strike, one moment. He is the oldest kind of fighter on this card
   and he knows the sport thinks his style is a museum piece. */
STORY(4, {
  goal: "To end one fight at this level with a single clean reverse punch, and settle for good whether Shotokan travels.",
  creed: "One distance, one moment, one punch. The rest is waiting.",
  callout: "You cannot see the distance I am standing in. That is the whole fight.",
  respect: "I entered twice when once was enough. My error, not the style's.",
  grudge: "That was the one punch. Everything before it was only measuring.",
  rival: "Two schools, one distance. Only one of us may stand in it.",
  rematch: "I entered twice last time. Tonight I will enter once.",
});

/* --- 5  King Yamsiri "King" - 26, Phuket, Muay Thai --- */
/* Started at eight for purse money. Four hundred fights later the ring
   is an office and the leg kick is the invoice. Never theatrical. */
STORY(5, {
  goal: "To send enough home to Phuket that his brothers never take a fight for two thousand baht the way he did at eight.",
  creed: "The legs go first. Then the will. Then the man.",
  callout: "I have had four hundred fights. You are number four hundred and one.",
  respect: "You took the legs away from me. Not many people think to.",
  grudge: "Your lead leg told me in the first round. You did not listen.",
  rival: "The old grudges are for the crowd. The legs are for me.",
  rematch: "You beat me. Since then I have kicked a tree every morning.",
});

/* --- 6  Sanzo "Sumo" - 24, Kyoto, Sumo / Grappling --- */
/* Left the stable and was told that leaving made him nothing. Speaks
   formally, moves in one direction, and has never trained a retreat. */
STORY(6, {
  goal: "To prove the dohyo made a real fighter, after the stable told him that walking out of it made him nothing.",
  creed: "There is no retreating step in sumo. I never learned one.",
  callout: "In my old ring, one step back and you have already lost.",
  respect: "You moved. I could not make you stop moving. That is fair.",
  grudge: "I only had to walk forward. You did all the difficult work.",
  rival: "Two heavy men and one ring. Something has to leave it.",
  rematch: "You moved me last time. I have spent a year not moving.",
});

/* --- 7  Mataemon Aoki "Tobikan" - 27, Shizuoka, Judo --- */
/* A grip fighter's mind: the throw is already decided before anyone
   moves. Points bore him. Ippon is the only sentence he finishes. */
STORY(7, {
  goal: "To win by ippon every time out, because a judo man who wins on points has not really won anything.",
  creed: "The throw is decided at the grip. Everything after is arithmetic.",
  callout: "Give me one sleeve. One sleeve, and you will see the ceiling.",
  respect: "You never gave me the grip. I have no complaint. Only respect.",
  grudge: "Ippon. In my sport that word means the conversation is finished.",
  rival: "Your school and mine have argued for a century. Tonight, grips.",
  rematch: "You escaped the uchi-mata. I have added a second throw behind it.",
});

/* --- 8  Kazushi Horiuchi "The Hunter" - 50, Tokyo, Wrestling --- */
/* Fifty and still chain wrestling twenty-year-olds. Everything he says
   is about time, because time is the only opponent still ahead of him. */
STORY(8, {
  goal: "To keep taking fights until somebody finally makes him stop, and to make every kid on this card explain how a fifty-year-old took their back.",
  creed: "Wrestling does not get old. Only wrestlers do, and slowly.",
  callout: "I am fifty. I will still be behind you in the fifth round.",
  respect: "You outlasted me. Not many manage that. Go on, take it.",
  grudge: "Every year they tell me I am finished. Every year I take somebody's back.",
  rival: "Rivalry is a young man's word. I just like the wrestling.",
  rematch: "You beat a fifty-year-old once. Now beat him when he is annoyed.",
});

/* --- 9  Jairo Silva "The Prince" - 30, Belém, BJJ --- */
/* Warm, funny, and completely at home on his back, which unsettles
   people more than any amount of shouting would. */
STORY(9, {
  goal: "To win a title by submission from his back, so that people stop calling the guard a losing position.",
  creed: "My back on the mat is not trouble. It is my office.",
  callout: "Take me down. Please. I have been waiting all week for that.",
  respect: "Beautiful. You did not panic in the guard. Almost nobody manages that.",
  grudge: "You thought top position was winning. In Belém we call that a gift.",
  rival: "Ah, the famous bad blood. Come, let us roll about anyway.",
  rematch: "You passed my guard. I have been building a new one since.",
});

/* --- 10  Craig Beast "The Beast" - 37, Hom'la, Judo / BJJ / Boxing --- */
/* A late starter who got here on patience, and who quietly dislikes the
   nickname the promoters gave him. Three years the top contender. */
STORY(10, {
  goal: "To take the light heavyweight belt off Ogun Celsus before his own knees make that decision for him.",
  creed: "Judo taught me patience. Boxing taught me what to do when it runs out.",
  callout: "They call me the Beast. My coach in Hom'la called me punctual.",
  respect: "You were the better man tonight. I have been the worse man before.",
  grudge: "Hip in, arm across, goodnight. Twenty years to learn three seconds.",
  rival: "People want a war out of us. I only want the grip.",
  rematch: "You got up from the harai goshi. Nobody gets up from it twice.",
});

/* --- 11  Reinier Jansen "The Knight" - 33, Tilburg, Judo / BJJ --- */
/* Six foot four of Dutch bluntness and a guard you have to travel to
   get out of. Treats losing as a bug report. */
STORY(11, {
  goal: "To prove the Dutch judo school still makes finishers and not only medallists who never learned to submit anybody.",
  creed: "Long arms, long guard, long night for you.",
  callout: "You are shorter than me everywhere it matters. Come inside and find out.",
  respect: "Good. Honest. I will fix the sweep and we will do this again.",
  grudge: "One foot. That is all it takes. Then the legs do the talking.",
  rival: "So we are enemies now. Fine. It changes nothing about my guard.",
  rematch: "You beat me. I went home and fixed the sweep. Here it is.",
});

/* --- 12  Roland Finch - 20, Indianapolis, Submission grappling --- */
/* The only man on the card with no striking art at all, and he is
   cheerfully honest about it. Lowest rating here, biggest specialism. */
STORY(12, {
  goal: "To be the first pure grappler to take a title in a sport that will not stop telling him he needs a jab.",
  creed: "I do not need to hit you. I need thirty seconds behind you.",
  callout: "I have never thrown a punch in my life. I will not start.",
  respect: "You kept your hips free. That is the only defence, and you had it.",
  grudge: "Everyone laughs at the twister until their ribs point the wrong way.",
  rival: "Everybody has a rival. Mine is whoever says grapplers cannot win.",
  rematch: "You defended the twister. Statistically that does not happen twice.",
});

/* --- 13  Ruslan Magomedov "Sambo Prince" - 24, Derbent, Sambo --- */
/* Mountain discipline, no theatre. A belt in his village is a street's
   belt, not a man's, and he talks that way without ever explaining it. */
STORY(13, {
  goal: "To carry the lightweight belt back to Derbent, where a champion belongs to the whole street and not to himself.",
  creed: "Where I come from, the mat is the floor of the house.",
  callout: "You will stand up. I will put you down. All night.",
  respect: "You earned it. I will tell them at home that you earned it.",
  grudge: "You stood up six times. In Dagestan that is a compliment, not a defence.",
  rival: "They say we hate each other. I have never said that.",
  rematch: "At home they watched you beat me. That is why I am here.",
});

/* --- 14  Frank Mason - 38, Las Vegas, Kenpo / BJJ --- */
/* A gambler's cadence and eighteen years of the same trick still
   working. Fights for rent money and says so, which is its own dignity. */
STORY(14, {
  goal: "To get one more main event and one more purse big enough to keep the gym on Charleston open another year.",
  creed: "I was fighting before your coach could drive. It shows.",
  callout: "Vegas taught me the odds. Tonight the house is standing in front of you.",
  respect: "That is the game. I have taken more from it than it took from me.",
  grudge: "Overhand, then the arm-in. Same trick for eighteen years. Nobody reads it.",
  rival: "Bad blood sells tickets and my gym has rent. Let us go.",
  rematch: "You beat an old man once. Old men keep very detailed notes.",
});

/* --- 15  Mike Takayama "The Giant" - 40, Sumida, Wrestling --- */
/* Half Japanese, half American, never fully claimed by either, and
   carrying a country's heavyweight question on his own back. Slow-spoken
   because at two hundred and seventy-six pounds nothing needs rushing. */
STORY(15, {
  goal: "To be remembered as a Japanese heavyweight who mattered, in a country that stopped believing it could produce one.",
  creed: "I am not fast. I am not clever. I am here at the end.",
  callout: "There is nowhere in this ring I cannot reach in two steps.",
  respect: "You hit hard. Nobody has moved me like that in years.",
  grudge: "Two hundred and seventy-six pounds. Physics does not care about gameplans.",
  rival: "Everyone wants this fight. I want it to be short.",
  rematch: "You got out from under me. I have not slept properly since.",
});

/* --- 16  Tyson Reed "Thunder" - 34, Lincoln, Boxing --- */
/* Boxer's arrogance, entirely earned, plus one decision he will never
   accept. The switch is bait and everybody falls for the bait. */
STORY(16, {
  goal: "To take the welterweight belt back from Gregory Saint, who he is certain he beat on every card that mattered.",
  creed: "Boxing is not one of the arts here. It is the one that finishes.",
  callout: "Switch southpaw, you follow, and my hook is already waiting there.",
  respect: "Good hands. I have been in with champions who had worse.",
  grudge: "That is the check hook. Ask Saint why he only fought me backwards.",
  rival: "Now this is a fight. The rest of the card is filler.",
  rematch: "You beat me once. So you know the check hook is coming.",
});

/* --- 17  Randall Stevens "Wonder Boy" - 22, Greenville, Kenpo --- */
/* Southern manners over tournament-karate speed. He has heard the line
   about point fighters and a real punch roughly ten thousand times. */
STORY(17, {
  goal: "To answer the one line that follows him everywhere, that a point fighter cannot take a real punch, by never taking one.",
  creed: "You cannot hurt what you cannot touch. Ask the last four.",
  callout: "You get one clean shot at me tonight. Choose it carefully.",
  respect: "You closed the distance. I could not stop you closing it. Well done.",
  grudge: "Point fighting, they call it. Go and count the points.",
  rival: "Everybody says we have a problem. My problem is you touching me.",
  rematch: "You caught me clean. I have spent months learning not to be there.",
});

/* --- 18  Axel Vance "The Colossus" - 37, Ohio, Wrestling / Boxing --- */
/* Blue collar, zero charisma, proud of both. His whole career is an
   argument with people who make highlight reels. */
STORY(18, {
  goal: "To put every highlight-reel striker on this card through fifteen minutes on a fence and hand their record back ruined.",
  creed: "Nobody buys a ticket to watch me. Nobody leaves early either.",
  callout: "You have a beautiful highlight reel. None of it happens on the fence.",
  respect: "You got up. Most do not get up. That is the whole compliment.",
  grudge: "Fifteen minutes on the fence. Nobody ever enjoys the fifteenth.",
  rival: "Call it a rivalry if you like. It is still fifteen minutes on the fence.",
  rematch: "You beat me. Congratulations. Now do it again with a broken nose.",
});

/* --- 19  Gregory Saint "The Ram" - 21, Quebec, Kyokushin / BJJ --- */
/* Twenty-one, already the best welterweight, and deliberately boring
   about it. The politeness is not softness; it is a filing system. */
STORY(19, {
  goal: "To defend the welterweight belt so many times that nobody can keep arguing about the one decision people still argue about.",
  creed: "I do not need a new trick. I need the same one, on time.",
  callout: "The jab, then the double leg. You have seen the tape. It still works.",
  respect: "You solved it. I will go home and build something you have not seen.",
  grudge: "Same jab, same double leg, hundredth time. Knowing it is not stopping it.",
  rival: "I do not dislike you. I am simply going to be thorough.",
  rematch: "You found the hole. I have spent a whole camp filling it in.",
});

/* --- 20  Ogun Celsus "The Daemon King" - 37, Washington DC, MMA --- */
/* The top of the tower, and the only man here whose worst matchup shares
   his surname. Calm, tired, and completely aware of the clock. */
STORY(20, {
  goal: "To hold the light heavyweight belt long enough to hand it to his son rather than lose it to him.",
  creed: "Composure is the only weapon nobody can train out of you.",
  callout: "I have been champion since before you learned my name. Take your time.",
  respect: "You have it. Whatever it is, you have it. Do not waste it.",
  grudge: "Body first, always the body. The head only follows it down.",
  rival: "Everybody gets one great fight. I hope this is yours.",
  rematch: "You caught me once. I have watched it three hundred times since.",
});

/* --- 21  Derek Nichols "Crusher" - 37, Boulder, Wrestling --- */
/* American folkstyle and nothing else, from a town nobody has heard of.
   Says almost nothing that is not about position. */
STORY(21, {
  goal: "To prove the folkstyle they told him was useless after college is still the most brutal thing in the sport.",
  creed: "Everyone has a plan until they are carrying my weight.",
  callout: "Four years of college wrestling. Nobody in this building rode like that.",
  respect: "You got out. That is rare. I will be watching how you did it.",
  grudge: "That is a cradle. Grown men cry in that and nobody blames them.",
  rival: "Talk is fine. Nobody has ever talked their way off bottom.",
  rematch: "You beat me standing. I do not plan on standing tonight.",
});

/* --- 22  Timur Akhmedov "The Crusher" - 25, Moscow, Draka --- */
/* Draka is unfashionable and he likes that. Terse to the point of rude,
   and his entire ambition is that people learn one word. */
STORY(22, {
  goal: "To make people learn the word Draka, the way they had to learn sambo once Magomedov started winning.",
  creed: "There is nothing clever in it. That is why it works.",
  callout: "You will not know the name of the thing holding you down.",
  respect: "Good. Say the name of my style when they interview you.",
  grudge: "Crucifix. Both arms. Now nobody has to ask what Draka means.",
  rival: "You know my name now. That was the point of last time.",
  rematch: "You won. I changed nothing. I will only do it for longer.",
});

/* --- 23  Abrafo Ocasio "Helel" - 18, Washington DC, Muay Thai / TKD --- */
/* Akin's mirror down to the height and the arts, but the dossier says
   killer instinct where Akin's says cardio, and that is the difference
   in every line he speaks. */
STORY(23, {
  goal: "To finish every opponent Akin Celsus merely outpointed, until the comparison stops being a comparison.",
  creed: "Anyone can win. I am here for the part after winning.",
  callout: "They put me second on every list. Tonight we edit the list.",
  respect: "You are on the list now. Top of it. I do not forget lists.",
  grudge: "Everybody wants the finish. Very few will stay for it.",
  rival: "Good. I fight better when somebody actually wants to be here.",
  rematch: "You are the only name on my list. I wrote it in ink.",
});

/* --- 24  Sergio Newton "The Ronin" - 37, Lagos, Kickboxing --- */
/* One art, no country, no team, twenty years of other people's arenas.
   The nickname is not marketing, it is a description. */
STORY(24, {
  goal: "To finish his career with one belt, one art and no explanations, after twenty years of fighting in other people's countries.",
  creed: "One art, done properly, beats four done nearly.",
  callout: "I have fought in eleven countries. None of them were mine.",
  respect: "You had answers. It has been a long time since somebody had answers.",
  grudge: "Left hook, temple, done. Twenty years to make it look that simple.",
  rival: "Rivals, they tell me. At my age everybody is an old opponent.",
  rematch: "You beat me. It happens. It has not happened twice in twenty years.",
});

/* =====================================================================
   RIVALRIES

   A rivalry is only worth anything if you could have worked it out from
   the dossiers yourself - same division with only two men in it, the
   same finish from opposite continents, a shared surname, a shared
   birthday. Invented beef is noise; a reason you can verify on the card
   screen is a story.

   Fifteen pairs rather than a tidy ten, because at twenty-five fighters
   thirteen is the minimum that leaves nobody out, and a fighter with no
   nemesis is exactly the stat block this file exists to fix.
   ===================================================================== */
const RIVALRIES = [];
function R(a, b, reason) { RIVALRIES.push({ a, b, reason }); }

R(0, 20, "Father and son. Ogun put gloves on Akin at four years old and has spent fourteen years regretting how quickly the boy learned.");
R(0, 23, "Both eighteen, both six foot four, both raised on Muay Thai and jiu-jitsu in the same weight. The junior circuit split them one apiece and nobody has settled it since.");
R(10, 20, "The only two light heavyweights on the card. Beast has been the number one contender for three years and Celsus has never once said his name out loud.");
R(20, 24, "Born on the same day in July 1989, one in Washington and one in Lagos. Both are thirty-seven, both are running out of runway, and there is one belt between them.");
R(2, 13, "The entire lightweight division is these two men. Magomedov holds it, Zhang has never been given the fight, and the promoters keep pretending that is a coincidence.");
R(3, 14, "Two heavyweights who both end fights from the front headlock. Mason caught Thomas with the d'arce and Thomas has been immaculately polite about it ever since.");
R(6, 15, "Japanese heavyweights from opposite ends of the country and opposite traditions - Kyoto sumo against Tokyo wrestling. One of them is the answer to a question Japan keeps asking.");
R(15, 18, "Two wrestlers who win by leaning on people until the leaning becomes the fight. Neither has ever been taken down by the other, and both bring it up unprompted.");
R(7, 11, "Judo, Shizuoka against Tilburg. Aoki fights to take back something the Dutch school took off Japan a long time ago, and Jansen fights because that is a ridiculous reason.");
R(9, 12, "Jiu-jitsu from two continents. Silva learned it in a gi in Belém, Finch learned it off a laptop in Indiana, and each is convinced the other missed the point.");
R(16, 17, "Two American welterweights with nothing in common. Reed does not think point karate is fighting; Stevens has never been hit cleanly enough to have to argue.");
R(16, 19, "The welterweight belt. Saint took the decision, Reed has the scorecards framed above the heavy bag, and neither camp will agree to a date.");
R(1, 4, "Korea against Japan, and a spinning hook kick against a lunging reverse punch. Kwon says karate stopped evolving in 1950. Katou says taekwondo never started.");
R(21, 22, "Two middleweights with identical jobs - put you down, keep you there. Colorado folkstyle against Moscow draka, and only one of them gets to be the worst place in the sport.");
R(5, 8, "One welterweight problem with two answers. Yamsiri has never been taken down twice in a fight. Horiuchi has never failed to take anybody down twice.");

/* Built once so rivalOf is a lookup rather than a scan - the card screen
   asks this for every fighter in the grid, every frame. */
const RIVAL_INDEX = {};
RIVALRIES.forEach((r) => {
  (RIVAL_INDEX[r.a] || (RIVAL_INDEX[r.a] = [])).push(r.b);
  (RIVAL_INDEX[r.b] || (RIVAL_INDEX[r.b] = [])).push(r.a);
});

/* Copy on the way out so a caller sorting the list cannot corrupt the index. */
function rivalOf(fid) { return (RIVAL_INDEX[fid] || []).slice(); }

/* Symmetric on purpose - a rivalry read from either corner is the same
   rivalry, and the UI should never have to know which way round it was
   written down. */
function rivalryReason(a, b) {
  for (let i = 0; i < RIVALRIES.length; i++) {
    const r = RIVALRIES[i];
    if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) return r.reason;
  }
  return null;
}
const isRivalPair = (a, b) => rivalryReason(a, b) !== null;

/* =====================================================================
   LOOKUPS AND FALLBACKS

   The roster has been cut and remapped before (see the save migration),
   so a fighter index with no entry is a thing that can happen on a live
   save. A missing story must degrade into a plain, in-tone fighter -
   never into undefined on a card that is already drawing.
   ===================================================================== */

/* The globals may not exist yet depending on load order, so every read of
   them is guarded. This file must never be the reason a build fails. */
function safeBio(fid) {
  try { return (typeof bioOf === "function" ? bioOf(fid) : null) || null; }
  catch (e) { return null; }
}
const FALLBACK_STORY = {
  goal: "To climb the tower until somebody stops him, and to be hard work on the way up.",
  creed: "Show up in shape. Everything else is detail.",
  callout: "I have no speech for you. Let us find out at the bell.",
  respect: "You were better tonight. I will be better next time.",
  grudge: "That is the level. Come back when you have found it.",
};
/* Built from the dossier where there is one, so even a fighter nobody
   wrote lines for still sounds like themselves rather than like filler. */
function storyOf(fid) {
  const s = STORIES[fid];
  if (s) return s;
  const b = safeBio(fid);
  const art = b && b.sty && b.sty.length ? b.sty[0] : null;
  const out = { goal: FALLBACK_STORY.goal, creed: FALLBACK_STORY.creed,
                callout: FALLBACK_STORY.callout, respect: FALLBACK_STORY.respect,
                grudge: FALLBACK_STORY.grudge };
  if (art) {
    out.goal = "To prove that " + art + " belongs at the top of this card.";
    out.creed = "I have one art. I have never needed a second.";
    out.callout = "Everything I know is " + art + ". That has always been enough.";
  }
  return out;
}

/* =====================================================================
   WHAT THEY SAY AT THE BELL

   ctx = { first, beatenBefore, isRival }
     first        - you two have never met
     beatenBefore - YOU have already beaten this fighter (they want it back)
     isRival      - your fighter and this one are a pair in RIVALRIES

   Precedence, and the reasoning for it: a rematch is more personal than a
   rivalry, because a rivalry belongs to two camps and a loss belongs to
   one man. So beatenBefore wins over isRival, and a rival who has also
   been beaten gets the sharpest line of the three.

   The last case is the quiet one: you have met, they have never lost to
   you, so they have nothing to introduce and nothing to avenge. They just
   state their creed. A man who repeats his creed instead of talking to
   you is not being friendly.
   ===================================================================== */
function calloutFor(fid, ctx) {
  const s = storyOf(fid);
  const c = ctx || {};
  if (c.beatenBefore && REMATCH_LINE[fid]) return REMATCH_LINE[fid];
  if (c.isRival && RIVAL_LINE[fid]) return RIVAL_LINE[fid];
  if (c.first) return s.callout;
  if (c.beatenBefore || c.isRival) return s.callout;   /* no variant written */
  return s.creed || s.callout;
}

/* =====================================================================
   GRUDGE

   The rule this encodes: losing to someone should change them. A fighter
   who has put you away comes back having watched the tape, and the card
   screen can say so.

   It is capped hard at 1.15 because the point is texture, not a wall. A
   grudge that actually gates progress turns a story beat into a tax, and
   the player who is already losing to this man is exactly the player who
   least needs the extra 30%. Beating them bleeds the bonus back off,
   so the escalation has an exit rather than a ratchet.
   ===================================================================== */
const GRUDGE_CONFIG = {
  floor: 1.0,          /* never a debuff - a grudge does not make you worse */
  cap: 1.15,           /* hard ceiling, flavour not a wall */
  perLoss: 0.045,      /* each time this fighter beat you */
  maxLosses: 3,        /* past three it stops climbing, or a bad run snowballs */
  perWin: 0.02,        /* each time you beat them, some heat comes back off */
  rivalEdge: 0.03,     /* a declared rivalry adds a little, once they have a win */
  minLossesToTalk: 1,  /* wins over you needed before the UI calls it a grudge */
};

/* Reads save.fr[fid] = { w, l } as written by bumpFighter: w is YOUR wins
   over them, l is YOUR losses to them - so l is what makes them dangerous.
   heroFid is optional; pass the fighter you picked and a real rivalry
   between the two adds its edge on top. Reads only, never writes. */
function grudgeBonus(save, fid, heroFid) {
  const g = GRUDGE_CONFIG;
  const rec = (save && save.fr && save.fr[fid]) || null;
  const lost = rec ? (rec.l || 0) : 0;     /* times they beat you */
  const won = rec ? (rec.w || 0) : 0;      /* times you beat them */
  if (lost < g.minLossesToTalk) return g.floor;
  let m = g.floor + g.perLoss * Math.min(lost, g.maxLosses) - g.perWin * won;
  if (heroFid !== undefined && heroFid !== null && isRivalPair(heroFid, fid)) m += g.rivalEdge;
  if (m > g.cap) m = g.cap;
  if (m < g.floor) m = g.floor;
  return m;
}
