// Official Rendezvous'26 program lists. Numbers are the festival's program numbers.
// Premier runs 42-59, Junior runs 121-161. Seeded once on first run (see db.js);
// after that the admin owns the list and can add / edit / delete freely.

const PREMIER = [
  [42, 'Essay Malayalam'], [43, 'Essay English'], [44, 'Story Malayalam'], [45, 'Story English'],
  [46, 'Poem Malayalam'], [47, 'Poem English'], [48, 'LetterVerse'], [49, 'Pygmy Poem Arabic'],
  [50, 'Book Test'], [51, 'Written Translation Eng-Mal'], [52, 'Vocabulary Arabic'],
  [53, 'Watercoloring'], [54, 'Cartoon Scape'], [55, 'Caption Writing'], [56, 'Imla’'],
  [57, 'Handwriting English'], [58, 'Sudoku'], [59, 'Magazine']
];

const JUNIOR = [
  [121, 'Poem Malayalam'], [122, 'Poem English'], [123, 'Poem Arabic'], [124, 'Poem Urdu'],
  [125, 'Story Malayalam'], [126, 'Story English'], [127, 'Story Arabic'], [128, 'Story Urdu'],
  [129, 'Essay Malayalam'], [130, 'Essay English'], [131, 'Essay Arabic'], [132, 'Essay Urdu'],
  [133, 'Feature Writing'], [134, 'Madh Song Writing'], [135, 'Social Tweet English'],
  [136, 'Philosophical Slice'], [137, 'Risala Creation (Book Writing Arabic)'],
  [138, 'Abstract Writing English'], [139, 'Balaga Test'], [140, 'Book Criticism'],
  [141, 'Book Review'], [142, 'Sharhul Muthoon'], [143, 'Kithabic Test'], [144, 'Book Test'],
  [145, 'Talent Test'], [146, 'Fiqh Translation Ara-Eng'], [147, 'Written Translation Arabi-Mal'],
  [148, 'Written Translation Mal-Urd'], [149, 'Prompt Creation'], [150, 'Digital Drawing'],
  [151, 'Photography'], [152, 'Reel Creation'], [153, 'Calligraffiti'], [154, 'Project'],
  [155, 'Documentary Presentation'], [156, 'Shoot Out'], [157, 'Swimming'], [158, 'Data Story'],
  [159, 'Collage'], [160, 'Slogan Writing'], [161, 'Translation Critique']
];

// Programs performed/shown live are "stage"; everything else is judged from a submission.
const STAGE_NAMES = new Set(['Swimming', 'Shoot Out', 'Documentary Presentation', 'Talent Test']);
const LANGS = ['Malayalam', 'English', 'Arabic', 'Urdu'];

// If the name mentions exactly one language ("Essay Malayalam"), that is the program's language.
function languageOf(name) {
  const hits = LANGS.filter(l => new RegExp(`\\b${l}\\b`, 'i').test(name));
  return hits.length === 1 ? hits[0] : null;
}

function seedPrograms(db) {
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
  if (db.prepare("SELECT 1 FROM meta WHERE key = 'programs_seeded_v1'").get()) return;

  const insert = db.prepare(`INSERT OR IGNORE INTO programs (name, code, type, language, category, number)
    VALUES (?,?,?,?,?,?)`);
  const run = db.transaction(() => {
    for (const [category, list, prefix] of [['premier', PREMIER, 'P'], ['junior', JUNIOR, 'J']]) {
      for (const [number, name] of list) {
        insert.run(name, `${prefix}${number}`, STAGE_NAMES.has(name) ? 'stage' : 'writing', languageOf(name), category, number);
      }
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('programs_seeded_v1', datetime('now'))").run();
  });
  run();
}

module.exports = { seedPrograms, PREMIER, JUNIOR };
