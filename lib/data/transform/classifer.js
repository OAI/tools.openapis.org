const bayes = require('bayes');

const { normalisePropertyNames } = require('../util');

const acronyms = ['DSL', 'GUI', 'SDK'];
const titleCase = (category) => category.split(' ')
  .map((text) => {
    const upper = text.toUpperCase();

    // THIS NEEDS TO BE VASTLY IMPROVED AS IT DOES NOT SCALE
    if (acronyms.indexOf(upper) !== -1) {
      return upper;
    }

    return text.charAt(0).toUpperCase() + text.substr(1).toLowerCase();
  })
  .join(' ');

const normaliseCategoryValue = (category) => {
  let output = category.trim();

  const dash = output.match(/^(?:\w+(?:-|$))+$/);
  const comma = output.match(/^(?:\w+(?:(?:,|$) *))+$/);

  // Words concatenated with dash or comma
  if (dash || comma) {
    output = output.split(/-|,/).join(' ');
  }

  return titleCase(output);
};

class Classifier {
  constructor(tools) {
    if (!tools) {
      throw new Error('Missing parameter: tools');
    }

    this.ignoredCategories = [
      'miscellaneous', 'random',
    ];

    this.tools = tools;
    this.classifier = bayes();
  }

  /**
   * Use the captured README data and categories to provide an inference of the correct catagories
   */
  learn() {
    this.tools = this.tools
      .map((tool) => {
        const { base64Readme } = (tool.repositoryMetadata || {});
        const { category } = tool;
        const readme = base64Readme
          ? Buffer.from(base64Readme, 'base64').toString()
          : null;

        // Write decoded readme onto tooling array to be used for classification
        tool.readme = readme; // eslint-disable-line no-param-reassign

        if (category) {
          if (Array.isArray(category)) {
            tool.category = category // eslint-disable-line no-param-reassign
              .filter((value) => this.ignoredCategories.indexOf(value.toLowerCase()) === -1)
              .map((value) => {
                const normalisedValue = normaliseCategoryValue(value);

                if (readme) {
                  this.classifier.learn(readme, normalisedValue);
                }

                return normalisedValue;
              });
          } else if (this.ignoredCategories.indexOf(category.toLowerCase()) === -1) {
            const normalisedValue = normaliseCategoryValue(category);

            if (readme) {
              this.classifier.learn(readme, normalisedValue);
            }

            tool.category = normalisedValue; // eslint-disable-line no-param-reassign
          } else {
            // Removed an ignored category
            delete tool.category; // eslint-disable-line no-param-reassign
          }
        }

        return tool;
      });
  }

  /**
   * Provides a list of category names and the category name they should be mapped to
   *
   * @returns {Object[]]} The list of categories and what they should be set to
   */
  getNormalisedCategories() {
    // Collect up all categories and count their appearances in the data
    const weightedCategories = this.tools
      .reduce((output, tool) => {
        const update = output;

        // If category not set then ignore
        if (!tool.category) {
          return update;
        }

        // If category is an array then normalise all values
        if (Array.isArray(tool.category)) {
          tool.category
            .forEach((c) => {
              const normalisedValue = normaliseCategoryValue(c);
              update[normalisedValue] = (
                update[normalisedValue] || 0) + 1;
            });
          return update;
        }

        // Category is a string so normalise and count
        const normalisedValue = normaliseCategoryValue(tool.category);

        update[normalisedValue] = (update[normalisedValue] || 0) + 1;

        return update;
      }, {});

    // Normalise all category names, coalescing on the most common
    // Dial-up the hamming distance to allow categories to become more concentrated
    return normalisePropertyNames(weightedCategories, 4);
  }

  /**
   * Returns the tools list categorised based on the model
   *
   * @returns {Object[]} The full tools list
   */
  async categorize() {
    const tools = await Promise.all(this.tools
      .map(async (tool) => {
        // If categoryByRequestIndicator is true then override analysis and persist
        // existing category, as tooling owner has asked specifically for that one
        if (!tool.categoryByRequestIndicator && tool.readme) {
          const newCategory = await this.classifier.categorize(tool.readme);
          delete tool.readme; // eslint-disable-line no-param-reassign

          if (newCategory && newCategory !== 'null') {
            // No category exists
            if (!tool.category) {
              return Object.assign(tool, { category: newCategory });
            }

            // Array of categories already exists
            if (Array.isArray(tool.category)) {
              if (tool.category.indexOf(newCategory) === -1) {
                return Object.assign(tool, { category: tool.category.concat([newCategory]) });
              }

            // A category already exists, so convert to array
            } else if (tool.category !== newCategory) {
              return Object.assign(tool, { category: [tool.category, newCategory] });
            }
          }
        }

        // Trash the decoded readme
        delete tool.readme; // eslint-disable-line no-param-reassign

        return tool;
      }));

    // Get the weighted categories
    const categories = this.getNormalisedCategories();

    // Rationalise the categories, concentrating them into relatively few
    // This also tidies up any duplicates through the use of Set
    this.tools = tools
      .map((tool) => {
        if (!tool.category) {
          return tool;
        }

        return Object.assign(
          tool,
          {
            category: Array.isArray(tool.category)
              ? [...new Set(tool.category
                .map((category) => (categories[category] ? categories[category] : category)))]
              : categories[tool.category],
          },
        );
      });

    return this.tools;
  }
}

module.exports = Classifier;
