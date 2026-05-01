import { Player } from '../src/character.js';
import { pickEnemiesForDifficulty } from '../src/battle.js';
import { weapons } from '../src/obtainables.js';

import { playerMelee } from '../src/battle.js';

// Build a player with an equipped weapon of epic rarity from our weapons list if available
const p = new Player('MeleeTester','knight');

p.max_stamina = 100;
p.stamina = 100;

// find a weapon that has stats_by_rarity
const w = weapons.find(w => w.stats_by_rarity && w.stats_by_rarity.epic) || weapons[0];
// attach as equipped weapon with rarity
p.equipped.weapon = Object.assign({}, w, { rarity: 'epic' });

const enemies = pickEnemiesForDifficulty('easy');
const enemy = enemies[0];

const log = [];
console.log('Weapon used:', p.equipped.weapon.name);
console.log('Initial stamina:', p.stamina);
playerMelee(p, enemy, log);
console.log('After attack stamina:', p.stamina);
console.log('Enemy health after attack:', enemy.current_health);
console.log('Log:');
for (const l of log) console.log('-', l);
