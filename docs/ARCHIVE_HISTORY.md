# Archived temperature history

The history panel is separate from the NOAA/PacIOOS source-connected globe.
It reads regional summaries derived from the complete private CoralTemp originals
preserved in GROAN's R2 archive. No R2 credentials are sent to visitors.

## Data path

`catamarandan/crw-pilot/ingest/export_archive.py` verifies each original against
its inventory SHA-256, checks the native NetCDF schema and date, and computes
cosine-latitude-weighted means over documented rectangular extents. Broad areas
sample native cells every 1 degree; smaller areas every 0.1 degree. These are
sampled regional means, not full-resolution area integrals, coastline-specific
means, reef measurements, or forecasts. All native 0.05-degree files remain
unchanged in storage. Regions overlap and include neighboring waters.

The private archive job updates the derived `dashboard.json` after successful
daily collection. Summaries are cached by source checksum and method signature;
source revisions produce fresh summaries without deleting older originals.

The portal Worker exposes only this fixed summary at
`https://cdfk.world/api/groan/archive` using the `SCIENCE_ARCHIVE` R2 binding.
The endpoint allows GET/HEAD and selected site origins. It does not expose bucket
listings, caller-selected object paths, private manifests or upload operations.
Its activation requires the new Worker version to be promoted in Cloudflare.

`groan-ui/archive-dashboard.json` is a published fallback snapshot. The page
loads both sources and selects the newest successful export; it explicitly labels
snapshot use, generation time, covered dates and missing days. The fallback is
updated by publishing a new verified artifact from the private archive workflow;
it is not claimed to update automatically. Routine automatic freshness uses the
Worker endpoint after promotion. No summary is manufactured when both fail.

## Interpretation

Daily means exclude masked/missing cells and preserve valid zero values. The
30-day moving average requires 30 complete daily means. Recent direction compares
the latest 30 complete days with the preceding 30; the +/-0.10 C display threshold
is not statistical significance. Gaps break chart lines. Changing coverage and
seasons may affect comparisons. Two years is not a climate baseline or ENSO index.

CSV downloads include date, derived mean, valid sampled-cell count, source SHA,
units, sampling, regional extent and method description. The original NOAA
variable is `analysed_sst`, with units `degrees_Celsius`.

## Verification

- Archive tests check masks, zero values, area weighting, disjoint longitude boxes,
  missing dates and rejection of corrupt original files.
- Browser data tests check chronology/coverage, numeric validity, missing-date line
  gaps, complete rolling windows, CSV gaps and page control targets.
- Portal tests check fixed-object access, public-field projection, CORS, read-only
  methods, HEAD/ETag and generic failure responses. Existing authentication tests
  remain in place.

The fixed collection start is 2024-11-22. Future records extend that inventory;
there is no rolling two-year deletion. Additional-region backup and restore
testing remain separate work and must not be implied by this dashboard.
