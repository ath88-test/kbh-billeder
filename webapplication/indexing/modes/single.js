'use strict';

/**
 * Running the indexing procedure in the single mode.
 */

function parseReference(references) {
  if (typeof(references) === 'string') {
    references = references.split(',');
  }

  references = references
    .map((reference) => reference.split('/'))
    .map(([ catalogAlias, assetId ]) => ({ catalogAlias, assetId }));

  if(references.some(({ catalogAlias, assetId }) => !catalogAlias || !assetId)) {
    throw new Error(`
      Every reference in the single mode must
      contain a catalog alias seperated by a slash (/),
      ex: ES/1234,DNT/123
    `);
  }

  return references;
}

module.exports.generateQueries = function(state) {
  var reference = parseReference(state.reference);
  var assetsPerCatalog = {};

  reference.forEach(function(assetReference) {
    if (!assetsPerCatalog[assetReference.catalogAlias]) {
      assetsPerCatalog[assetReference.catalogAlias] = [];
    }
    assetsPerCatalog[assetReference.catalogAlias].push(assetReference.assetId);
  });

  var queries = [];

  Object.keys(assetsPerCatalog).forEach(function(catalogAlias) {
    var assetIds = assetsPerCatalog[catalogAlias];
    var query = assetIds.map(function(assetId) {
      return 'ID is "' + assetId + '"';
    }).join(' OR ');

    queries.push({
      catalogAlias,
      query,
      assetIds
    });
  });

  return queries;
};
