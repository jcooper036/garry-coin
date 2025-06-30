require('dotenv').config();
const express = require('express');
const { verifyKeyMiddleware } = require('discord-interactions');
const { InteractionType, InteractionResponseType } = require('discord-interactions');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_KEY = process.env.PUBLIC_KEY;

app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), async (req, res) => {
  const { type, id, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Hello from the GarryCoin community!!!!!',
        },
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});