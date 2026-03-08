import prisma from "../prismaClient";
import { ChangeSource, Prisma } from "@prisma/client";

interface VersionCreateInput {
  propertyId: string;
  previousData: Record<string, unknown>;
  newData: Record<string, unknown>;
  changeSource: ChangeSource;
  changedBy?: string;
  changeSummary?: string;
}

export class VersionService {
  static computeDiff(
    previous: Record<string, unknown>,
    current: Record<string, unknown>
  ): { changedFields: string[]; previousData: Record<string, unknown>; newData: Record<string, unknown> } {
    const changedFields: string[] = [];
    const previousData: Record<string, unknown> = {};
    const newData: Record<string, unknown> = {};

    const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    const skipFields = new Set(["id", "hash", "createdAt", "updatedAt", "deletedAt", "currentVersion"]);

    for (const key of allKeys) {
      if (skipFields.has(key)) continue;

      const prevVal = previous[key];
      const currVal = current[key];

      if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
        changedFields.push(key);
        previousData[key] = prevVal;
        newData[key] = currVal;
      }
    }

    return { changedFields, previousData, newData };
  }

  static async createVersion(input: VersionCreateInput): Promise<void> {
    const { propertyId, previousData, newData, changeSource, changedBy, changeSummary } = input;
    const { changedFields } = this.computeDiff(previousData, newData);

    if (changedFields.length === 0) return;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { currentVersion: true },
    });

    if (!property) return;

    const nextVersion = property.currentVersion + 1;

    await prisma.$transaction([
      prisma.propertyVersion.create({
        data: {
          propertyId,
          version: nextVersion,
          changeSource,
          changedBy,
          changeSummary: changeSummary || `${changeSource} update: ${changedFields.join(", ")}`,
          previousData: previousData as unknown as Prisma.InputJsonValue,
          newData: newData as unknown as Prisma.InputJsonValue,
          changedFields,
        },
      }),
      prisma.property.update({
        where: { id: propertyId },
        data: { currentVersion: nextVersion },
      }),
      // If price changed, insert price history
      ...(changedFields.includes("price") && newData.price != null
        ? [
            prisma.priceHistory.create({
              data: {
                propertyId,
                price: newData.price as number,
                source: changeSource,
              },
            }),
          ]
        : []),
    ]);
  }

  static async getVersions(propertyId: string, page = 1, limit = 20) {
    const [versions, total] = await Promise.all([
      prisma.propertyVersion.findMany({
        where: { propertyId },
        orderBy: { version: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          editor: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.propertyVersion.count({ where: { propertyId } }),
    ]);

    return { versions, total };
  }

  static async getPriceHistory(propertyId: string) {
    return prisma.priceHistory.findMany({
      where: { propertyId },
      orderBy: { recordedAt: "asc" },
    });
  }
}
