module.exports = (tools) => Object
  .entries(tools
    .reduce((output, tool) => {
      const unclassify = (category) => (category.trim().toLowerCase() === 'miscellaneous'
        ? 'Unclassified'
        : category);
      const update = output;

      // If category set to Unclassified
      if (!tool.category) {
        update.Unclassified = (update.Unclassified || 0) + 1;
        return update;
      }

      // If category is an array then count all values
      if (Array.isArray(tool.category)) {
        tool.category
          .forEach((c) => {
            const category = unclassify(c);

            update[category] = (update[category] || 0) + 1;
          });
        return update;
      }

      const category = unclassify(tool.category);

      // Only one category for the tool and its a string
      update[category] = (update[category] || 0) + 1;

      return update;
    }, {}))
  // eslint-disable-next-line no-unused-vars
  .sort(([keyOne, valueOne], [keyTwo, valueTwo]) => valueTwo - valueOne);
