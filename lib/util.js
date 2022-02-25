const dice = require('talisman/metrics/dice');
const dl = require('talisman/metrics/damerau-levenshtein');
const log = require('fancy-log');

module.exports = {
  logger: (...args) => {
    if (process.env.NODE_ENV !== 'test') {
      log(args);
    }
  },
  /**
   * Loop over source property names and normalise based on hamming distance
   * and dice (slightly rough and ready, essentially employed to handing spelling
   * mistakes and pluralisation)
   *
   * @param {string[]} sourceProperties Source property names, sourced by caller
   * @returns {Object} Object containing the property name and to what it should be mapped
   */
  normalisePropertyNames: (sourceProperties) => {
    const dlThreshold = 2;
    const propertyNames = Object.keys(sourceProperties);

    return propertyNames
      .reduce((output, propertyName) => {
        const replacementPropertyName = propertyNames
          .reduce((replacementOutput, candidateName) => {
            const distance = dl(propertyName, candidateName);
            const coefficient = dice(propertyName, candidateName);
            const nameScore = sourceProperties[propertyName];
            const candidateScore = sourceProperties[candidateName];

            // For replacement to considered the distance has to be below the replacement threshold
            // and have a strong dice coefficient of over 50%
            if (distance !== 0 && distance < dlThreshold && coefficient > 0.5) {
              module.exports.logger(JSON.stringify({
                propertyName,
                candidateName,
                distance,
                coefficient,
                nameScore,
                candidateScore,
              }), 'Property name mapping score');

              return nameScore > candidateScore ? propertyName : candidateName;
            }
            return replacementOutput;
          }, null);
        return Object.assign(output, { [propertyName]: replacementPropertyName || propertyName });
      }, {});
  },
  /**
     * Take a string that contains markers to split text and return an array based on those markers
     *
     * @param {string[]|string} sourceData String of source data to be split
     * @returns {string[]} An array of the source data, split on the makers after noise removed
     */
  normaliseSplitters: (sourceData) => [...new Set(
    (Array.isArray(sourceData) ? sourceData : [sourceData])
      .map((source) => source.replace(/("|\[|\])/g, '')
        .split(/[&,/]/g)
        .map((value) => value.trim()))
      .reduce((output, value) => output.concat(value), []),
  )],
};
