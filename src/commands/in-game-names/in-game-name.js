const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { getInGameNameByClass } = require('../../lib/requests');
const { colorResolver } = require('../../util');

const CLASS_NAME_OPTION_STRING = 'class-name';
const ERROR_ITEM_UNRESOLVED = 'ItemUnresolved';
const ERROR_NO_ITEM_LIST = 'NoItemList';

module.exports = new ChatInputCommand({
  cooldown: {
    type: 'user',
    usages: 2,
    duration: 10
  },
  data: {
    description: 'Display the in-game name for an item/class name',
    options: [
      {
        name: CLASS_NAME_OPTION_STRING,
        description: 'The class name of the item',
        type: ApplicationCommandOptionType.String,
        required: true
        // autocomplete: true [DEV] - Implement autocomplete
      }
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member, options, guild } = interaction;
    const { emojis, colors } = client.container;
    const query = options.getString(CLASS_NAME_OPTION_STRING);

    // Deferring our reply
    await interaction.deferReply();

    // Fetching our data
    const res = await getInGameNameByClass(guild.id, query);

    // 200 - OK
    if (res.status === 200) {
      // Destructuring and user feedback
      const { data } = res;
      const classNameEndsWithS = data.charAt(data.length - 1) === 's';
      interaction.editReply(`${emojis.success} ${member}, **\`${query}\`**'${classNameEndsWithS ? '' : 's'} in-game name is: **${data}**`);
    }

    // Not Found
    else if (res.status === 404) {
      const { error, message } = res;

      // No in-game name for class/item
      if (error === ERROR_ITEM_UNRESOLVED) {
        interaction.editReply({
          content: `${emojis.error} ${member}, couldn't resolve the in-game name`,
          embeds: [{
            color: colorResolver(colors.warning),
            title: message,
            description: `\`${query}\` missing from /set-item-list configuration`
          }]
        });
      }

      // No item list configured for guild
      else if (error === ERROR_NO_ITEM_LIST) {
        interaction.editReply({
          content: `${emojis.error} ${member}, couldn't resolve the in-game name`,
          embeds: [{
            color: colorResolver(colors.error),
            title: message,
            description: 'Use **`/set-item-list`** before you can use this command to resolve in-game item names'
          }]
        });
      }
    }

    // Unknown error
    else {
      const { status, statusText, error, message } = res;
      interaction.editReply({
        content: `${emojis.error} ${member}, couldn't resolve the in-game name`,
        embeds: [{
          color: colorResolver(colors.error),
          title: error || 'Unexpected error',
          description: message,
          footer: { text: `${status} | ${statusText}` }
        }]
      });
    }
  }
});
