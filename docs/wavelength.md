# Wavelength
An implementation of the wavelength game via discord interactions

# General Concept
Wavelength is a game where, given a scale and a number on that scale. For example, they might get the scale -3 : bottom 5 movies all time -- 3 : best 5 movies of all time, and the number 2. Then, they need to pick something that they think goes on that scale. Let's say in this example the movie Rounders. The other players are presented with the scale and the thing that the first player decided, and have to try to figure out the number.


## incentive stucture
Now I'm not going to call the members of the GarryCoin community dishonest, but there are GarryCoins on the line here - so we need to make sure there is an incetive structure which people cannot turbo cheat to generate coins. Here's what I'm thinking:
- To start a game, a host wagers some number of coins
- Any user that selects an option joins in on the wager
- The winners are the players that select the correct answer and the host.
They split the pot evenly.
- This way, there is no incentive for the host to cheat and give the correct answer, since all players would select the correct one and all would split.
- There is also no incentive for them to mislead, since at least one other player has to win for them to win.
- In fact, there is every incentive for them to select divisive answers, which is what we want for a good game.

# Implementation
## details
- When the game starts, the host gets an ephemeral message which they respond to with their answer. After that, we create the main game message which is the interaction point going forward.
- When the game starts, the host is give a scale (with each end) and a number. They are only coming up with a response. Phrase it as a prompt "On a scale of -3 being worst 5 movies of all time and 3 being best 5 movies, what move would you rate a 2"?
- That message gets updated (there is only one total message per game visable to the public)
- Users that are not the host see 
    - the scale
    - the host's choice
    - and buttons for -3 -2 -1 0 1 2 3
    - the current pot
- All players can see who has wagered (in any)
- The host can decide in the setup if players can also see which options each other have picked - by default they cannot.
- The host cannot see who has picked which option unless the other players can
- The host has an option to end the game and reveal the answer
- The game automatically ends after 10 minutes
- At the end of the game all the information is revealed (the scale, the hosts word, the target number, and the numbers that everyone picked)