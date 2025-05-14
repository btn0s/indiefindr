import { DrizzleGameRepository } from "../drizzle-game-repository";
import { db } from "@/db";
import { externalSourceTable } from "@/db/schema";
import { eq } from "drizzle-orm";

// Mock the database and logger
jest.mock("@/db", () => ({
  db: {
    query: {
      externalSourceTable: {
        findFirst: jest.fn(),
      },
    },
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              offset: jest.fn(() => Promise.resolve([])),
            })),
          })),
        })),
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([])),
        })),
        limit: jest.fn(() => Promise.resolve([])),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([{ id: 1 }])),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([{ id: 1 }])),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([{ id: 1 }])),
      })),
    })),
  },
  schema: {
    externalSourceTable,
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("DrizzleGameRepository", () => {
  let repository: DrizzleGameRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DrizzleGameRepository();
  });

  describe("getById", () => {
    it("should return a game when found", async () => {
      const mockGame = { id: 1, title: "Test Game" };
      (db.query.externalSourceTable.findFirst as jest.Mock).mockResolvedValue(mockGame);

      const result = await repository.getById(1);

      expect(db.query.externalSourceTable.findFirst).toHaveBeenCalledWith({
        where: eq(externalSourceTable.id, 1),
      });
      expect(result).toEqual(mockGame);
    });

    it("should return null when game not found", async () => {
      (db.query.externalSourceTable.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.getById(999);

      expect(result).toBeNull();
    });

    it("should throw an error when database query fails", async () => {
      const error = new Error("Database error");
      (db.query.externalSourceTable.findFirst as jest.Mock).mockRejectedValue(error);

      await expect(repository.getById(1)).rejects.toThrow("Failed to get game by ID");
    });
  });

  describe("getBySteamAppId", () => {
    it("should return a game when found", async () => {
      const mockGame = { id: 1, title: "Test Game", steamAppid: "123456" };
      (db.query.externalSourceTable.findFirst as jest.Mock).mockResolvedValue(mockGame);

      const result = await repository.getBySteamAppId("123456");

      expect(db.query.externalSourceTable.findFirst).toHaveBeenCalledWith({
        where: eq(externalSourceTable.steamAppid, "123456"),
      });
      expect(result).toEqual(mockGame);
    });
  });

  describe("create", () => {
    it("should create a game and return it", async () => {
      const gameData = {
        title: "New Game",
        externalId: "ext123",
        steamAppid: "123456",
      };
      const mockCreatedGame = { id: 1, ...gameData };

      (db.insert as jest.Mock)().values.mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockCreatedGame]),
      });

      const result = await repository.create(gameData);

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedGame);
    });
  });

  describe("update", () => {
    it("should update a game and return it", async () => {
      const updateData = {
        title: "Updated Game",
      };
      const mockUpdatedGame = { id: 1, title: "Updated Game" };

      (db.update as jest.Mock)().set.mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockUpdatedGame]),
        }),
      });

      const result = await repository.update(1, updateData);

      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedGame);
    });

    it("should return null when game not found", async () => {
      (db.update as jest.Mock)().set.mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.update(999, { title: "Not Found" });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete a game and return true", async () => {
      (db.delete as jest.Mock)().where.mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 1 }]),
      });

      const result = await repository.delete(1);

      expect(db.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false when game not found", async () => {
      (db.delete as jest.Mock)().where.mockReturnValue({
        returning: jest.fn().mockResolvedValue([]),
      });

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });

  // Additional tests for other methods would follow the same pattern
});

