const bayes = require('bayes');

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
   * Use the captured README data and categories
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

        if (readme && category) {
          if (Array.isArray(category)) {
            category
              .filter((value) => this.ignoredCategories.indexOf(value.toLowerCase()) === -1)
              .forEach((value) => this.classifier.learn(readme, value));
          } else if (this.ignoredCategories.indexOf(category.toLowerCase()) === -1) {
            this.classifier.learn(readme, category);
          }
        }

        return tool;
      });
  }

  async categorize() {
    this.tools = await Promise.all(this.tools
      .map(async (tool) => {
        if (tool.readme) {
          const newCategory = await this.classifier.categorize(tool.readme);

          if (newCategory && newCategory !== 'null') {
            // No category exists
            if (!tool.category) {
              tool.category = newCategory; // eslint-disable-line no-param-reassign

            // Array of categories already exists
            } else if (Array.isArray(tool.category)) {
              if (tool.category.indexOf(newCategory) === -1) {
                tool.category.push(newCategory);
              }

            // A category already exists, so convert to array
            } else if (tool.category !== newCategory) {
              tool.category = [tool.category, newCategory]; // eslint-disable-line no-param-reassign
            }
          }

          // Trash the decoded readme
          delete tool.readme; // eslint-disable-line no-param-reassign
        }

        return tool;
      }));

    return this.tools;
  }
}

module.exports = Classifier;
