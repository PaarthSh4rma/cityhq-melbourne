# Delhi Metro static map data

`delhi-metro.json` is an OpenStreetMap derived database, © OpenStreetMap contributors, available under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The source extract and this derived database may be used under that licence, including its attribution and share-alike requirements. This is community cartography, not an official DMRC feed. No live delay, schedule, fare, closure or availability claims are made.

Public Overpass query verified 2026-10-08; OSM base timestamp `2026-10-08T13:47:50Z`:

```overpass
[out:json][timeout:90];
(
  nwr["railway"="station"]["station"="subway"](28.3,76.8,28.95,77.6);
  relation["route"="subway"]["network"~"Delhi|DMRC",i](28.3,76.8,28.95,77.6);
);
out geom;
```

The derived file keeps only station **nodes** explicitly tagged `network=Delhi Metro` (245) and the 24 returned route relations with actual member-way geometry. Other networks are excluded. MultiLineStrings preserve the supplied way segments; gaps are not connected with fabricated straight lines. Station nodes at an interchange may be duplicated; directional relations are not a count of unique lines. Bounding-box coverage, community completeness and OSM edit timestamps do not guarantee operational currency.

All four Delhi camera presets use station nodes included in this extract, with their source URLs in `app/cities.json`. Rajiv Chowk is the Delhi viewport and weather/AQ query reference point, not a claim of city-centroid or station-level meteorological precision.

Refresh manually with the same bounded public query and conversion policy, review the resulting differences and source timestamp, then replace the bundled snapshot. There is no automatic Overpass polling. Cache reload is daily; the registry marks static source data stale after 30 days, independently of local retrieval. A refreshed deployment must review the source and licence again. The official Delhi OTD DMRC dataset requires an identity/purpose/terms form; that restriction was not bypassed.
