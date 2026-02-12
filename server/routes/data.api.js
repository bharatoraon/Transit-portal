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

    const tolerance = tableName === "mtc_master" ? 0.0004 : 0.0001;

    const query = `
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
            )
            FROM (
              SELECT jsonb_build_object(
                'type', 'Feature',
                'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(wkb_geometry, ${tolerance}))::jsonb,
                'properties', jsonb_build_object(
                    'fid', ogc_fid,
                    'feature_type', feature_type  -- Critical for frontend filtering
                )
              ) AS feature
              FROM ${tableName}
              LIMIT 10000 
            ) features;
        `;

    const result = await pool.query(query);
    const geojson = result.rows[0].jsonb_build_object;

    // 3. Set Cache
    myCache.set(cacheKey, geojson);
    res.json(geojson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
