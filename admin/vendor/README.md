# Sveltia CMS vendor bundle

- Package: `@sveltia/cms`
- Version: `0.261.0`
- Source: `https://registry.npmjs.org/@sveltia/cms/-/cms-0.261.0.tgz`
- License: MIT, retained in `sveltia-cms-0.261.0/LICENSE.txt`
- Bundle SHA-256: `6fb2e7caf8dae42b3247aa336e5b512e15e7220d38faacfea804cb98fbac8c7f`
- `immutable.es.js` is a local compatibility implementation for preview maps/lists.
- Locale JSON files are mirrored as ES modules because static hosts serve `.json` as JSON.

The copied npm bundle, lazy chunks, fonts, local Immutable runtime, and locales are served
from the same origin as the CMS. Update the version, vendor directory, license, and bundle
digest together.
