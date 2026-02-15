import express from "express";
import pool from "../src/db.js";
import NodeCache from "node-cache";

const router = express.Router();
const myCache = new NodeCache({ stdTTL: 3600 });

const allowedTables = ["cmrl_master_production", "srr_master", "mtc_master"];

router.get("/api/layers/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    const cacheKey = `${tableName}_all`;

    const cachedData = myCache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const tolerance = tableName === "mtc_master" ? 0.0006 : 0.0001;
    let query;

    if (tableName === "cmrl_master_production") {
      // query = `
      //       SELECT jsonb_build_object(
      //           'type', 'FeatureCollection',
      //           'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      //       )
      //       FROM (
      //         SELECT jsonb_build_object(
      //           'type', 'Feature',
      //           'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(wkb_geometry, ${tolerance}))::jsonb,
      //           'properties', jsonb_build_object(
      //               'fid', ogc_fid,
      //               'stop_name', stop_name,
      //               'route_color', route_color,
      //               'feature_type', feature_type  -- Critical for frontend filtering
      //           )
      //         ) AS feature
      //         FROM ${tableName}
      //       ) features;
      //   `;
      query = `SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
)
FROM (
  SELECT jsonb_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(wkb_geometry, ${tolerance}))::jsonb,
    'properties', jsonb_build_object(
        'fid', ogc_fid,
        'stop_name', stop_name,
        'route_color', route_color,
        'feature_type', feature_type
    )
  ) AS feature
  FROM (
    SELECT DISTINCT ON (wkb_geometry) 
      wkb_geometry, ogc_fid, stop_name, route_color, feature_type
    FROM ${tableName}
    ORDER BY wkb_geometry, 
             (route_color = '#00A700') DESC  -- High priority color first
  ) AS unique_rows
) features;`;
    } else {
      // query = `
      //       SELECT jsonb_build_object(
      //           'type', 'FeatureCollection',
      //           'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      //       )
      //       FROM (
      //         SELECT jsonb_build_object(
      //           'type', 'Feature',
      //           'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(wkb_geometry, ${tolerance}))::jsonb,
      //           'properties', jsonb_build_object(
      //               'fid', ogc_fid,
      //               'stop_name', stop_name,
      //               'feature_type', feature_type  
      //           )
      //         ) AS feature
      //         FROM ${tableName}
      //       ) features;
      //   `;
        query = `
    SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
    )
    FROM (
      SELECT jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(wkb_geometry, ${tolerance}))::jsonb,
        'properties', jsonb_build_object(
            'fid', ogc_fid,
            'stop_name', stop_name,
            'feature_type', feature_type
        )
      ) AS feature
      FROM (
        SELECT DISTINCT ON (wkb_geometry) 
            wkb_geometry, ogc_fid, stop_name, feature_type
        FROM ${tableName}
        ORDER BY wkb_geometry
      ) AS unique_rows
    ) features;
`;
    }

    const result = await pool.query(query);
    const geojson = result.rows[0].jsonb_build_object;

    myCache.set(cacheKey, geojson);
    res.json(geojson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/stats", async (req, res) => {
  try {
    const cacheKey = "dynamic_stats";
    const cachedStats = myCache.get(cacheKey);

    if (cachedStats) {
      console.log("📊 Stats returned from CACHE");
      return res.json(cachedStats);
    }

    console.log("🗄️ Stats fetched from DATABASE");

    const queries = allowedTables.map((table) => [
      pool.query(
        `SELECT COUNT(*) FROM "${table}" WHERE LOWER(feature_type) = 'route'`,
      ),
      pool.query(
        `SELECT COUNT(*) FROM "${table}" WHERE LOWER(feature_type) = 'stop'`,
      ),
    ]);

    const results = await Promise.all(queries.flat());

    let totalRoutes = 0;
    let totalStops = 0;

    results.forEach((result, index) => {
      const count = parseInt(result.rows[0].count, 10);
      if (index % 2 === 0) {
        totalRoutes += count;
      } else {
        totalStops += count;
      }
    });

    const stats = {
      agencies: 3,
      routes: totalRoutes,
      stops: totalStops,
    };

    myCache.set(cacheKey, stats);
    res.json(stats);
  } catch (err) {
    console.error("Stats API Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
