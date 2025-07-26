# Ride the Bus

Iteritive gambling game played with one or more players.

## General mechanics / features
- A player uses /garryridethebus to start a game. This input needs to take a `wager` input that says how much they are betting.

- We post a message that represents the game. It says something like "<@USER> has hailed the bus for a fare of X GC - who else wants on?" with a button that says "Ride the Bus". Other players have 10 seconds to get on the bus (for the same wager, they don't get an input choice)
- After the 10 seconds, the message updates. It it says "sequence", which will be blank for now because there are no cards. Phase 1 is to pick a color, red or black. There are lines for "On the bus" which are all the players still in the game, "Made it to their stop" which are the players that have cashed out, and "Dead in the road" for the players that have missed.
- After 10 seconds, the message updates again. On the backend we draw a card, and compare the user inputs. An incorrect or lack of input moves players to "Dead in the road". Correctly guessing the color of the card keeps them on the bus.
- The message sequence updates with the new card. It now has two buttons for Higher or Lower, where players need to guess if the next card will be over or under the current card (Aces are high). There is also a button for "this is my stop" where players can cash out. Players have another 10 seconds to select an option.
- After 10 seconds we draw another card, and add it to the sequence. Players that guesses correctly stay on the bus, wrong guess or no guess is dead in the road. Players that got off are added to the "Made it to their stop" line with the player name and number of stops (i.e 1 Stop).
- The message now has that information, and the new buttons are Outside and Inside. This time players have to guess if the next card is inside the previous two, or outside in sequence. Same "this is my stop" as before.
- Repeat from above. If they got off the bus they rode 2 stops again 10 seconds for a decision
- After that step, the new prompt is to pick a suit. Buttons for each of the suits of cards, and the get off the bus button. 10 seconds for a decision.
- After this round, the game is over. The message at the end has the sequence, players that made it to their stop, dead in the road, with a new catagory for those that made it to the end of the line. 
- Then we handle the payouts. Dead in the road, we subtract the wager from their account. If 1 stop, we grant them the number of coins they wagered. If 2 stops, we grant 2x the number of coins they wagered. If 3 stops, grant 4x the number of coins they wagered. If they ride to the end of the line, we grant 9x the number of coins they wagered.


## details
- we need to check that players have enough coins for the ride at the beginning. If not, they should get a message that says "You're too poor for the bus in this part of town (#gc short)"
- assume each draw is from a fresh deck so we don't have to persist a deck state or anything
- we can only have one game of ride the bus going at once. If players try to start a new one while the game is active, they get a message that says "you need to wait for the next bus"