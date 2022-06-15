const tooling = require('./tooling');

const { getToolsByCategory } = require('../../lib/site');

module.exports = () => getToolsByCategory(tooling());
