# SYNTHETIC_TEST_DATA

`load-chart/` contains eight invented cells for imaginary Truck Crane and All Terrain Crane configurations. All values, model names, coordinates, source identifiers and notes were written solely for software testing, without copying manufacturer documents. The all-`a` SHA identifier is a synthetic identifier, not a PDF hash. No manufacturer PDF is supplied or implied.

Units are mm, kg and radians. Each configuration includes boom length, counterweight, outrigger geometry, crane type and operating sector. Cells cover numeric capacities, null blanks, prohibited conditions and an unresolved radius. A configuration mismatch is exercised by querying a different configuration ID in the database tests. Every source, table, note and cell carries `SYNTHETIC_TEST_DATA`; all cells start `UNVERIFIED`, ineligible and unapproved.

Do not use these values for lifting, manufacturer accuracy claims or formal capacity lookup. The review database and API retain their approval and unresolved-configuration gates even after a cell becomes `VERIFIED`. `npm run review:demo` uses a separate synthetic SQLite database and clearly labels its API and UI.
