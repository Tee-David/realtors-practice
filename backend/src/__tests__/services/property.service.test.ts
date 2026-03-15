import { PropertyService } from "../../services/property.service";

/* ------------------------------------------------------------------ */
/*  Mock Prisma client                                                 */
/* ------------------------------------------------------------------ */

const mockPrisma = {
  property: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  priceHistory: {
    create: jest.fn(),
  },
};

jest.mock("../../prismaClient", () => ({
  __esModule: true,
  default: mockPrisma,
}));

/* ------------------------------------------------------------------ */
/*  Mock dependent services                                            */
/* ------------------------------------------------------------------ */

jest.mock("../../services/dedup.service", () => ({
  DedupService: {
    generateHash: jest.fn().mockReturnValue("test-hash-123"),
    findExisting: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock("../../services/quality.service", () => ({
  QualityService: {
    score: jest.fn().mockReturnValue({ total: 72 }),
  },
}));

jest.mock("../../services/version.service", () => ({
  VersionService: {
    createVersion: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../services/meili.service", () => ({
  MeiliService: {
    upsertProperty: jest.fn(),
    deleteProperty: jest.fn(),
  },
}));

jest.mock("../../utils/logger.util", () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const SAMPLE_PROPERTY = {
  id: "clx1abc123",
  hash: "test-hash-123",
  title: "3 Bedroom Flat in Lekki Phase 1",
  listingUrl: "https://example.com/listing/123",
  source: "example",
  siteId: "site-001",
  status: "AVAILABLE",
  listingType: "SALE",
  category: "RESIDENTIAL",
  price: 25_000_000,
  priceCurrency: "NGN",
  state: "Lagos",
  area: "Lekki",
  qualityScore: 72,
  currentVersion: 1,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  deletedAt: null,
  site: { id: "site-001", name: "Example", key: "example" },
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("PropertyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── List ────────────────────────────────────────────────────────────

  describe("list", () => {
    it("should return paginated properties with total count", async () => {
      const properties = [SAMPLE_PROPERTY];
      mockPrisma.property.findMany.mockResolvedValue(properties);
      mockPrisma.property.count.mockResolvedValue(1);

      const result = await PropertyService.list({
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result).toEqual({
        data: properties,
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(mockPrisma.property.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.property.count).toHaveBeenCalledTimes(1);
    });
  });

  // ── Get by ID ───────────────────────────────────────────────────────

  describe("getById", () => {
    it("should return a property when it exists", async () => {
      mockPrisma.property.findFirst.mockResolvedValue(SAMPLE_PROPERTY);

      const result = await PropertyService.getById("clx1abc123");

      expect(result).toEqual(SAMPLE_PROPERTY);
      expect(mockPrisma.property.findFirst).toHaveBeenCalledWith({
        where: { id: "clx1abc123", deletedAt: null },
        include: expect.objectContaining({
          site: expect.any(Object),
        }),
      });
    });

    it("should return null when property does not exist", async () => {
      mockPrisma.property.findFirst.mockResolvedValue(null);

      const result = await PropertyService.getById("nonexistent");

      expect(result).toBeNull();
    });
  });

  // ── Create ──────────────────────────────────────────────────────────

  describe("create", () => {
    it("should create a property with quality score and return it", async () => {
      mockPrisma.property.create.mockResolvedValue(SAMPLE_PROPERTY);

      const input = {
        title: "3 Bedroom Flat in Lekki Phase 1",
        listingUrl: "https://example.com/listing/123",
        source: "example",
        siteId: "site-001",
        listingType: "SALE" as const,
        price: 25_000_000,
      };

      const result = await PropertyService.create(input as any);

      expect(result.duplicate).toBe(false);
      expect(result.property).toEqual(SAMPLE_PROPERTY);
      expect(mockPrisma.property.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── Soft Delete ─────────────────────────────────────────────────────

  describe("softDelete", () => {
    it("should soft delete an existing property", async () => {
      mockPrisma.property.findFirst.mockResolvedValue(SAMPLE_PROPERTY);
      mockPrisma.property.update.mockResolvedValue({
        ...SAMPLE_PROPERTY,
        deletedAt: new Date(),
      });

      const result = await PropertyService.softDelete("clx1abc123");

      expect(result).toBeTruthy();
      expect(result!.deletedAt).toBeTruthy();
      expect(mockPrisma.property.update).toHaveBeenCalledWith({
        where: { id: "clx1abc123" },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("should return null when property does not exist", async () => {
      mockPrisma.property.findFirst.mockResolvedValue(null);

      const result = await PropertyService.softDelete("nonexistent");

      expect(result).toBeNull();
      expect(mockPrisma.property.update).not.toHaveBeenCalled();
    });
  });
});
