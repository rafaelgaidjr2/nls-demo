# Contributing

Use Node 22+, run npm start, and edit the files under dist/ directly. Keep domain parsing/checking functions in core.js and UI interactions in app.js. There is no build step or required package installation. First-party JavaScript, HTML and CSS use two-space indentation and Prettier 3.6.2 formatting, configured by .prettierrc.json. To reformat, run `npx prettier@3.6.2 --write dist/core.js dist/app.js dist/index.html dist/style.css test.cjs regression.cjs scripts/serve.cjs`. Leave the vendored Excel bundle minified.

Before submitting changes, run npm run check and npm test. For parser changes, add representative regression assertions and exercise the affected import in the browser. Preserve source filename/row information and safe text rendering. Document any changed matching or aggregation assumptions. Use fictional or explicitly authorized fixtures only.

Changes to the vendored Excel parser should include version/provenance updates and the upstream license. Do not edit its minified bundle manually. Choose an application license before opening public contributions.
