import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";

interface SettingInput {
  key: string;
  value: unknown;
  category?: string;
}

export class SystemSettingsService {
  static async get(key: string) {
    return prisma.systemSetting.findUnique({ where: { key } });
  }

  static async set(key: string, value: unknown, category?: string) {
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: value as any,
        ...(category !== undefined && { category }),
      },
      create: {
        key,
        value: value as any,
        category: category || "general",
      },
    });

    Logger.info(`System setting updated: ${key}`);
    return setting;
  }

  static async getByCategory(category: string) {
    return prisma.systemSetting.findMany({
      where: { category },
      orderBy: { key: "asc" },
    });
  }

  static async getAll() {
    const settings = await prisma.systemSetting.findMany({
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });

    const grouped: Record<string, typeof settings> = {};

    for (const setting of settings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = [];
      }
      grouped[setting.category].push(setting);
    }

    return grouped;
  }

  static async bulkUpdate(settings: SettingInput[]) {
    const results = await prisma.$transaction(
      settings.map((s) =>
        prisma.systemSetting.upsert({
          where: { key: s.key },
          update: {
            value: s.value as any,
            ...(s.category !== undefined && { category: s.category }),
          },
          create: {
            key: s.key,
            value: s.value as any,
            category: s.category || "general",
          },
        })
      )
    );

    Logger.info(`Bulk updated ${results.length} system settings`);
    return results;
  }

  static async getDefaults() {
    const settings = await prisma.systemSetting.findMany();

    const defaults: Record<string, unknown> = {};
    for (const setting of settings) {
      defaults[setting.key] = setting.value;
    }

    return defaults;
  }
}
