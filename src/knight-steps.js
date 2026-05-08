import {
    Execute,
    Branch,
    Dialog,
    Choice,
    Shop,
    Encounter,
    GiveItemByName,
    GiveItemByRarity
} from './story.js';
import { DIFFICULTY } from './constants.js';
import { items, potions } from './obtainables.js';

// STEP 1 — Intro
export function KnightStory() {
    /**
     * @param {*} game
     * @returns {number}
     */
    const alignmentIndex = game => (game.player.alignment || 2) - 1;

    return (
        new Dialog('*knock* *knock* *knock* The noble lets you in.')
            .then(new Dialog('Leon: "What brings you in today?"'))
            .then(new Dialog('You: "May I continue seeing Sabine?"'))
            .then(new Dialog('Leon: "End this NOW."'))

            .then(
                Choice('How do you respond?', [
                    {
                        text: '"Ha you old man.. Engraned in your old ways. Just let me date your daughter it\'s not like this house has high standards anyway, considering you\'re the head."',
                        align: 3,
                        next: new Dialog('You leave with defiance.')
                    },
                    {
                        text: '"I won\'t give up! I\'ll make sure to prove you wrong eventually."',
                        align: 2,
                        next: new Dialog('You leave determined.')
                    },
                    {
                        text: '"I understand, I\'ll leave for now."',
                        align: 1,
                        next: new Dialog('You leave quietly.')
                    }
                ])
            )

            .then(new Dialog('Jhak approaches you.'))

            .then(
                new Branch(game => {
                    return (game.player.alignment || 2) - 1;
                }).with_branches(
                    // (Positive)
                    GiveItemByRarity('rare')
                        .then(
                            new Execute(game => {
                                game.player.money += 100;
                            })
                        )
                        .then(new Dialog('Your goal is commendable let me help you on this journey of your\'s. Succeed and I\'ll help you convince Leon.')),

                    // (Neutral)
                    GiveItemByRarity('common')
                        .then(
                            new Execute(game => {
                                game.player.money += 200;
                            })
                        )
                        .then(new Dialog('Here let me give you something before you go. You\'ve been a good knight I\'m sure you\'ll succeed.')),

                    // (Negative)
                    GiveItemByName('Basic Sword').then(
                        new Dialog('I heard what you said... This is no place for you, take this and go.')
                    )
                )
            )

            // TOWN HUB WITH SHOPS
            .then(
                Choice('Where do you go next?', [
                    {
                        text: 'Blacksmith',
                        next: Shop('Blacksmith Shop', items.slice(0, 10))
                    },
                    {
                        text: 'Alchemist',
                        next: Shop("Alchemist's Emporium", potions)
                    },
                    {
                        text: 'General Store',
                        next: Shop('General Store', items.slice(10, 20))
                    },
                    {
                        text: 'Forest',
                        next: new Dialog('You enter the forest.')
                    }
                ])
            )

            .then(Encounter(DIFFICULTY.EASY))
            .then(Encounter(DIFFICULTY.MEDIUM))
            .then(Encounter(DIFFICULTY.EASY))
            .then(Encounter(DIFFICULTY.EASY))
            .then(Encounter(DIFFICULTY.MEDIUM))

            .then(
                Choice('You find a lost adventurer.', [
                    {
                        text: 'You let them go along with you on your adventure',
                        align: 1,
                        next: new Dialog('They follow you.')
                    },
                    {
                        text: "You don't let them come with but you do give them directions back",
                        align: 2,
                        next: new Dialog('They leave.')
                    },
                    {
                        text: 'You feel that they may be dangerous and avoid them.',
                        align: 3,
                        next: new Dialog('You walk alone.')
                    }
                ])
            )

            .then(Encounter(DIFFICULTY.MEDIUM))
            .then(Encounter(DIFFICULTY.HARD))
            .then(Encounter(DIFFICULTY.EASY))

            // TEMPLE ENTRY
            .then(
                new Dialog(
                    'You enter the temple. It is quiet, but you sense that danger lurks within.'
                )
            )

            .then(Encounter(DIFFICULTY.MEDIUM))
            .then(Encounter(DIFFICULTY.HARD))
            .then(Encounter(DIFFICULTY.HARD))
            .then(Encounter(DIFFICULTY.HARD))

            .then(
                new Branch(alignmentIndex).with_branches(
                    new Dialog(
                        'You feel a cold blade and a distinct feeling of emptiness as you see a sword coming out of your body.'
                    ),
                    new Dialog(
                        'You take the treasure and accomplish the goal you set out for yourself.'
                    ),
                    new Dialog(
                        'You see the adventurer enter after you and run at you with their sword.'
                    )
                )
            )

            // ENDING
            .then(
                new Branch(alignmentIndex).with_branches(
                    new Dialog(
                        'As you die you feel a deep sense of betrayal. You were so close to your goal, but it was all for nothing.'
                    ),
                    new Dialog(
                        'You go back with the treasure and the noble finally accepts you with open arms.'
                    ),
                    new Dialog(
                        'You head back and realize maybe your original goal was too naive.'
                    )
                )
            )

            .then(new Dialog('The story ends here.'))
    );
}
