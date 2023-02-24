const logger = require('@mirasaki/logger');
const chalk = require('chalk');
const { parseSnakeCaseArray, getRelativeTime } = require('../../util');

const { NODE_ENV,
  GUILD_JOIN_LEAVE_CHANNEL_ID } = process.env;

module.exports = (client, guild) => {
  // Always check to make sure the guild is available
  if (!guild?.available) return;

  // Logging the event to our console
  logger.success(`${ chalk.greenBright('[GUILD JOIN]') } ${ guild.name } has added the bot! Members: ${ guild.memberCount }`);

  // Send Server join/leave messages in production
  if (NODE_ENV === 'production') {
    const guildJoinLeaveChannel = client.channels.cache.get(GUILD_JOIN_LEAVE_CHANNEL_ID);
    try {
      guildJoinLeaveChannel?.send({
        content: `**__${ guild.name }__** has added <@!${ client.user.id }> to their server!`,
        embeds: [
          {
            color: 6618980,
            title: `[${ guild.preferredLocale }]: ${ guild.name }`,
            description: guild.description || null,
            thumbnail: { url: guild.iconURL({ dynamic: true }) },
            image: { url: guild.bannerURL() },
            fields: [
              {
                name: 'Members',
                value: `${ (guild.memberCount).toLocaleString('en-US') }`,
                inline: true
              },
              {
                name: 'Discord Boosts',
                value: `Tier ${ guild.premiumTier } @ ${ guild.premiumSubscriptionCount } boosts`,
                inline: true
              },
              {
                name: 'Features',
                value: `${ parseSnakeCaseArray(guild.features) || 'None!' }`,
                inline: false
              },
              {
                name: 'Created',
                value: `${ new Date(guild.createdAt).toLocaleString() }\n${ getRelativeTime(guild.createdAt) }`,
                inline: true
              }
            ]
          }
        ]
      });
    }
    catch (err) {
      logger.syserr(`Error while trying to send guildJoin message in #${ guildJoinLeaveChannel.name }`);
      console.error(err);
    }
  }
};
