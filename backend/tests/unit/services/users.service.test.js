/**
 * Unit tests for users.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const usersService = require("../../../src/services/users.service");
const { fakeUser } = require("../../fixtures/users");

describe("Users Service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getCurrentUser", () => {
    it("should return user profile with artisan profile", async () => {
      const user = {
        id: "u1",
        fullName: "Alice",
        email: "alice@test.com",
        role: "ARTISAN",
        avatarUrl: null,
        bio: "Crafter",
        artisanProfile: { shopName: "Alice Shop" },
      };
      mockDb.user.findUnique.mockResolvedValue(user);

      const result = await usersService.getCurrentUser("u1");

      expect(result.fullName).toBe("Alice");
      expect(result.artisanProfile.shopName).toBe("Alice Shop");
    });

    it("should return null for non-existent user", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const result = await usersService.getCurrentUser("bad");
      expect(result).toBeNull();
    });
  });

  describe("updateCurrentUser", () => {
    it("should update user profile fields", async () => {
      const updated = { id: "u1", fullName: "New Name", email: "new@test.com", role: "BUYER", avatarUrl: null, bio: "Updated" };
      mockDb.user.update.mockResolvedValue(updated);

      const result = await usersService.updateCurrentUser("u1", { fullName: "New Name", bio: "Updated" });

      expect(mockDb.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: { fullName: "New Name", bio: "Updated" },
        })
      );
      expect(result.fullName).toBe("New Name");
    });
  });
});
