import { select, dialog } from './ui.js';
import { items, potions, weapons, getArmorForRarity } from './obtainables.js';

// currency helper
/**
 * @param {*} copper
 * @returns {string}
 */
function formatMoney(copper) {
    const GOLD = 10000;
    const SILVER = 100;
    const g = Math.floor(copper / GOLD);
    const s = Math.floor((copper % GOLD) / SILVER);
    const c = copper % SILVER;
    const parts = [];
    if (g) parts.push(`${g}g`);
    if (s) parts.push(`${s}s`);
    if (c || parts.length === 0) parts.push(`${c}c`);
    return parts.join(' ');
}

/**
 * @param {*} obj
 * @returns {number}
 */
function priceOf(obj) {
    if (!obj) return 0;
    if (typeof obj.value === 'number') return obj.value;
    if (obj.costs && typeof obj.costs === 'object') {
        // prefer common cost
        return obj.costs.common ?? Object.values(obj.costs)[0] ?? 0;
    }
    // weapons may have costs_by_rarity or stats_by_rarity - fallback
    return 0;
}

/**
 * @param {import('./game.js').Game} game
 * @param {{ name: string, stock: any[] }} trader
 */
export async function openTrader(game, trader) {
    if (!game?.player) return;
    const player = game.player;
    const stock = trader.stock || [];
    if (stock.length === 0) {
        await dialog(`${trader.name} has nothing to sell right now.`);
        return;
    }

    const choices = stock.map(it => {
        const p = priceOf(it);
        const name = it.name || 'Unknown';
        const desc = it.description ? ` — ${it.description}` : '';
        const afford = (player.money || 0) >= p ? '' : ' (too expensive)';
        return `${name}${desc} — ${formatMoney(p)}${afford}`;
    });

    const choice = await select(
        `Welcome to ${trader.name}. What would you like?`,
        choices
    );
    const idx = choices.indexOf(choice);
    if (idx === -1) return;
    const selected = stock[idx];
    const cost = priceOf(selected);
    if ((player.money || 0) < cost) {
        await dialog("You don't have enough money for that.");
        return;
    }
    // confirm
    const confirm = await select(
        `Purchase ${selected.name} for ${formatMoney(cost)}?`,
        ['Yes', 'No']
    );
    if (confirm !== 'Yes') return;
    player.money = (player.money || 0) - cost;
    player.inventory = player.inventory || [];
    player.inventory.push(structuredClone(selected));
    await dialog(`You purchased ${selected.name} for ${formatMoney(cost)}.`);
}

// Traders
export const Alchemist = {
    name: 'Alchemist',
    stock: potions.slice()
};

export const Blacksmith = {
    name: 'Blacksmith',
    stock: [
        ...weapons.slice(),
        ...getArmorForRarity('common'),
        ...getArmorForRarity('rare')
    ]
};

export const GeneralStore = {
    name: 'General Store',
    stock: items.slice()
};
