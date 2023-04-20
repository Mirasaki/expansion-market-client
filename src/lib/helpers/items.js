const { stripIndents } = require('common-tags');
const {
  MARKET_ANNOTATION_3_STR,
  MARKET_ITEM_NO_MAP,
  MARKET_ITEM_NO_ZONE
} = require('../../constants');
const { colorResolver } = require('../../util');
const {
  prettifyClassName, resolveInGameName, bulkResolveInGameNames, matchResolvedInGameNameArray
} = require('./in-game-names');

const formatDefaultTrader = (str) => {
  // Remove the leading "#" and split the string by underscores
  const parts = str.slice(1).split('_')
    .slice(3, 100);

  // Move "TRADER" to end of string
  parts.push(parts.shift());

  // Capitalize the first letter of each part and join them with spaces
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
};

const resolveAllPossibleItems = (data) => {
  const { valid, notInItemList } = data;

  // Concatenate [ className, inGameName ] from "valid"
  // into our notInItemList array
  return notInItemList
    .map((e) => ({
      name: prettifyClassName(e, false), value: e
    }))
    .concat(Object.entries(valid).map(([ k, v ]) => ({
      name: v, value: k
    })))
    .map(({ name, value }, i, arr) => {
      if (arr.filter((e) => e.name === name).length > 1) return {
        name: `${ name } (${ value })`, value
      };
      else return {
        name, value
      };
    });
};

const resolveItemStock = (item, category, zone) => {
  // Find this item entry in zone stock configuration
  const itemZoneStockEntry = Object.entries(zone.stock)
    .find(([ zoneItemClass, zoneItemStock ]) => zoneItemClass === item.className);

  // Check if this item exists in the zone configuration
  const itemStockLevel = itemZoneStockEntry
    ? itemZoneStockEntry[1]
    : 0;

  // https://github.com/salutesh/DayZ-Expansion-Scripts/wiki/%5BServer-Hosting%5D-Market-TraderZones-Settings#stock
  // If zone stock entry level is 0,
  // this means the item is only tradable after players sell it here
  // Always return our output string
  return itemStockLevel === 0
    ? (
      item.maxStockThreshold !== item.minStockThreshold
      && item.maxStockThreshold >= 1
      && category.initStockPercent >= 1
    )
      ? Math.round((item.maxStockThreshold / 100) * zone.InitStockPercent)
      : 'The amount of items players sold here'
    : itemStockLevel;
};

const resolveBuyPriceOutput = async (settings, item, category, trader, zone) => {
  // Use zone buyPricePercent if a valid value is provided
  const activeBuyPercent = (
    !isNaN(zone.buyPricePercent)
    && zone.buyPricePercent >= 1
    && zone.buyPricePercent <= 999
  )
    // Always use 2 decimal precision
    ? (Math.round(zone.buyPricePercent * 100) / 100).toFixed(2)
    : 100; // 100% by default

  // Calculate dynamic prices
  const buyDynamicHigh = Math.round((item.maxPriceThreshold / 100) * activeBuyPercent);
  const buyDynamicLow = Math.round((item.minPriceThreshold / 100) * activeBuyPercent);

  // Resolve the currency name to display
  const currencyDisplayName = await resolveInGameName(trader.MarketServerId, trader.lowestCurrency);

  // Calculate price now
  let buyDynamicStockNow = 'n/a';
  if (!item.hasStaticStock) {
    const stockNow = resolveItemStock(item, category, zone);
    const currentStockPercent = (stockNow / item.maxStockThreshold) * 100; // Calculate the current stock percentage
    const priceRange = buyDynamicHigh - buyDynamicLow; // Calculate the price range
    const priceOffset = (priceRange / 100) * (100 - currentStockPercent); // Calculate the price offset based on the current stock percentage
    const currentPrice = Math.round(buyDynamicLow + priceOffset); // Calculate the current price based on the price offset and minimum price threshold
    buyDynamicStockNow = currentPrice;
  }

  // Short display settings / Only current price
  if (
    settings.onlyShowDynamicNowPrice === true
    && !item.hasStaticStock
  ) return `- Now: ${ buyDynamicStockNow }`;

  // Construct our final string
  // Always return our buy price str
  return item.hasStaticPrice || item.hasStaticStock
    ? `- ${ buyDynamicHigh } ${ currencyDisplayName }`
    : stripIndents`
      - Low:  ${ buyDynamicLow }${
  !item.hasStaticStock
    ? `\n- Now: ${ buyDynamicStockNow }`
    : '' }
      - High: ${ buyDynamicHigh }
      ---
      ${ currencyDisplayName }
    `;
};

const resolveSellPriceOutput = async (settings, item, category, trader, zone) => {
  // Check if this item is configured to use the
  // zone sell price percent
  // By default this value is -1.0, meaning the global value from
  // market settings will be used, but can be overridden by
  // setting this to the desired percentage.
  const itemUsesZoneSellPercent = item.sellPricePercent === -1 || item.sellPricePercent === '-1' || typeof item.sellPricePercent === 'undefined';

  // Development debugging
  // console.dir({
  //   item,
  //   maxPrice: item.maxPriceThreshold,
  //   onePercent: item.maxPriceThreshold / 100,
  //   calc: (item.maxPriceThreshold / 100) * item.sellPricePercent
  // });

  // Check which sellPricePercent to use
  const activeSellPercent = itemUsesZoneSellPercent
    ? zone.sellPricePercent === -1 || zone.sellPricePercent === '-1' // By default this value is -1.0, meaning the global value from market settings will be used, but can be overridden by setting this to the desired percentage.
      // GLOBAL FALLBACK, ref: https://github.com/salutesh/DayZ-Expansion-Scripts/wiki/%5BServer-Hosting%5D-General-Market-Settings#sellpricepercent
      ? 75 // [DEV] - Implement global fallback file upload or command config
      : (Math.round(zone.sellPricePercent * 100) / 100).toFixed(2) // Use zone SellPricePercent
    : (Math.round(item.sellPricePercent * 100) / 100).toFixed(2); // Use item SellPricePercent

  // Calculate dynamic prices
  const sellDynamicHigh = Math.round((item.maxPriceThreshold / 100) * activeSellPercent);
  const sellDynamicLow = Math.round((item.minPriceThreshold / 100) * activeSellPercent);

  // Resolve the currency name to display
  const currencyDisplayName = await resolveInGameName(trader.MarketServerId, trader.lowestCurrency);

  // Calculate price now
  let sellDynamicStockNow = 'n/a';
  if (!item.hasStaticStock) {
    const stockNow = resolveItemStock(item, category, zone);
    const currentStockPercent = (stockNow / item.maxStockThreshold) * 100; // Calculate the current stock percentage
    const priceRange = sellDynamicHigh - sellDynamicLow; // Calculate the price range
    const priceOffset = (priceRange / 100) * (100 - currentStockPercent); // Calculate the price offset based on the current stock percentage
    const currentPrice = Math.round(sellDynamicLow + priceOffset); // Calculate the current price based on the price offset and minimum price threshold
    sellDynamicStockNow = currentPrice;
  }

  // Short display settings / Only current price
  if (
    settings.onlyShowDynamicNowPrice === true
      && !item.hasStaticStock
  ) return `+ Now: ${ sellDynamicStockNow }`;

  // Construct our final string
  return item.hasStaticPrice || item.hasStaticStock
    ? `+ ${ sellDynamicHigh } ${ currencyDisplayName }`
    : stripIndents`
    + Low:  ${ sellDynamicLow }${
  !item.hasStaticStock
    ? `\n+ Now: ${ sellDynamicStockNow }`
    : '' }
    + High: ${ sellDynamicHigh }
    ---
    ${ currencyDisplayName }
  `;
};

// Fuck it, take the cognitive complexity through the roof,
// It's all really simple - no need to split it up and legit complicate it
// eslint-disable-next-line sonarjs/cognitive-complexity
const getItemDataEmbed = async (settings, className, category, trader) => {
  const item = category.items[0];
  let ign = item.displayName;
  if (!ign) ign = prettifyClassName(className, true);
  const map = trader.MarketTraderMap;
  if (!map) return MARKET_ITEM_NO_MAP;
  const zone = map.MarketTraderZoneConfig;
  if (!zone) return MARKET_ITEM_NO_ZONE;

  // Prepare to check for special item annotation
  let activeAnnotation;
  let hasAnnotation = false;
  const traderAnnotation = Object.entries(trader.items).find(([ key, value ]) => key === className);
  const categoryAnnotation = trader.categories.find((str) => {
    str = str.toLowerCase();
    if (str.indexOf(':') >= 1) return str.slice(0, str.indexOf(':')) === category.categoryName.toLowerCase();
    else return str === category.categoryName.toLowerCase();
  });

  // Trader#Items annotation - More specific annotation, takes priority over Trader#Categories below
  if (traderAnnotation) {
    hasAnnotation = true;
    activeAnnotation = Number(traderAnnotation[1]);
  }
  // Trader#Categories annotation
  else if (categoryAnnotation) {
    hasAnnotation = categoryAnnotation.indexOf(':') >= 1;
    activeAnnotation = Number(categoryAnnotation.slice(
      categoryAnnotation.indexOf(':') + 1,
      categoryAnnotation.length
    ));
  }

  // Early escape hatch for className:3 (only available for attachments etc)
  if (activeAnnotation === 3) return MARKET_ANNOTATION_3_STR;

  // Define our initial, unconditional embed
  const embed = {
    title: ign,
    color: colorResolver(),
    fields: [
      {
        name: 'Category',
        value: category.displayName,
        inline: true
      },
      {
        name: 'Trader',
        value: trader.displayName.startsWith('#STR_EXPANSION_MARKET')
          ? formatDefaultTrader(trader.displayName)
          : trader.displayName,
        inline: true
      },
      {
        name: 'Trader Zone',
        value: zone.m_DisplayName,
        inline: false
      },
      {
        name: 'Buy',
        value: `\`\`\`diff\n${
          hasAnnotation && (activeAnnotation === 2 || activeAnnotation === 3)
            ? '- n/a'
            : await resolveBuyPriceOutput(settings, item, category, trader, zone)
        }\n\`\`\``,
        inline: true
      },
      {
        name: 'Sell',
        value: `\`\`\`diff\n${
          hasAnnotation && (activeAnnotation === 0 || activeAnnotation === 3)
            ? '+ n/a'
            : await resolveSellPriceOutput(settings, item, category, trader, zone)
        }\n\`\`\``,
        inline: true
      }
    ]
  };

  // Display stock level if not static
  if (!item.hasStaticStock) {
    embed.fields.push({
      name: 'Stock',
      value: resolveItemStock(item, category, zone),
      inline: false
    });
  }

  // Properly organize embed content
  let hasSpacing = false;

  // Display SpawnAttachments conditionally
  if (item.spawnAttachments.length >= 1) {
    const resolvedCurrencyArray = matchResolvedInGameNameArray(
      item.spawnAttachments,
      await bulkResolveInGameNames(category.MarketServerId, item.spawnAttachments, true, false),
      false // Already prettified
    );
    embed.fields.push({
      name: 'Attachments',
      value: `\`\`\`diff\n• ${ resolvedCurrencyArray.join('\n• ') }\`\`\``,
      inline: hasSpacing
    });
    hasSpacing = true;
  }

  // Display Variants conditionally
  if (item.variants.length >= 1) {
    const resolvedCurrencyArray = matchResolvedInGameNameArray(
      item.variants,
      await bulkResolveInGameNames(category.MarketServerId, item.variants, true, false),
      false, // Already prettified
      true
    );
    embed.fields.push({
      name: 'Variants',
      value: `\`\`\`diff\n• ${ resolvedCurrencyArray.join('\n• ') }\`\`\``,
      inline: hasSpacing
    });
  }

  // Always return the embed
  return embed;
};

module.exports = {
  resolveAllPossibleItems,
  resolveItemStock,
  resolveBuyPriceOutput,
  getItemDataEmbed
};
