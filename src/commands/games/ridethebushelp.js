module.exports = {
    name: 'garryridethebushelp',
    description: 'Explains how to play the Ride the Bus game.',
    async execute(interaction) {
        const helpText = `
**🚌 How to Play Ride the Bus 🚌**

Ride the Bus is an iterative gambling game where players guess card attributes to stay on the bus and win Garry Coins!

---

**🎮 Starting a Game**

1.  **Start the Game:** Use '/ garryridethebus' with a 'wager' (e.g., ' / garryridethebus wager: 10').
    *   You must have enough Garry Coins for the wager. If not, you'll be told "You're too poor for the bus in this part of town."
2.  **Wait for Players:** Once you start, a message will appear in the channel: "<@USER> has hailed the bus for a fare of X GC - who else wants on?"
3. **Boarding time** Optionally you can decide how long people have to board the bus. Default 30 sec, min 5, max 120.

---

**🤝 Joining a Game**

1.  **Join the Game:** When a new Ride the Bus game appears, click the **[Ride the Bus]** button.
    *   The wager amount will be automatically deducted from your wallet.
    *   You must have enough Garry Coins to join.
2.  **Collective Play:** The game takes place on a single message visible to everyone in the channel. Your choices will be made via private ephemeral messages.

---

**🎲 Gameplay (Brief Overview)**

*   **Phase 1: Color Guess:** Guess if the next card is Red or Black.
*   **Phase 2: Higher or Lower:** Guess if the next card is Higher or Lower than the current card (Aces are high).
*   **Phase 3: Inside or Outside:** Guess if the next card is Inside or Outside the range of the previous two cards.
*   **Phase 4: Suit Guess:** Guess the suit of the next card.

At any point, you can choose to **[This is my stop]** to cash out your winnings based on how many stops you've made.

---

**🏆 Payouts**

*   **Dead in the Road:** Lose your wager.
*   **1 Stop:** Win your wager back.
*   **2 Stops:** Win 2x your wager.
*   **3 Stops:** Win 4x your wager.
*   **End of the Line:** Win 100x your wager!

Good luck, and enjoy the ride!
`;

        return {
            content: helpText,
            ephemeral: true,
        };
    },
};