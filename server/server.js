import express from "express";
import dotenv from "dotenv";
import { pool } from "./src/db.js";
import dataroutes from "./routes/data.api.js";
import cors from "cors";
import compression from "compression";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({
  origin: "http://localhost:5174",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
}));  
// app.use(compression());

app.get("/health", (req, res) => {
  res.send("Transit Data Server is running.");
});

app.use("/v1", dataroutes);

async function testDatabaseConnection() {
  try {
    const result = await pool.query("SELECT NOW(), version()");
    console.log("✅ Database connected successfully");
    console.log("Database time:", result.rows[0].now);
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    console.error("Connection details:", {
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      ssl: process.env.DB_SSL,
    });
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Database: ${process.env.DB_HOST}/${process.env.DB_NAME}`);
  await testDatabaseConnection();
});
