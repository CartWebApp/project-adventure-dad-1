import {
    Execute,
    Branch,
    Dialog,
    Choice,
    Shop,
    Encounter,
    GiveItemByName,
    GiveSpellByName,
    EncounterWith,
    ChoiceUntil
} from './story.js';
import { DIFFICULTY } from './constants.js';
import { items, potions } from './obtainables.js';

export function BeggarStory() {
    /**
     * @param {*} game
     * @returns {number}
     */
    const alignmentIndex = game => (game.player.alignment || 2) - 1;

    return (
        new Dialog('A shadowy figure approaches.')
            .then(new Dialog('They take you to a tavern basement.'))
            .then(new Dialog('They tell you of a treasure.'))

            .then(
                Choice('Swords or spells?', [
                    {
                        text: 'Magic',
                        next: GiveSpellByName('Fireball')
                            .then(
                                new Execute(game => {
                                    game.player.money += 300;
                                })
                            )
                            .then(
                                new Dialog(
                                    'You learn a spell and gain some money.'
                                )
                            )
                    },
                    {
                        text: 'Melee',
                        next: GiveItemByName('Basic Sword')
                            .then(
                                new Execute(game => {
                                    game.player.money += 300;
                                })
                            )
                            .then(
                                new Dialog(
                                    'You get a sword and receive some money.'
                                )
                            )
                    }
                ])
            )

            // MARKET SHOPS
            .then(
                ChoiceUntil('Where do you shop?', leave => [
                    {
                        text: 'Blacksmith',
                        next: Shop('Blacksmith', items.slice(0, 10))
                    },
                    { text: 'Alchemist', next: Shop('Alchemist', potions) },
                    {
                        text: 'General Store',
                        next: Shop('General Store', items.slice(10, 20))
                    },
                    {
                        text: 'Leave town',
                        next: new Dialog('You head into the forest.').then(leave)
                    }
                ])
            )

            // FOREST ENCOUNTER
            .then(Encounter(DIFFICULTY.MEDIUM))

            .then(
                Choice('Three paths lie ahead.', [
                    {
                        text: 'Left',
                        align: 1,
                        next: new Dialog('You find a chest with a map.')
                    },
                    {
                        text: 'Forward',
                        align: 2,
                        next: new Dialog('You continue forward.')
                    },
                    {
                        text: 'Right',
                        align: 3,
                        next: new Dialog("You find a knight's corpse.")
                    }
                ])
            )

            // TEMPLE ENTRY
            .then(
                new Branch(alignmentIndex).with_branches(
                    new Dialog(
                        "After following the map, you've found the final temple."
                    ),
                    new Dialog(
                        'As you leave the knight you finally see the temple and enter, looking for what awaits.'
                    ),
                    new Dialog(
                        'As you leave the knight rotting you finally see the temple and enter, looking for what awaits.'
                    )
                )
            )

            // ENDING
            .then(
                new Branch(alignmentIndex).with_branches(
                    new Dialog(
                        'You finally beat the final monster guarding the treasure and obtained what you seek... As you go back home you see a small trinket where you left that knight... When returning to your “mentor” you find that all he wanted was the money and as you feel his dagger slide out suddenly, the random ring you found triggers causing you to come back to life...'
                    )
                        .then(EncounterWith('assassin', DIFFICULTY.HARD))
                        .then(
                            new Dialog(
                                'As you stand upon your supposed mentors corpse you find peace in your new life, as you venture out to this whole new world with more than you ever had before.'
                            )
                        ),
                    new Dialog(
                        'As you finally beat the final monster guarding the treasure you feel a pain in your back as an arrow finishes you off... As you look back you see the tearful and angry gaze of what seems to be an archer wearing the same emblem that you found on your armor. You die.'
                    ),
                    new Dialog(
                        "You defeated the final monster guarding your path and now go to leave, when you get back though your “mentor” kills you for your treasure, if only you could've stopped this."
                    )
                )
            )

            .then(new Dialog('The story ends here.'))
    );
}
