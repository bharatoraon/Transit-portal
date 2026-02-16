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
      query = `
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
        )
        FROM (
          -- ROUTE SHAPES (LineStrings)
          SELECT jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_MakeLine(ST_SetSRID(ST_MakePoint(lon, lat), 4326) ORDER BY point_sequence), ${tolerance}))::jsonb,
            'properties', jsonb_build_object(
                'route_id', route_id,
                'route_short_name', route_short_name,
                'route_color', COALESCE(route_color, '#000000'),
                'feature_type', 'route'
            )
          ) AS feature
          FROM (
            SELECT DISTINCT ON (route_id, point_sequence) 
              route_id, route_short_name, route_color, lon, lat, point_sequence
            FROM gtfs_master_view
            WHERE feature_type = 'shape'
            AND shape_id IN (
              SELECT DISTINCT ON (route_id) shape_id FROM gtfs_master_view WHERE feature_type = 'shape'
            )
          ) AS shapes_subquery
          GROUP BY route_id, route_short_name, route_color

          UNION ALL

          -- STOPS (Points)
          SELECT jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(ST_SetSRID(ST_MakePoint(lon, lat), 4326))::jsonb,
            'properties', jsonb_build_object(
                'stop_id', stop_id,
                'stop_name', stop_name,
                'route_id', route_id,
                'feature_type', 'stop'
            )
          ) AS feature
          FROM (
            SELECT DISTINCT ON (stop_name) 
              stop_id, stop_name, route_id, lon, lat
            FROM gtfs_master_view
            WHERE feature_type = 'stop'
            ORDER BY stop_name, stop_id
          ) AS stops_subquery
        ) features;
      `;
    } else {
      query = `
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
        )
        FROM (
          -- ROUTES
          SELECT jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(wkb_geometry, ${tolerance}))::jsonb,
            'properties', jsonb_build_object(
                'fid', ogc_fid,
                'stop_name', stop_name,
                'feature_type', feature_type
            )
          ) AS feature
          FROM ${tableName}
          WHERE LOWER(feature_type) = 'route'

          UNION ALL

          -- STOPS
          SELECT jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(wkb_geometry)::jsonb,
            'properties', jsonb_build_object(
                'fid', ogc_fid,
                'stop_name', stop_name,
                'feature_type', feature_type
            )
          ) AS feature
          FROM (
            SELECT DISTINCT ON (stop_name) 
                wkb_geometry, ogc_fid, stop_name, feature_type
            FROM ${tableName}
            WHERE LOWER(feature_type) = 'stop'
            ORDER BY stop_name, ogc_fid
          ) AS unique_stops
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

router.get("/api/route-analysis", async (req, res) => {
  try {
    const { source, destination } = req.query;

    if (!source || !destination) {
      return res.status(400).json({ error: "Source and destination are required" });
    }

    const query = `
      WITH trip_match AS (
        SELECT 
          s.trip_id,
          s.route_id,
          s.route_long_name,
          s.route_color,
          s.trip_headsign,
          s.stop_sequence as start_seq,
          d.stop_sequence as end_seq,
          s.departure_time as start_time,
          d.arrival_time as end_time,
          (d.stop_sequence - s.stop_sequence) as stops_count,
          ST_Distance(
            ST_Transform(ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326), 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint(d.lon, d.lat), 4326), 3857)
          ) / 1000 as direct_distance_km
        FROM gtfs_master_view s
        JOIN gtfs_master_view d ON s.trip_id = d.trip_id
        WHERE s.feature_type = 'stop' 
          AND d.feature_type = 'stop'
          AND s.stop_name = $1
          AND d.stop_name = $2
          AND d.stop_sequence > s.stop_sequence
        ORDER BY s.departure_time
        LIMIT 1
      )
      SELECT 
        tm.*,
        (
          SELECT jsonb_agg(stop_name ORDER BY stop_sequence)
          FROM gtfs_master_view
          WHERE trip_id = tm.trip_id 
            AND stop_sequence > tm.start_seq 
            AND stop_sequence < tm.end_seq
            AND feature_type = 'stop'
        ) as intermediate_stops
      FROM trip_match tm;
    `;

    const result = await pool.query(query, [source, destination]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No direct route found between these stops" });
    }

    const data = result.rows[0];
    const toSeconds = (t) => {
      if (!t) return 0;
      if (typeof t === 'string' && t.includes(':')) {
        const parts = t.split(":");
        const [h, m, s = 0] = parts.map(Number);
        return h * 3600 + m * 60 + s;
      }
      if (t instanceof Date) {
        return t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds();
      }
      if (typeof t === 'object') {
        return (t.hours || 0) * 3600 + (t.minutes || 0) * 60 + (t.seconds || 0);
      }
      return 0;
    };

    const durationSeconds = toSeconds(data.end_time) - toSeconds(data.start_time);
    const durationMinutes = Math.round(durationSeconds / 60);

    res.json({
      ...data,
      duration_minutes: durationMinutes,
      intermediate_stops: data.intermediate_stops || [],
    });
  } catch (err) {
    console.error("Route Analysis Error:", err);
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
