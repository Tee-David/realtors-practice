import { meiliClient } from "../utils/meili.util";
import { Logger } from "../utils/logger.util";
import prisma from "../prismaClient";

export class MeiliService {
  private static readonly INDEX_NAME = "properties";

  /**
   * Configure the Meilisearch index with filterable, searchable, and sortable attributes.
   * This should be run on app startup or via a setup script.
   */
  static async configureIndex() {
    if (!meiliClient) return;

    try {
      const index = meiliClient.index(this.INDEX_NAME);

      await index.updateFilterableAttributes([
        "status",
        "listingType",
        "categoryId",
        "categoryName",
        "price",
        "bedrooms",
        "bathrooms",
        "toilets",
        "parkingSpaces",
        "state",
        "lga",
        "area",
        "qualityScore",
        "createdAt",
      ]);

      await index.updateSearchableAttributes([
        "title",
        "description",
        "locationText",
        "features",
        "categoryName",
        "state",
        "lga",
        "area",
        "estateName",
        "fullAddress",
        "streetName",
      ]);

      await index.updateSortableAttributes(["price", "createdAt", "qualityScore"]);

      // Custom ranking rules must be in the format "attribute:direction"
      // but only AFTER the built-in rules. Meilisearch does not allow mixing.
      await index.updateRankingRules([
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort",
        "exactness",
      ]);

      Logger.info(`Meilisearch index '${this.INDEX_NAME}' configured successfully.`);
    } catch (err: any) {
      Logger.error(`Failed to configure Meilisearch index: ${err.message}`);
    }
  }

  /**
   * Format a property from the DB into the flat structure expected by Meilisearch.
   */
  private static formatPropertyForSearch(property: Record<string, any>) {
    return {
      id: property.id,
      title: property.title,
      description: property.description,
      status: property.status,
      listingType: property.listingType,
      price: property.price ? Number(property.price) : null,
      priceCurrency: property.priceCurrency,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      toilets: property.toilets,
      parkingSpaces: property.parkingSpaces,
      buildingSizeSqm: property.buildingSizeSqm,
      landSizeSqm: property.landSizeSqm,
      locationText: property.locationText,
      fullAddress: property.fullAddress,
      streetName: property.streetName,
      state: property.state,
      lga: property.lga,
      area: property.area,
      estateName: property.estateName,
      features: property.features || [],
      qualityScore: property.qualityScore,
      createdAt: new Date(property.createdAt).getTime(),
      updatedAt: new Date(property.updatedAt).getTime(),
      categoryId: property.category,
      categoryName: property.category,
      mainImage: property.images && Array.isArray(property.images) ? property.images[0] : null,
      propertyType: property.propertyType,
      rentFrequency: property.rentFrequency,
    };
  }

  /**
   * Upsert a single property into Meilisearch.
   * Should be called after a property is created or updated in the DB.
   */
  static async upsertProperty(propertyId: string) {
    if (!meiliClient) return;

    try {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      });

      if (!property) return;
      if (property.deletedAt !== null) {
        await this.deleteProperty(propertyId);
        return;
      }

      const formatted = this.formatPropertyForSearch(property);
      await meiliClient.index(this.INDEX_NAME).addDocuments([formatted]);
      
      Logger.debug(`Upserted property ${propertyId} to Meilisearch`);
    } catch (err: any) {
      Logger.error(`Failed to upsert property ${propertyId} to Meilisearch: ${err.message}`);
    }
  }

  /**
   * Remove a property from Meilisearch.
   */
  static async deleteProperty(propertyId: string) {
    if (!meiliClient) return;

    try {
      await meiliClient.index(this.INDEX_NAME).deleteDocument(propertyId);
      Logger.debug(`Deleted property ${propertyId} from Meilisearch`);
    } catch (err: any) {
      Logger.error(`Failed to delete property ${propertyId} from Meilisearch: ${err.message}`);
    }
  }

  /**
   * Sync all active properties to Meilisearch in batches.
   * Useful for initial setup or cron jobs to ensure data consistency.
   */
  static async batchSync(batchSize = 1000) {
    if (!meiliClient) {
      Logger.error("Cannot batch sync: Meilisearch client not initialized");
      return;
    }

    try {
      Logger.info(`Starting batch sync to Meilisearch (batch size: ${batchSize})...`);
      this.configureIndex();

      let cursor: string | undefined = undefined;
      let totalSynced = 0;

      while (true) {
        const properties: any[] = await prisma.property.findMany({
          take: batchSize,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
          where: { deletedAt: null },
          orderBy: { id: "asc" },
        });

        if (properties.length === 0) break;

        const documents = properties.map(this.formatPropertyForSearch);
        await meiliClient.index(this.INDEX_NAME).addDocuments(documents);

        totalSynced += properties.length;
        cursor = properties[properties.length - 1].id;
        
        Logger.info(`Synced batch of ${properties.length} properties...`);
      }

      Logger.info(`Batch sync complete. Total synced: ${totalSynced}`);
    } catch (err: any) {
      Logger.error(`Batch sync failed: ${err.message}`);
    }
  }

  /**
   * Full re-index. Used mainly via cron jobs.
   * This wipes the active indices and re-imports everything.
   */
  static async fullReindex() {
    if (!meiliClient) {
      Logger.error("Cannot full reindex: Meilisearch client not initialized");
      return;
    }

    Logger.info("Starting full Meilisearch re-index...");
    try {
      const index = meiliClient.index(this.INDEX_NAME);
      await index.deleteAllDocuments();
      
      let cursor: string | undefined = undefined;
      const batchSize = 1000;
      let totalProcessed = 0;
      
      while (true) {
        const properties: any[] = await prisma.property.findMany({
          take: batchSize,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
          where: { deletedAt: null },
          orderBy: { id: "asc" },
        });
        
        if (properties.length === 0) break;
        
        const documents = properties.map((p) => this.formatPropertyForSearch(p));
        await index.addDocuments(documents);
        
        totalProcessed += properties.length;
        cursor = properties[properties.length - 1].id;
        
        Logger.info(`Re-indexed ${totalProcessed} properties so far...`);
      }
      
      Logger.info(`Full Meilisearch re-index complete. Total: ${totalProcessed}`);
    } catch (error: any) {
      Logger.error(`Failed full Meilisearch re-index: ${error.message}`);
      throw error;
    }
  }
}
