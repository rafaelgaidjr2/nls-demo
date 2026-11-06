# Deployment

## Local
Run `npm start` with Node 22+. The server serves only dist/, binds to 127.0.0.1 and defaults to port 8080. No installation or build is needed. This is a development server, not a production server.

## Any static host
Publish the contents of dist/. All script/style URLs are relative, so repository subpaths are supported. There are no client-side URL routes, server endpoints, environment variables or database migrations. Keep the local Excel bundle and license together with the application.

## GitHub Pages
An optional manual workflow is included at `.github/workflows/pages.yml`. In repository Settings > Pages, select GitHub Actions as the source, then run Deploy static site from Actions. It uploads dist/ and deploys it. This is separate from CI and does not deploy automatically on every push.

Pages availability and visibility depend on the GitHub plan and repository configuration. The app does not provide visitor authentication itself; a public host makes the application available to anyone with its URL. Import data remains in that visitor's browser, but a shared browser profile can expose a session.

## Existing ChatGPT Sites publication
This archive is a portable export, not a credentials backup. The original source was deployed as Sites version 1. Its hosting manifest/project binding and Git metadata are intentionally absent. Continue managing that existing publication through Sites rather than pasting credentials into GitHub. Uploading this archive to GitHub alone does not update the Sites deployment.

## Release checks
Run checks and tests, verify fixtures through the browser, inspect third-party dependency updates, and review repository contents for real imported data before publishing. All bundled fixtures are fictional.
