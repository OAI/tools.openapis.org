const YAML = require('js-yaml');
const chai = require('chai');

const { expect } = chai;

const { purgeSources } = require('../../../../lib/data/transform');

describe(__filename, () => {
  it('Source without repository metadata is not filtered', () => {
    const sources = YAML.dump([{
      id: 1,
      homepage: 'https://github.com/api-stuff',
    }]);

    expect(purgeSources(sources)).to.deep.equal(sources);
  });
  it('Source with repository metadata that is not moved or missing is not filtered', () => {
    const sources = YAML.dump([{
      id: 1,
      repository: 'https://github.com/api-stuff',
      repositoryMetadata: {
        id: 334182395,
        node_id: 'MDEwOlJlcG9zaXRvcnkzMzQxODIzOTU=',
        name: 'openapi-chopper',
        full_name: 'api-stuff/openapi-chopper',
      },
    }]);

    expect(purgeSources(sources)).to.deep.equal(sources);
  });
  it('Missing source is filtered', () => {
    const sources = YAML.dump([{
      id: 1,
      repository: 'https://github.com/api-stuff',
      repositoryMetadata: {
        notFound: true,
      },
    }]);

    expect(purgeSources(sources)).to.deep.equal('[]\n');
  });
  it('Moved source without destination already in repository is moved in place', () => {
    const sources = YAML.dump([{
      id: '1',
      repository: 'https://github.com/api-stuff/openapi-chopper',
      repositoryMetadata: {
        moved: true,
        newUrl: 'https://github.com/api-stuff/openapi-grifter',
      },
    }]);

    expect(purgeSources(sources))
      .to.deep.equal(YAML.dump([{
        id: '49c0ce947b99f567d4bfcc0626ebc3c6',
        repository: 'https://github.com/api-stuff/openapi-grifter',
        repositoryMetadata: {},
        oldLocations: ['https://github.com/api-stuff/openapi-chopper'],
      }]));
  });
});
