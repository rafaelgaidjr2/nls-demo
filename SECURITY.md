# Security and privacy

Imported records are processed in the browser and stored in sessionStorage for that origin/tab. There is no backend identity layer, server database, API key or network transfer of project imports. Refresh restores the session; closing the tab normally ends it. An opened tab may copy opener storage, and any same-origin script can access it. Use separate browser profiles for separate people and avoid importing confidential material on shared devices.

The UI escapes user-derived text before inserting it into HTML. CSV exports quote values and neutralize common formula prefixes. These measures do not make an unreviewed file safe in every spreadsheet product. File size is limited to 15 MB, but decompression, workbook complexity and graph depth can still consume excessive resources. Parsing runs synchronously.

SheetJS CE 0.18.5 is vendored to preserve the deployed version. Review upstream security advisories and upgrade to a maintained release before accepting untrusted files in production. No current dependency security audit is claimed by this package.

Do not commit real customer imports, reports, credentials, tokens or session dumps. private-imports/ and .env files are ignored. A static public host does not inherit the owner-only access of the original Sites publication.

For a suspected vulnerability, contact the repository maintainer privately using their GitHub profile contact options; no dedicated security address has been configured. Avoid posting sensitive records in public issues.
