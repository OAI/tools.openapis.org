const { expect } = require('chai');

const setUnclassified = require('../../../../lib/site/set-unclassified');

describe(__filename, () => {
  describe('setUnclassified function', () => {
    it('Matching value returns Unclassified', () => {
      expect(setUnclassified('Miscellaneous')).to.equal('Unclassified');
    });
    it('Unmatched value is persisted', () => {
      expect(setUnclassified('Test Category')).to.equal('Test Category');
    });
  });
});
