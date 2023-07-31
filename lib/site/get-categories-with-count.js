module.exports = (tools) => [['All', tools.length]]
  .concat(
    Object
      .entries(tools
        .reduce((output, tool) => {
          const unclassify = (category) => (category.trim().toLowerCase() === 'miscellaneous'
            ? 'Unclassified'
            : category);

          // If category set to Unclassified
          if (!tool.category) {
            return Object.assign(output, { Unclassified: (output.Unclassified || 0) + 1 });
          }

          // If category is an array then count all values
          if (Array.isArray(tool.category)) {
            const update = output;

            tool.category
              .forEach((c) => {
                const category = unclassify(c);

                update[category] = (update[category] || 0) + 1;
              });
            return update;
          }

          const category = unclassify(tool.category);

          // Only one category for the tool
          return Object.assign(output, { [category]: (output[category] || 0) + 1 });
        }, {}))
    // eslint-disable-next-line no-unused-vars
      .sort(([keyOne, valueOne], [keyTwo, valueTwo]) => valueTwo - valueOne),
  );
