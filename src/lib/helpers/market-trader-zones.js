// By default this value is 100% of the buy price as calculated from an item's
// stock, min price, max price, and min/max stock thresholds
// (see market categories settings).
const resolveBuyPricePercent = (float) => {
  return float === -1 || float < 0
    ? Number(100).toFixed(2) // Default to 100% if invalid
    : Number(float).toFixed(2); // Or fix to 2 decimals if valid
};

// By default this value is -1.0, meaning the global value from market
// settings will be used, but can be overridden by setting
// this to the desired percentage.
const resolveSellPricePercent = (float) => {
  return float === -1 || float < 0 // Check has default value
    ? 'Market Settings Global Value' // Return Market Setting global value
    : Number(float).toFixed(2); // Or fix the number to 2 decimals
};

// You can set the stock for each individual item or set it
// to 0 (meaning traders in this zone will only start selling the item
// after players have sold at least one of the respective item to the trader).
const resolveStockEntry = () => {

};

module.exports = {
  resolveBuyPricePercent,
  resolveSellPricePercent,
  resolveStockEntry
};
