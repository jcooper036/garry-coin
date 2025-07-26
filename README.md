# GarryCoin

GarryCoin is a project centered around the community of GarryCoin. The coin itself is a crypto-currency which is managed by the GarryCoin Foundation (TM). GarryCoin has no intrinsic value - its only use is as a cross-channel form of points in discord. The coin is "mined" with each discord post by users, and can be distributed to other users in the form of using emojis on their posts. That's it, that's the whole thing.

## The Coin

GarryCoin is not *really* a cryptocurrency, since it is managed by a centralized bot. It's a parody of the concept for fun.

Each server that wants to use it installs the GarryCoin bot (GarryBot). The bot's backend manages how many coins each user has. Instead of complex "proof of work," new coins are minted simply by activity. When a message is posted in a channel with the bot, a new GarryCoin is randomly awarded to one of the active users on the server.

GarryBot uses the user's underlying Discord ID to track coin balances, allowing users to have a single "wallet" across all servers where the bot is present.

## Discord Interactions

### Emojis
The primary way of giving GarryCoin is with emoji responses to messages. There are emojis for 1, 5, and 10 GarryCoins. The coins are removed from the user that responded with the emoji, and given to the user of the post.

**Important:** Emojis can be taken back on Discord, but the GarryCoin transaction is final and cannot be undone. Removing the emoji does not un-send the GarryCoins. Removing the emoji and then using it again will send more GarryCoins.

### Slash Commands
Unless stated otherwise, all responses are private to the user. "ephemeral" vs "public" denotes if the interaction in the channel can be seen only by the user that called the action, or if the bot posts publically to the channel.
- `/test` - (ephemeral) Should return "Hello from the GarryCoin community"
- `/garryhelp` - (ephemeral) Gives the user the commands they can use.
- `/garrywallet` - (ephemeral) Displays the current contents of a user's wallet privately.
- `/garrylookatme` - (public) Displays the current contents of a user's wallet publicly.
- `/garrymakeitrain` - (public) Gives one GarryCoin to every other member of the server. (Secret feature: If the user doesn't have enough coins, it mocks them publicly for being too poor).
- `/garryhistory @user` - (public) Shows the last 10 transactions for the stated user. By default this is the user making the request.
- `/garrysend X @user` - (public) Sends X GarryCoins to the target user publicly.

## Future Ideas
- **Gambling:** Add mini-games (like dice rolls or coin flips) where users can gamble their GarryCoins.
- **Leaderboards:** A server-wide or global leaderboard of the richest users.
- **Shop:** A server-specific "shop" where users can spend coins on cosmetic roles or other server perks defined by the server admins.

## Development
If all is working, you should be able to go to discord and run the /test command for the bot on any server it's deployed on.

There is both the prod bot (garrycoin_bot) and the test bot (test-garrycoin_bot). Obviously one of those is used for testing, the other is the real thing. Their configurations are managed via the discord web UI.
### Deploying the bot
[Bot configuration page](https://discord.com/developers/applications/929770806697918524/information)
[Test bot configuration page](https://discord.com/developers/applications/1390674844160491640/information)

Follow the instructions in the [getting started docs from discord](https://discord.com/developers/docs/quick-start/getting-started). We're using a stable ngrok endpoint for the interactions endpoint, so that shouldn't need to change.

### Running Locally

To run the bot locally with Docker Compose:

```bash
docker compose up --build
```

This will start the bot, a local PostgreSQL database, and an ngrok tunnel. Changes made to files within the `src/` directory will automatically trigger a rebuild and restart of the bot container. For changes outside of `src/` (e.g., `package.json`, `Dockerfile`), you will need to run `docker compose build` followed by `docker compose up`.

## Render
In prod we use [Render](https://dashboard.render.com/project/prj-d1ipq7mr433s73ckaq50). This means a few things:
- our .env variables locally point to the test bot. In prod, we store the ENV variables using RENDER. Any that are in .env that say PROD don't actually impact the prod ENV variables.
- Render starts the api with `npm run migrate-and-start-api` and the bot with `npm run migrate-and-start-bot`. That's a bit different than our local docker-compose, but the intention is that they remain functionally the same.
- Command registration is done by running `npm run register` as a pre-container command
### Database
The database is [hosted by Supabase](https://supabase.com/dashboard/project/veapsbdivoizhtjggull). The connection uses the session pooler string from supabase for the IPv4 requirement. We add that as an env variable in Render. Note that on migration from Render, we ultimately just needed to migrate the database (which supabase provides the code for), and then change the connection string.

Migrations are generated by knex, and are run on deployment in Render.