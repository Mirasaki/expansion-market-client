const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { getItemList } = require('../../modules/in-game-names');

const CLASS_NAME_OPTION_STRING = 'class-name';

module.exports = new ChatInputCommand({
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
    const { emojis } = client.container;
    const query = options.getString(CLASS_NAME_OPTION_STRING);

    // Deferring our reply
    await interaction.deferReply();

    // Fetching our data
    const res = await getItemList(guild.id);

    // 200 - OK
    if (res.status === 200) {
      // Destructuring and finding the configuration for query
      const { data } = res;
      const itemList = Object.entries(data.valid);
      const itemEntry = itemList.find(([className, inGameName]) => className === query.toLowerCase());

      // Responding appropriately depending on if the item has an
      // in-game name configured
      if (!itemEntry) interaction.editReply(`${emojis.error} ${member}, I can't find the class **\`${query}\`** in this server's in-game names configuration`);
      else interaction.editReply(`${emojis.success} ${member}, **\`${query}\`**'s in-game name is: **${itemEntry[1]}**`);
    }

    // Not Found
    else if (res.status === 404) {
      interaction.editReply(`${emojis.error} ${member}, couldn't find an in-games name configuration for this server. Use **/set-item-list** first.`);
    }

    // Unknown error
    else interaction.editReply(`${emojis.error} ${member}, unexpected error encountered: ${res.code} | ${res.statusText}`);
  }
});
