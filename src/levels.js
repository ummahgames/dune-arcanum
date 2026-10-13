/** Authored chambers. Coordinates use the shared 8-column, 48-unit row grid. */
export const CHAPTERS = [
  { id: 0, name: 'The Sand Gate', subtitle: 'A light beneath the dunes', description: 'Restore the gatekeeper’s mosaic and learn the language of ricochets.', color: '#63d9c7', background: 'assets/sand-gate.svg' },
  { id: 1, name: 'The Lapis Court', subtitle: 'Every pattern has a weak point', description: 'Follow copper inlays through a courtyard of resilient blue ceramics.', color: '#749aff', background: 'assets/lapis-court.svg' },
  { id: 2, name: 'The Glass Observatory', subtitle: 'Catch a fallen constellation', description: 'Split starlight through ancient prisms and awaken the celestial instrument.', color: '#c298ff', background: 'assets/glass-observatory.svg' },
  { id: 3, name: 'The Atlas Vault', subtitle: 'The sky remembers your hands', description: 'Join the restored fragments into an atlas of places that no map can hold.', color: '#f1bf69', background: 'assets/atlas-vault.svg' },
];
const tile = (col, row, type = 'ceramic', hp = 1, group) => ({ col, row, type, hp, ...(group ? { group } : {}) });
const points = (coordinates, type = 'ceramic', hp = 1, group) => coordinates.map(([col, row]) => tile(col, row, type, hp, group));
const mirror = (col, row, orientation = 'horizontal') => ({ col, row, type: 'mirror', orientation });
const craft = (kind, target, label) => ({ kind, target, label });
function chamber(chapter, index, name, description, tiles, options = {}) {
  return {
    id: `chapter-${chapter + 1}-${index}`, chapter, index, name, description,
    objective: 'Clear every ceramic fragment to restore the mosaic.',
    par: 8, descent: 10, abilityCharges: { pierce: 0, echo: 0, lift: 0 },
    tiles, fixtures: [], waves: [], craft: craft('noAbility', 0, 'Restore without an ability'),
    tutorial: '', lore: '', finale: index === 6, ...options,
  };
}
export const LEVELS = [
  chamber(0, 1, 'First Light', 'A single beam can uncover a forgotten road.',
    points([[3, 3], [4, 3], [2, 1], [5, 1]]), {
      par: 4, descent: 0, craft: craft('hits', 2, 'Clear 2 fragments in one shot'),
      tutorial: 'Drag upward to aim, then release to launch. Follow the luminous guide. You can also use the angle slider and Launch.',
      lore: 'Beneath the first shell, a turquoise line points toward the horizon.',
    }),
  chamber(0, 2, 'Echoes of the Wall', 'The chamber’s edges are part of your instrument.',
    points([[0, 2], [0, 4], [1, 1], [6, 1], [7, 2], [7, 4]]), {
      par: 5, descent: 0, craft: craft('bank', 1, 'Make a wall-bank hit'),
      tutorial: 'Aim into a side wall to reach the outer fragments. Wall rebounds keep the orb alive.',
      lore: 'The gate builders polished their walls as carefully as their mirrors.',
    }),
  chamber(0, 3, 'The Moving Sands', 'Dust falls after each shot. Read the danger line.',
    points([[1, 1], [3, 1], [4, 1], [6, 1], [2, 3], [5, 3], [3, 5], [4, 5]]), {
      par: 7, descent: 8, craft: craft('hits', 3, 'Clear 3 fragments in one shot'),
      tutorial: 'After each shot, targets descend. Anything crossing the amber danger line ends the attempt. Restart is always free.',
      lore: 'The sand clock has no numbers. Its measure is the courage of a chosen angle.',
    }),
  chamber(0, 4, 'The Still Water', 'An anchored mirror holds its ground while the dust falls.',
    points([[1, 1], [2, 1], [5, 1], [6, 1], [1, 3], [6, 3], [2, 5], [5, 5]]), {
      fixtures: [mirror(3, 3, 'vertical'), mirror(4, 3, 'vertical')],
      par: 7, descent: 8, craft: craft('bank', 2, 'Make 2 wall-bank hits'),
      tutorial: 'Silver mirrors are permanent fixtures. They reflect your orb, never descend, and do not need clearing.',
      lore: 'Two silver reeds guard a pool that has not seen water for centuries.',
    }),
  chamber(0, 5, 'Copper Thread', 'Find the weak bead in each connected necklace.',
    [...points([[1, 2], [2, 2], [2, 1]], 'linked', 1, 'west'), ...points([[5, 1], [5, 2], [6, 2]], 'linked', 1, 'east'), ...points([[3, 4], [4, 4], [1, 4], [6, 4]])], {
      par: 6, descent: 9, craft: craft('chain', 3, 'Break a chain of 3 fragments'),
      tutorial: 'Copper-linked fragments pass damage along their inlay when they break. Strike one to unravel the pattern.',
      lore: 'A patient hand once laid these threads so a stranger could follow them home.',
    }),
  chamber(0, 6, 'The Gate of Eight', 'Unseal the eight-point gate, then touch its heart.',
    [...points([[2, 1], [3, 1], [4, 1], [5, 1]], 'linked', 1, 'crown'), ...points([[1, 2], [6, 2], [1, 3], [6, 3]]), ...points([[2, 4], [5, 4]], 'reinforced', 2), tile(3, 3, 'core', 2)], {
      fixtures: [mirror(4, 5, 'horizontal')], abilityCharges: { pierce: 1, echo: 0, lift: 1 },
      par: 9, descent: 9, craft: craft('chain', 4, 'Unravel the 4-piece crown'),
      objective: 'Clear the gate’s fragments, then break the awakened atlas heart.',
      tutorial: 'The golden heart is protected until all other fragments are gone. Pierce crosses two targets; Lift buys one step of breathing room.',
      lore: 'The gate opens onto a courtyard where blue stone holds the memory of rain.',
    }),
  chamber(1, 1, 'Rain on Lapis', 'Return to the same ceramic from another angle.',
    [...points([[1, 1], [6, 1], [2, 3], [5, 3]], 'reinforced', 2), ...points([[3, 1], [4, 1], [1, 4], [6, 4]])], {
      par: 8, descent: 10, abilityCharges: { pierce: 1, echo: 0, lift: 1 },
      craft: craft('hits', 4, 'Score 4 impacts in one shot'),
      tutorial: 'Lapis ceramics take multiple impacts. Their numbers and cracks show how much strength remains.',
      lore: 'Each blue shell carries two layers: one for the rain, one for the dry years.',
    }),
  chamber(1, 2, 'The Needle Passage', 'Thread the gap, or use a little stored sunlight.',
    [...points([[1, 2], [2, 2], [3, 2], [5, 2], [6, 2]], 'reinforced', 2), ...points([[1, 0], [3, 0], [4, 0], [6, 0], [2, 4], [5, 4]])], {
      fixtures: [mirror(4, 4, 'vertical')], abilityCharges: { pierce: 2, echo: 0, lift: 1 },
      par: 9, descent: 10, craft: craft('hits', 5, 'Score 5 impacts in one shot'),
      tutorial: 'Select Pierce before launching. It damages and passes through the first two eligible targets.',
      lore: 'A slender opening divides the courtyard. The builders called it the needle’s eye.',
    }),
  chamber(1, 3, 'The Weaver’s Knot', 'The brightest bead is not always the best first target.',
    [...points([[2, 1], [3, 1], [4, 1], [5, 1]], 'linked', 2, 'upper'), tile(1, 1, 'linked', 1, 'upper'), ...points([[2, 4], [3, 4], [4, 4], [5, 4]], 'linked', 1, 'lower'), ...points([[1, 3], [6, 3]], 'reinforced', 2)], {
      par: 8, descent: 10, abilityCharges: { pierce: 1, echo: 0, lift: 1 },
      craft: craft('chain', 4, 'Unravel a 4-piece chain'),
      lore: 'The weaver hid a loose end in every knot. Perfection needed a way to breathe.',
    }),
  chamber(1, 4, 'Amber Reservoir', 'A sand seal turns a careful strike into a local cascade.',
    [tile(2, 2, 'seal'), tile(5, 2, 'seal'), ...points([[1, 2], [2, 1], [2, 3], [3, 2], [4, 2], [5, 1], [5, 3], [6, 2]], 'reinforced', 2), ...points([[3, 5], [4, 5]])], {
      par: 8, descent: 11, abilityCharges: { pierce: 1, echo: 0, lift: 1 },
      craft: craft('hits', 5, 'Score 5 impacts in one shot'),
      tutorial: 'Amber sand seals damage nearby fragments when broken. Their marked neighborhood travels with the board.',
      lore: 'The reservoirs never held water. They stored the last warmth of each evening.',
    }),
  chamber(1, 5, 'Four Courtyard Winds', 'Two crossing paths make room for a later arrival.',
    [...points([[1, 1], [6, 1], [2, 3], [5, 3]], 'reinforced', 2), ...points([[2, 1], [5, 1], [1, 4], [6, 4]])], {
      fixtures: [mirror(3, 2, 'slash'), mirror(4, 4, 'backslash')],
      waves: [{ turn: 3, tiles: points([[0, 0], [2, 0], [5, 0], [7, 0]], 'linked', 1, 'wind') }],
      par: 10, descent: 11, abilityCharges: { pierce: 1, echo: 0, lift: 2 },
      craft: craft('bank', 3, 'Make 3 wall-bank hits'),
      tutorial: 'A finite reinforcement wave is arriving after shot 3. The preview marks its entry slots.',
      lore: 'Four winds meet here, but no wind owns the center.',
    }),
  chamber(1, 6, 'The Peacock Arch', 'Lift the tail of the mosaic and release the hidden sun.',
    [...points([[0, 2], [1, 1], [2, 0], [3, 0], [4, 0], [5, 0], [6, 1], [7, 2]], 'linked', 1, 'arch'), ...points([[1, 3], [6, 3], [2, 4], [5, 4]], 'reinforced', 2), tile(3, 2, 'seal'), tile(4, 3, 'core', 3)], {
      fixtures: [mirror(3, 5, 'slash'), mirror(4, 5, 'backslash')],
      par: 10, descent: 11, abilityCharges: { pierce: 2, echo: 0, lift: 2 },
      craft: craft('chain', 5, 'Unravel 5 linked fragments'),
      objective: 'Restore the arch, then release its atlas heart.',
      lore: 'The restored arch is a fan of lapis feathers. Each feather marks a star yet to be found.',
    }),
  chamber(2, 1, 'A Second Star', 'A prism gives your light a companion.',
    [tile(3, 4, 'prism'), tile(4, 2, 'prism'), ...points([[1, 1], [6, 1], [2, 2], [5, 3], [1, 4], [6, 4]]), ...points([[3, 0], [4, 0]], 'reinforced', 2)], {
      par: 8, descent: 11, abilityCharges: { pierce: 1, echo: 1, lift: 1 },
      craft: craft('hits', 6, 'Score 6 impacts in one shot'),
      tutorial: 'Glass prisms emit one short-lived echo per shot. Echoes cannot split again. Echo also lets you launch a mirrored companion.',
      lore: 'The observatory measured the heavens with paired lights, so no star would travel alone.',
    }),
  chamber(2, 2, 'Orion’s Ladder', 'Climb a constellation with alternating banks.',
    [...points([[1, 0], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5]], 'linked', 1, 'ladder'), ...points([[6, 0], [5, 1], [2, 4], [1, 5]], 'reinforced', 2), tile(3, 4, 'prism'), tile(4, 1, 'prism')], {
      fixtures: [mirror(0, 3, 'slash'), mirror(7, 3, 'backslash')],
      par: 10, descent: 12, abilityCharges: { pierce: 1, echo: 2, lift: 2 },
      craft: craft('bank', 3, 'Make 3 wall-bank hits'),
      lore: 'A ladder of copper lights rises toward a hunter whose name changes with every traveler.',
    }),
  chamber(2, 3, 'Twin Moons', 'Two crescents leave a dark, useful corridor.',
    [...points([[1, 1], [0, 2], [0, 3], [1, 4], [6, 1], [7, 2], [7, 3], [6, 4]], 'reinforced', 2), ...points([[2, 0], [5, 0], [2, 5], [5, 5]]), tile(2, 3, 'prism'), tile(5, 3, 'prism')], {
      par: 10, descent: 12, abilityCharges: { pierce: 2, echo: 2, lift: 2 },
      craft: craft('hits', 7, 'Score 7 impacts in one shot'),
      lore: 'The atlas has two moons: one for the sky, and one for its reflection in a remembered sea.',
    }),
  chamber(2, 4, 'The Comet’s Wake', 'Clear the head and the tail follows.',
    [tile(1, 3, 'seal'), ...points([[1, 2], [2, 3], [2, 2], [3, 2], [4, 1], [5, 1], [6, 0]], 'linked', 1, 'comet'), ...points([[4, 4], [5, 4], [6, 3]], 'reinforced', 2), tile(3, 4, 'prism')], {
      fixtures: [mirror(6, 5, 'slash')],
      waves: [{ turn: 4, tiles: [tile(0, 0, 'prism'), tile(2, 0), tile(3, 0), tile(7, 0, 'reinforced', 2)] }],
      par: 11, descent: 12, abilityCharges: { pierce: 2, echo: 2, lift: 2 },
      craft: craft('chain', 5, 'Unravel a 5-piece chain'),
      lore: 'A comet is the sky writing quickly. The old astronomers learned to read its unfinished lines.',
    }),
  chamber(2, 5, 'The Lens Garden', 'Glass and copper turn scattered light into a single idea.',
    [tile(2, 2, 'prism'), tile(5, 2, 'prism'), tile(3, 4, 'seal'), tile(4, 4, 'seal'), ...points([[1, 1], [2, 1], [3, 1]], 'linked', 2, 'west'), ...points([[4, 1], [5, 1], [6, 1]], 'linked', 2, 'east'), ...points([[1, 4], [6, 4], [2, 5], [5, 5]])], {
      fixtures: [mirror(3, 3, 'vertical'), mirror(4, 3, 'vertical')],
      par: 11, descent: 12, abilityCharges: { pierce: 2, echo: 2, lift: 2 },
      craft: craft('hits', 8, 'Score 8 impacts in one shot'),
      lore: 'These flowers bloom only in reflected light. No gardener ever watered them.',
    }),
  chamber(2, 6, 'The Celestial Orrery', 'Free the orbiting fragments, then wake the instrument.',
    [...points([[2, 0], [3, 0], [4, 0], [5, 0]], 'linked', 1, 'north'), ...points([[0, 2], [0, 3], [7, 2], [7, 3]], 'reinforced', 2), ...points([[2, 5], [3, 5], [4, 5], [5, 5]], 'linked', 1, 'south'), tile(1, 1, 'prism'), tile(6, 1, 'prism'), tile(1, 4, 'seal'), tile(6, 4, 'seal'), tile(3, 3, 'core', 3)], {
      fixtures: [mirror(2, 2, 'slash'), mirror(5, 2, 'backslash'), mirror(4, 4, 'horizontal')],
      par: 13, descent: 12, abilityCharges: { pierce: 2, echo: 3, lift: 2 },
      craft: craft('hits', 9, 'Score 9 impacts in one shot'),
      objective: 'Clear the orbits, then awaken the atlas heart.',
      lore: 'The orrery turns without a sound. Its smallest orbit marks the distance between two friends.',
    }),
  chamber(3, 1, 'Maps of Memory', 'Familiar materials form an unfamiliar crossing.',
    [...points([[1, 0], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5]], 'linked', 1, 'road'), ...points([[6, 0], [5, 1], [2, 4], [1, 5]], 'reinforced', 2), tile(1, 2, 'seal'), tile(6, 3, 'seal'), tile(3, 4, 'prism'), tile(4, 1, 'prism')], {
      par: 11, descent: 13, abilityCharges: { pierce: 2, echo: 2, lift: 2 },
      craft: craft('chain', 5, 'Unravel a 5-piece chain'),
      lore: 'Some maps remember roads. This one remembers why a traveler took them.',
    }),
  chamber(3, 2, 'The Brass Labyrinth', 'No locked door is the only door.',
    [...points([[0, 1], [1, 1], [2, 1], [5, 1], [6, 1], [7, 1], [2, 4], [5, 4]], 'reinforced', 2), ...points([[0, 3], [1, 3], [6, 3], [7, 3]], 'linked', 1, 'edges'), tile(3, 0, 'prism'), tile(4, 0, 'seal')], {
      fixtures: [mirror(3, 2, 'slash'), mirror(4, 4, 'backslash'), mirror(1, 5, 'vertical'), mirror(6, 5, 'vertical')],
      par: 12, descent: 13, abilityCharges: { pierce: 3, echo: 2, lift: 2 },
      craft: craft('bank', 4, 'Make 4 wall-bank hits'),
      lore: 'The labyrinth was built to offer choices. Its finest doorway has no frame.',
    }),
  chamber(3, 3, 'A Caravan of Stars', 'Make room for the final travelers before they arrive.',
    [...points([[1, 1], [2, 1], [5, 1], [6, 1]], 'linked', 2, 'caravan'), ...points([[0, 4], [7, 4], [2, 3], [5, 3]], 'reinforced', 2), tile(3, 2, 'prism'), tile(4, 4, 'seal')], {
      waves: [{ turn: 4, tiles: [tile(0, 0, 'seal'), tile(1, 0, 'linked', 1, 'arrival'), tile(2, 0, 'linked', 1, 'arrival'), tile(5, 0, 'linked', 1, 'arrival'), tile(6, 0, 'linked', 1, 'arrival'), tile(7, 0, 'prism')] }],
      par: 12, descent: 13, abilityCharges: { pierce: 2, echo: 3, lift: 3 },
      craft: craft('hits', 9, 'Score 9 impacts in one shot'),
      lore: 'Every light is a traveler. A constellation is the place where their stories cross.',
    }),
  chamber(3, 4, 'The Rose Compass', 'Four petals, four routes, one restored center.',
    [...points([[3, 0], [4, 0], [3, 1], [4, 1]], 'linked', 1, 'north'), ...points([[0, 2], [1, 2], [0, 3], [1, 3]], 'linked', 1, 'west'), ...points([[6, 2], [7, 2], [6, 3], [7, 3]], 'linked', 1, 'east'), ...points([[3, 4], [4, 4], [3, 5], [4, 5]], 'linked', 1, 'south'), tile(2, 2, 'prism'), tile(5, 3, 'prism'), tile(2, 4, 'seal'), tile(5, 1, 'seal')], {
      fixtures: [mirror(3, 3, 'slash'), mirror(4, 2, 'backslash')],
      par: 12, descent: 14, abilityCharges: { pierce: 2, echo: 3, lift: 3 },
      craft: craft('chain', 4, 'Unravel a complete 4-piece petal'),
      lore: 'North is only one answer. The rose compass also points toward wonder, patience, and return.',
    }),
  chamber(3, 5, 'The Last Quiet Room', 'A deliberate breath before the final restoration.',
    [...points([[1, 0], [3, 0], [4, 0], [6, 0], [1, 3], [6, 3]], 'reinforced', 3), ...points([[2, 2], [3, 2], [4, 2], [5, 2]], 'linked', 1, 'bridge'), tile(0, 2, 'seal'), tile(7, 2, 'seal'), tile(2, 4, 'prism'), tile(5, 4, 'prism')], {
      fixtures: [mirror(3, 5, 'slash'), mirror(4, 5, 'backslash')],
      par: 13, descent: 13, abilityCharges: { pierce: 3, echo: 3, lift: 3 },
      craft: craft('hits', 10, 'Score 10 impacts in one shot'),
      lore: 'On the vault’s threshold, the restorer finds a seat worn smooth by everyone who came before.',
    }),
  chamber(3, 6, 'The Atlas Awakens', 'Bring the sky, the court, and the gate into one luminous pattern.',
    [...points([[2, 0], [3, 0], [4, 0], [5, 0]], 'linked', 1, 'crown'), ...points([[0, 2], [1, 2], [6, 2], [7, 2]], 'linked', 1, 'wings'), ...points([[1, 4], [2, 5], [5, 5], [6, 4]], 'reinforced', 2), tile(2, 2, 'seal'), tile(5, 2, 'seal'), tile(1, 1, 'prism'), tile(6, 1, 'prism'), tile(3, 3, 'core', 3)], {
      fixtures: [mirror(2, 3, 'slash'), mirror(5, 3, 'backslash'), mirror(4, 5, 'horizontal')],
      waves: [{ turn: 5, tiles: points([[0, 0], [1, 0], [6, 0], [7, 0]], 'linked', 1, 'last-light') }],
      par: 15, descent: 14, abilityCharges: { pierce: 3, echo: 3, lift: 4 },
      craft: craft('hits', 12, 'Score 12 impacts in one shot'),
      objective: 'Restore every fragment and incoming wave, then awaken the final atlas heart.',
      lore: 'The atlas shows no borders. Only paths, lights, and the countless hands that kept them bright. Your journey becomes one of its stars.',
    }),
];

function hash(text) {
  let result = 2166136261;
  for (const character of String(text)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
function randomFor(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hash(seed);
  return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const clone = value => JSON.parse(JSON.stringify(value));
/** Daily layouts use tested chamber geometry; only their reflection varies. */
export function createDaily(dateKey) {
  const seed = hash(`astral-atlas-v2:${dateKey}`);
  const catalog = [8, 9, 12, 13, 14, 16, 18, 19, 21, 22];
  const level = clone(LEVELS[catalog[seed % catalog.length]]);
  if (seed & 1) {
    for (const t of level.tiles) t.col = 7 - t.col;
    for (const wave of level.waves) for (const t of wave.tiles) t.col = 7 - t.col;
    for (const f of level.fixtures) {
      f.col = 7 - f.col;
      if (f.orientation === 'slash') f.orientation = 'backslash';
      else if (f.orientation === 'backslash') f.orientation = 'slash';
    }
  }
  return { ...level, id: `daily-${dateKey}`, daily: true, dateKey, seed, name: 'Daily Mosaic', description: `${dateKey} · ${level.name}`, lore: 'A shared pattern beneath today’s sky. Its shape is the same for every traveler.' };
}
/** New endless batches stay sparse and finite, with HP capped at three. */
export function generateEndlessWave(round = 1, seed = 'dune-atlas') {
  const rng = randomFor(`${seed}:${round}`);
  const count = Math.min(5 + Math.floor(round / 2), 12);
  const slots = Array.from({ length: 24 }, (_, i) => [i % 8, Math.floor(i / 8)]);
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  return slots.slice(0, count).map(([col, row], i) => {
    const roll = rng();
    const type = round > 3 && roll < .12 ? 'prism' : round > 2 && roll < .24 ? 'seal' : roll < .47 ? 'linked' : round > 1 && roll < .73 ? 'reinforced' : 'ceramic';
    return tile(col, row, type, type === 'reinforced' ? Math.min(3, 2 + Math.floor(round / 9)) : 1, type === 'linked' ? `wave-${round}-${Math.floor(i / 3)}` : undefined);
  });
}
export function createEndless(seed = 'dune-atlas') {
  return chamber(3, 0, 'The Endless Caravan', 'Restore one constellation after another. How far will your light travel?', generateEndlessWave(1, seed), {
    id: `endless-${seed}`, endless: true, seed, par: 999, descent: 12,
    abilityCharges: { pierce: 2, echo: 2, lift: 2 }, craft: craft('hits', 8, 'Score 8 impacts in one shot'),
    tutorial: 'Clear a batch to welcome the next constellation. Materials deepen over time; tile strength never exceeds three.',
    lore: 'There is always another light beyond the horizon.',
  });
}
/** Useful both at development time and before importing future chamber packs. */
export function validateLevels(levels = LEVELS) {
  const errors = [];
  const ids = new Set();
  const types = new Set(['ceramic', 'reinforced', 'linked', 'seal', 'prism', 'core']);
  for (const level of levels) {
    if (ids.has(level.id)) errors.push(`${level.id}: duplicate ID`);
    ids.add(level.id);
    const occupied = new Set();
    const inspect = (t, seen, label) => {
      const key = `${t.col},${t.row}`;
      if (!Number.isInteger(t.col) || t.col < 0 || t.col > 7 || !Number.isInteger(t.row) || t.row < 0 || t.row > 8) errors.push(`${level.id}: invalid ${label} coordinates`);
      if (seen.has(key)) errors.push(`${level.id}: overlapping ${label} at ${key}`);
      seen.add(key);
    };
    for (const t of level.tiles) {
      inspect(t, occupied, 'tile');
      if (!types.has(t.type) || !Number.isInteger(t.hp) || t.hp < 1 || t.hp > 3) errors.push(`${level.id}: invalid tile material/HP`);
    }
    for (const f of level.fixtures) {
      inspect(f, occupied, 'fixture');
      if (!['horizontal', 'vertical', 'slash', 'backslash'].includes(f.orientation)) errors.push(`${level.id}: invalid mirror orientation`);
    }
    for (const wave of level.waves) {
      if (!Number.isInteger(wave.turn) || wave.turn < 1) errors.push(`${level.id}: invalid wave turn`);
      const seen = new Set();
      for (const t of wave.tiles) {
        inspect(t, seen, 'wave');
        if (!types.has(t.type) || t.hp < 1 || t.hp > 3) errors.push(`${level.id}: invalid wave tile`);
        if (level.fixtures.some(f => f.col === t.col && f.row === t.row)) errors.push(`${level.id}: wave overlaps fixture`);
      }
    }
  }
  return errors;
}
