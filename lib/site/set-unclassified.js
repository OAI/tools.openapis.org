const unclassifedCategories = ['miscellaneous'];

module.exports = (category) => (
  !category || unclassifedCategories.indexOf(category
    .trim().toLowerCase()) !== -1
    ? 'Unclassified'
    : category);
