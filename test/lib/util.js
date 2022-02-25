// eslint-disable-next-line import/no-extraneous-dependencies,import/newline-after-import
const chai = require('chai');
const { expect } = chai;

chai.use(require('chai-as-promised')); // eslint-disable-line import/no-extraneous-dependencies

const { normaliseSplitters } = require('../../lib/util');

describe(__filename, () => {
  describe('normaliseSplitters', () => {
    it('Remove noise from string', () => {
      const normalisedString = 'This is a string of text pretending to be an array';
      const testCase = [`["${normalisedString}"]`];

      expect(normaliseSplitters(testCase)).to.deep.equal([normalisedString]);
    });
    it('Split across multiple splitters and trim text', () => {
      const testCase = ['Java, Kotlin, JavaScript, Groovy, Ruby, Ceylon & Scala'];

      expect(normaliseSplitters(testCase)).to.deep.equal(['Java', 'Kotlin', 'JavaScript', 'Groovy', 'Ruby', 'Ceylon', 'Scala']);
    });
    it('Split and combine from multiple sources', () => {
      const testCase = ['XSLT', 'Java, Kotlin, JavaScript, Groovy, Ruby, Ceylon & Scala'];

      expect(normaliseSplitters(testCase)).to.deep.equal(['XSLT', 'Java', 'Kotlin', 'JavaScript', 'Groovy', 'Ruby', 'Ceylon', 'Scala']);
    });
    it('Split on a raw string', () => {
      const testCase = 'XSLT';

      expect(normaliseSplitters(testCase)).to.deep.equal(['XSLT']);
    });
    it('Remove duplicates after normalising values', () => {
      const testCase = ['XSLT', 'XSLT'];

      expect(normaliseSplitters(testCase)).to.deep.equal(['XSLT']);
    });
  });
});
