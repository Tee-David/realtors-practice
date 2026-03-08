import { MeiliSearch } from "meilisearch";
import { config } from "../config/env";
import { Logger } from "./logger.util";

let meiliClient: MeiliSearch | null = null;

try {
  if (config.meilisearch.url) {
    meiliClient = new MeiliSearch({
      host: config.meilisearch.url,
      apiKey: config.meilisearch.masterKey,
    });
    Logger.info(`Meilisearch client initialized at ${config.meilisearch.url}`);
  } else {
    Logger.warn("MEILISEARCH_URL not provided; search features will be disabled.");
  }
} catch (err: any) {
  Logger.error(`Failed to initialize Meilisearch client: ${err.message}`);
}

export { meiliClient };
