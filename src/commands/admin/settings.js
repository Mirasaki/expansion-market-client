const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const {
  getSettingsCache, putSettings, settingsCache
} = require('../../lib/requests');
const { colorResolver } = require('../../util');

const struct = { onlyShowDynamicNowPrice: Boolean };
const settingDescriptions = { onlyShowDynamicNowPrice: 'When enabled, only shows current price when item doesn\'t have a static stock' };

const formatSettingToHumanReadable = (str) => {
  // Split the string by uppercase letters and join with spaces
  const formatted = str.split(/(?=[A-Z])/).join(' ');

  // Capitalize the first letter of the string
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const formatSettingToUnderscoreNotation = (str) => {
  // Split the string by uppercase letters and join with underscores
  const formatted = str.split(/(?=[A-Z])/).join('_');

  // Convert the string to lowercase
  return formatted.toLowerCase();
};

module.exports = new ChatInputCommand({
  global: true,
  data: {
    description: 'Manage settings for this server',
    options: [
      {
        name: 'display',
        description: 'Display all your current settings',
        type: ApplicationCommandOptionType.Subcommand
      },
      {
        name: 'set',
        description: 'Change/modify an existing setting',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: Object
          .entries(struct)
          .map(([ settingName, settingType ]) => ({
            name: formatSettingToUnderscoreNotation(settingName),
            description: settingDescriptions[settingName],
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              settingType === Boolean
                ? ({
                  name: 'value',
                  description: 'The new value to assign to this setting',
                  type: ApplicationCommandOptionType.Boolean,
                  required: true
                })
                : 'n/a'
            ]
          })),
        choices: Object.keys(struct).map(formatSettingToHumanReadable)
      }
    ]
  },
  run: async (client, interaction) => {
    const {
      member, guild, options
    } = interaction;
    const { emojis } = client.container;
    const action = options.getSubcommandGroup() ?? options.getSubcommand();

    await interaction.deferReply();

    switch (action) {
      case 'set': {
        const newVal = options.get('value')?.value;
        await putSettings(guild.id, { [options.getSubcommand()]: newVal });
        if (settingsCache.get(guild.id)) settingsCache.delete(guild.id);
        await interaction.editReply(`${ emojis.success } ${ member }, **\`${ options.getSubcommand() }\`** was updated to ${ newVal }`);
        break;
      }

      case 'display':
      default: {
        const settings = await getSettingsCache(guild.id);
        interaction.editReply({ embeds: [
          {
            color: colorResolver(),
            author: {
              name: `Settings for ${ guild.name }`,
              icon_url: guild.iconURL()
            },
            description: Object
              .entries(struct)
              .map(([ settingName, settingType ]) => {
                const dbVal = settings[settingName];
                const val = dbVal === true
                  ? emojis.success
                  : dbVal === false || dbVal === null || typeof dbVal === 'undefined'
                    ? emojis.error
                    : 'n/a';
                return `${ formatSettingToHumanReadable(settingName) }: ${ val }`;
              })
              .join('\n')
          }
        ] });
        break;
      }
    }
  }
});
