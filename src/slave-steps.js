import { Execute, Branch, Dialog, Choice, Shop, Encounter, GiveItemByRarity, EncounterWith } from './story.js';
import { DIFFICULTY } from './constants.js';
import { items, potions } from './obtainables.js';

export function SlaveStory() {
    /**
     * @param {*} game
     * @returns {number}
     */
    const alignmentIndex = game => (game.player.alignment || 2) - 1;

    return (
        new Dialog('A merchant buys you and your sister.')
            .then(new Dialog('He brings you to the forest edge.'))
            .then(new Dialog('You are hesitant yet still enter the forest'))
            .then(new Dialog('You enter the cabin and you look through the shelves and find yourself some items and end up finding a chest.'))
            .then(new Dialog('A chest turns into a mimic!'))
            .then(EncounterWith("mimic", DIFFICULTY.EASY))
            .then(GiveItemByRarity("rare"))
            .then(new Dialog('You find a rare item on the mimic and leave to venture into the forest.'))

            .then(Encounter(DIFFICULTY.EASY))
            .then(Encounter(DIFFICULTY.MEDIUM))

            .then(
                Choice('You see an adventurer being attacked.', [
                    {
                        text: 'You save the adventurer',
                        next: new Execute(game => {
                            game.player.money += 100;
                        }).then(new Dialog('They thank you.')).then(Choice('Do you want them to join you?', [
                            {
                                text: 'Yes',
                                align: 1,
                                next: new Dialog('You now have a companion for your journey..')
                            },
                            {
                                text: 'No',
                                align: 2,
                                next: new Dialog('You leave to go on your own.')
                            }
                        ]))
                    },
                    {
                        text: 'Walk away.',
                        align: 3,
                        next: new Dialog('They will remember this decision.')
                    }
                ])
            )

            // SMALL FOREST CARAVAN
            .then(
                Choice('You find a traveling merchant.', [
                    {
                        text: 'Browse goods',
                        next: Shop('Traveling Merchant', [items.slice(0, 8), potions.slice(0, 5)])
                    },
                    {
                        text: 'Continue',
                        next: new Dialog('You continue deeper.')
                    }
                ])
            )

            // TEMPLE ENTRY
            .then(
                new Branch(alignmentIndex).with_branches(
                    new Dialog('You find the temple and enter in with your trusted companion.'),
                    new Dialog('You find and enter the temple'),
                    new Dialog('You find and enter the temple, but unbeknownst to you someone was following.')
                )
            )

            // ENDING
            .then(
                new Branch(alignmentIndex).with_branches(
                    new Dialog('You feel the cold hard steel of a blade as you trusted companion betrays you trust and stabs you, taking the treasure for themselves.'),
                    new Dialog('You finally obtain the treasure you were seeking and go to the merchant and trade for your sister\'s freedom going on to live your lives.'),
                    new Dialog('You find that the adventurer you left for dead has left you a note saying “For leaving me on my own I have a gift for you” and as you look down at the black powder and flammable oil you realize that opening the chest released a spark... You die.')
                )
            )

            .then(new Dialog('The story ends here.'))
    );
}
