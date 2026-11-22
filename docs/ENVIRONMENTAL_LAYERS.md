# Environmental comparison release — 2026-11-22

User authorized all seven proposed environmental layers plus Amazon Basin coverage. The page now includes sea-surface temperature, land-surface temperature, accumulated heat stress, chlorophyll, salinity, geostrophic currents, precipitation, surface soil moisture and vegetation greenness.

## What is implemented

- Two independently dated maps with a common geographic extent and source links.
- NOAA/PacIOOS numerical temperature and Degree Heating Week grids, with native names, units, timestamps and missing values checked. NOAA CoastWatch currents use the provider’s dated vector map because its numerical endpoint does not grant browser CORS access. No exact current point values are exposed in this release.
- NASA GIBS source imagery and official legends for chlorophyll, SMAP salinity, IMERG precipitation, SMAP Level-4 soil moisture, MODIS NDVI and daytime MODIS land-surface temperature. These imagery views do not expose exact point values or constitute a numerical archive.
- The Amazon preset spans 82°W–44°W, 22°S–7°N. It includes the basin and contextual neighboring land; it is not an exact watershed mask. The one-click preset pairs land-surface temperature with precipitation.
- Date selection starts 2024-11-22. NASA composite dates resolve to an available period at or before the requested date, with actual source dates displayed. No observation is silently labelled as the requested date when it differs.
- NASA availability is checked live, with clearly labelled saved metadata as fallback. Failure to retrieve a map is explicit. Missing areas are never zero-filled.
- Ocean-globe regions include Pacific Americas through Alaska/Aleutians and Tierra del Fuego, Atlantic Americas through Newfoundland, Caribbean, Mediterranean, Red Sea, Coral Triangle and Florida/East Coast. Continuous 1×–12× zoom and native-grid local detail are distinct controls.
- Selected-temperature comparisons are daily endpoint differences at the same sample cell, not fitted trends. ±0.10°C is a display category, not statistical significance.

## Scientific and operational boundaries

- These are observations, derived indicators and model analyses, not an operational GROAN forecast service.
- Land-surface temperature uses the provider’s kelvin legend and is distinct from weather-station air temperature.
- Chlorophyll is not a harmful-algal-species or toxicity diagnosis. NDVI does not diagnose forest health. Geostrophic currents are not total currents and cover only 64.7°S–64.7°N.
- Satellite retrievals have gaps; composites and providers have different cadences. Co-located patterns alone do not establish causality.
- The new two-year permanent original SST archive is separately prepared in `catamarandan/crw-pilot`, but is not active until private object storage is connected. No other full-grid archive or automatic forecast has been activated.
- Shamrocket field observations (temperature, salinity, pH, dissolved oxygen, nutrients, water clarity) are described as future complementary records. No readings, instrument accuracy or calibration are invented.

## Deferred until data/model validation and connections exist

Numerical extraction for imagery-only layers, harmonized time-series comparison, exact Amazon watershed statistics, validated predictive models, ingestion of field-kit records, multi-region backup and archive restore testing. Existing NOAA climatologies can inform anomaly products without collecting decades of new daily observations into GROAN’s archive.

## Verification

Run `node test/thermal-data.test.mjs` and `node test/environment-data.test.mjs`. Browser verification must include loaded numerical and imagery layers, actual dates, missing/error states, composite dates, Amazon preset and the public home-page entrance.
