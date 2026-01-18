import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

/*
  OpenStreetMap (Overpass API)
  Fetch real attractions, museums, historic places
*/
app.get("/api/places", async (req, res) => {
  const city = req.query.city;

  if (!city) {
    return res.status(400).json({ error: "City is required" });
  }

  const query = `
    [out:json];
    area["name"="${city}"]->.searchArea;
    (
      node["tourism"="attraction"](area.searchArea);
      node["amenity"="museum"](area.searchArea);
      node["historic"](area.searchArea);
    );
    out 20;
  `;

  try {
    const response = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        body: query,
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "TravelEase-Student-Project"
        }
      }
    );

    const data = await response.json();

    const places = data.elements
      .filter(p => p.tags?.name)
      .map(p => ({
        name: p.tags.name,
        lat: p.lat,
        lng: p.lon
      }));

    res.json(places);
  } catch (err) {
    console.error("OSM error:", err);
    res.status(500).json({ error: "Failed to fetch places" });
  }
});

app.listen(5000, () => {
  console.log("Backend running on http://localhost:5000");
});
