# Newfoundland Trails

A mobile-first trail explorer for Newfoundland, covering hiking, ATV, snowmobile, and road-trip routes and destinations.

## Data confidence

The app distinguishes mapped route geometry, verified trailheads, official project-area records, and community-reported planning information. An environmental-assessment record or resource-road line is not, by itself, proof that a route is built, maintained, legally open, or safe to ride.

Always confirm local access, closures, weather, bridge conditions, and land-use rules before travelling.

## Run locally

This is a buildless static site. Serve the `dist` directory with any local HTTP server, for example:

```sh
python3 -m http.server 8080 --directory dist
```

Then open `http://localhost:8080`.

## Data sources

Source links and confidence labels are attached to individual trail records. Key sources include the Government of Newfoundland and Labrador, Newfoundland and Labrador Snowmobile Federation, OpenStreetMap contributors, and clearly labelled community reports.

