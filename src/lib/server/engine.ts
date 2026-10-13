import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { Engine } from "../engine";
import type { CatalogFile } from "./catalog-types";

let engine: Engine | null = null;

/** Loads data/catalog.json.gz once per server instance (~1 s cold start). */
export function getEngine(): Engine {
  if (!engine) {
    const file = JSON.parse(gunzipSync(readFileSync(join(process.cwd(), "data", "catalog.json.gz"))).toString("utf8")) as CatalogFile;
    engine = new Engine(file);
  }
  return engine;
}
