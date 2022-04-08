import express from "express";
import bodyParser from "body-parser";
import { config } from "dotenv";
import healthCheck from "./handlers/health";

config();

const app = express();

const PORT = process.env.PORT || 3008;

app.use(bodyParser.json());

app.get("/health", healthCheck);

app.listen(PORT, () => {
  console.log(`Remote Jobs Fetcher running on port ${PORT}`);
});
