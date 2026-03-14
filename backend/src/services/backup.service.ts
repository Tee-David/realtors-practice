import { mkdir, readdir, readFile, writeFile, unlink, stat } from "fs/promises";
import path from "path";
import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";

const BACKUPS_DIR = path.resolve(__dirname, "../../backups");

interface BackupMetadata {
  id: string;
  version: string;
  filename: string;
  size: number;
  tables: Record<string, number>;
  createdAt: string;
}

interface BackupData {
  metadata: BackupMetadata;
  data: Record<string, unknown[]>;
}

export class BackupService {
  private static async ensureBackupsDir(): Promise<void> {
    await mkdir(BACKUPS_DIR, { recursive: true });
  }

  static async createBackup(): Promise<BackupMetadata> {
    await this.ensureBackupsDir();

    Logger.info("Starting backup creation...");

    const [
      properties,
      sites,
      users,
      savedSearches,
      scrapeJobs,
      notifications,
      auditLogs,
      systemSettings,
    ] = await Promise.all([
      prisma.property.findMany(),
      prisma.site.findMany(),
      prisma.user.findMany(),
      prisma.savedSearch.findMany(),
      prisma.scrapeJob.findMany(),
      prisma.notification.findMany(),
      prisma.auditLog.findMany(),
      prisma.systemSetting.findMany(),
    ]);

    const tables: Record<string, number> = {
      Property: properties.length,
      Site: sites.length,
      User: users.length,
      SavedSearch: savedSearches.length,
      ScrapeJob: scrapeJobs.length,
      Notification: notifications.length,
      AuditLog: auditLogs.length,
      SystemSetting: systemSettings.length,
    };

    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/T/, "-")
      .replace(/:/g, "")
      .replace(/\.\d+Z$/, "");
    const filename = `backup-${timestamp}.json`;
    const id = filename.replace(".json", "");

    const metadata: BackupMetadata = {
      id,
      version: "1.0",
      filename,
      size: 0,
      tables,
      createdAt: now.toISOString(),
    };

    const backupData: BackupData = {
      metadata,
      data: {
        Property: properties,
        Site: sites,
        User: users,
        SavedSearch: savedSearches,
        ScrapeJob: scrapeJobs,
        Notification: notifications,
        AuditLog: auditLogs,
        SystemSetting: systemSettings,
      },
    };

    const content = JSON.stringify(backupData, null, 2);
    metadata.size = Buffer.byteLength(content, "utf-8");

    const filePath = path.join(BACKUPS_DIR, filename);
    await writeFile(filePath, content, "utf-8");

    Logger.info(`Backup created: ${filename} (${metadata.size} bytes)`);
    return metadata;
  }

  static async listBackups(): Promise<BackupMetadata[]> {
    await this.ensureBackupsDir();

    const files = await readdir(BACKUPS_DIR);
    const backupFiles = files.filter(
      (f) => f.startsWith("backup-") && f.endsWith(".json")
    );

    const metadataList: BackupMetadata[] = [];

    for (const filename of backupFiles) {
      try {
        const filePath = path.join(BACKUPS_DIR, filename);
        const content = await readFile(filePath, "utf-8");
        const parsed: BackupData = JSON.parse(content);
        metadataList.push(parsed.metadata);
      } catch (err) {
        Logger.warn(`Failed to read backup file: ${filename}`, err);
      }
    }

    metadataList.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return metadataList;
  }

  static async getBackup(
    id: string
  ): Promise<{ metadata: BackupMetadata; filePath: string } | null> {
    await this.ensureBackupsDir();

    const filename = id.endsWith(".json") ? id : `${id}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);

    try {
      await stat(filePath);
    } catch {
      return null;
    }

    try {
      const content = await readFile(filePath, "utf-8");
      const parsed: BackupData = JSON.parse(content);
      return { metadata: parsed.metadata, filePath };
    } catch (err) {
      Logger.error(`Failed to read backup: ${id}`, err);
      return null;
    }
  }

  static async restoreBackup(
    id: string,
    confirm: boolean
  ): Promise<{ restored: boolean; tables: Record<string, number> }> {
    if (!confirm) {
      throw new Error(
        "Restore requires explicit confirmation. Pass confirm: true to proceed."
      );
    }

    const backup = await this.getBackup(id);
    if (!backup) {
      throw new Error(`Backup not found: ${id}`);
    }

    const filePath = backup.filePath;
    const content = await readFile(filePath, "utf-8");
    const parsed: BackupData = JSON.parse(content);
    const { data } = parsed;

    Logger.warn(`Starting restore from backup: ${id}`);

    // Use a transaction to truncate and re-insert
    await prisma.$transaction(async (tx) => {
      // Delete in reverse dependency order
      await tx.notification.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.savedSearch.deleteMany();
      await tx.scrapeJob.deleteMany();
      await tx.property.deleteMany();
      await tx.site.deleteMany();
      await tx.systemSetting.deleteMany();
      await tx.user.deleteMany();

      // Re-insert in dependency order
      if (data.User && (data.User as unknown[]).length > 0) {
        for (const record of data.User as unknown[]) {
          await tx.user.create({ data: record as any });
        }
      }

      if (data.Site && (data.Site as unknown[]).length > 0) {
        for (const record of data.Site as unknown[]) {
          await tx.site.create({ data: record as any });
        }
      }

      if (data.Property && (data.Property as unknown[]).length > 0) {
        for (const record of data.Property as unknown[]) {
          await tx.property.create({ data: record as any });
        }
      }

      if (data.ScrapeJob && (data.ScrapeJob as unknown[]).length > 0) {
        for (const record of data.ScrapeJob as unknown[]) {
          await tx.scrapeJob.create({ data: record as any });
        }
      }

      if (data.SavedSearch && (data.SavedSearch as unknown[]).length > 0) {
        for (const record of data.SavedSearch as unknown[]) {
          await tx.savedSearch.create({ data: record as any });
        }
      }

      if (data.Notification && (data.Notification as unknown[]).length > 0) {
        for (const record of data.Notification as unknown[]) {
          await tx.notification.create({ data: record as any });
        }
      }

      if (data.AuditLog && (data.AuditLog as unknown[]).length > 0) {
        for (const record of data.AuditLog as unknown[]) {
          await tx.auditLog.create({ data: record as any });
        }
      }

      if (data.SystemSetting && (data.SystemSetting as unknown[]).length > 0) {
        for (const record of data.SystemSetting as unknown[]) {
          await tx.systemSetting.create({ data: record as any });
        }
      }
    });

    Logger.info(`Restore completed from backup: ${id}`);

    return {
      restored: true,
      tables: parsed.metadata.tables,
    };
  }

  static async deleteBackup(id: string): Promise<boolean> {
    const backup = await this.getBackup(id);
    if (!backup) return false;

    await unlink(backup.filePath);
    Logger.info(`Backup deleted: ${id}`);
    return true;
  }

  static async getSchedule(): Promise<{
    frequency: string;
    retention: number;
  } | null> {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "backup_schedule" },
    });

    if (!setting) return null;

    const value = setting.value as { frequency: string; retention: number };
    return value;
  }

  static async setSchedule(
    frequency: string,
    retention: number
  ): Promise<{ frequency: string; retention: number }> {
    const value = { frequency, retention };

    await prisma.systemSetting.upsert({
      where: { key: "backup_schedule" },
      update: { value },
      create: {
        key: "backup_schedule",
        value,
        category: "backup",
      },
    });

    Logger.info(`Backup schedule updated: ${frequency}, retention: ${retention}`);
    return value;
  }
}
