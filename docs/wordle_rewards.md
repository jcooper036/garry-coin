# Wordle rewards
There is a Wordle bot in the channel that allows users to play the wordle. Each day, it publishes several messages, including the results of the wordle. The GarryCoin project looks favorably on this form of self betterment, and thus we reward users for playing the wordle. 

## message template
the bot writes a message with the following template
```
Your group is on a 56 day streak! 🔥 Here are yesterday's results:
👑 4/6: @Yung Shakespeare
5/6: @Garry B @SexyTimeTiger @LucasEwing
6/6: @Zach @Jacob
X/6: @Jenna G @Josh @AlexCharles
```
Each day we watch for a message like this to get the results.

Note that it uses the users local display name here. We need to assocate that to the user-id. We should check the message metadata to see what that looks like on the discord backend.

## reward structure
6 tries - 1 GC
5 tries - 1 GC
4 tries - 2 GC
3 tries - 5 GC
2 tries - 10 GC
1 try - 100 GC

## cheat detection
We assume that not all actors are 100% faithful. We deploy a sophisticated data based algorithm to detect cheating. Each day, each player is assumed to have a 20% chance of cheating - we randomly generate a number to determin if they are. If they are, we subtract 5 GC from their account.

## reporting 
After the wordle bot publishes it's message each day, we publish a similar message reporting how many GC each player recieved, and if any cheaters were detected.