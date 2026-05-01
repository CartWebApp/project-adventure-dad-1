import { dialog } from "./ui";

/**
 * @type {{ [spellName: string]: number[] }}
 */
const SPELLS = {
    'Mana Bolt': [3, 2, 1],
    'Magic Missile': [2, 4, 6],
    'Fireball': [5, 4, 1],

    'Cleanse': [1, 2, 3, 4],
    'Bloody Exchange': [6, 2, 4, 6],
    'Curse of the Plague': [2, 4, 6, 3],

    'Blessing of Life': [1, 4, 2, 5, 3, 4, 2],
    'Raise Dead': [2, 4, 6, 4, 1, 2],
    'Earthquake': [1, 2, 1, 2, 3, 2, 1],

    'Godlike': [1, 4, 2, 5, 3, 6, 2, 1],
    'Black Hole': [1, 2, 5, 3, 6, 4, 5],
    "Zeus's Blessing": [1, 3, 5, 6, 2, 4, 1, 3],
};
/**
 * @param {*} spellName 
 * @returns 
 */
async function castSpell(spellName) {
    const spell = (SPELLS[spellName]);
    if (!spell) {
        return null;
    }
    return spellName;
}
export { SPELLS, castSpell };