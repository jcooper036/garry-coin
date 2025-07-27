module.exports = {
    name: 'garrywavelengthhelp',
    description: 'Explains how to play the Wavelength game.',
    async execute(interaction) {
        const helpText = `
**🌊 How to Play Wavelength 🌊**

Wavelength is a social guessing game where one player (the **Host**) knows a secret number on a scale and gives a clue to help other players guess it.

---

**📜 Host**

1.  **Start the Game:** Use \`/garrywavelength\` with a \`wager\` (minimum 2 GC).
2.  **Get Your Setup:** You'll receive a private message with a random scale (e.g., Hot ↔️ Cold) and a secret number on that scale (from -3 to 3).
3.  **Give a Clue:** Click the **[Enter Your Word]** button and submit a word or phrase that you think corresponds to your secret number on the scale.
    *   *Example: If the scale is "Sad ↔️ Happy" and your number is **2**, a good clue might be "finding a dollar on the street".*
4.  **Wait for Players:** Once you submit your clue, the game begins, and other players can join.
5.  **Reveal the Answer:** When you're ready (or after 10 minutes), click the **[Reveal Answer]** button to end the game.

**🏆 Host Payout**
*   If at least one player guesses your secret number correctly, you split the entire pot with them!
*   If *no one* guesses correctly, the house takes the pot.

---

**🎮 Players**

1.  **Join the Game:** When a new Wavelength game appears, click the **[Join Game]** button. The wager amount will be automatically deducted from your wallet.
2.  **Analyze the Clue:** Look at the scale and the Host's clue.
3.  **Make Your Guess:** You'll receive a private message with buttons from -3 to 3. Click the number you think is the secret spot on the scale.
4.  **Wait for the Reveal:** See if you guessed correctly!

**🏆 Player Payout**
*   If you guess the secret number correctly, you win a share of the total pot! The pot is split between all winning players and the host.
*   If you guess incorrectly, you lose your wager.
`;

        return {
            content: helpText,
            ephemeral: true,
        };
    },
};