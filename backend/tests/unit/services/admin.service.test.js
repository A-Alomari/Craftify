/**
 * Unit tests for admin.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const adminService = require("../../../src/services/admin.service");
const { fakeUser, fakeOrder } = require("../../fixtures/users");

describe("Admin Service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getDashboardStats", () => {
    it("should return aggregate platform stats", async () => {
      mockDb.user.count.mockResolvedValue(100);
      mockDb.product.count.mockResolvedValue(50);
      mockDb.order.count.mockResolvedValue(200);
      mockDb.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 15000.5 } });

      const result = await adminService.getDashboardStats();

      expect(result).toEqual({ users: 100, products: 50, orders: 200, revenue: 15000.5 });
    });

    it("should return 0 revenue when no orders", async () => {
      mockDb.user.count.mockResolvedValue(0);
      mockDb.product.count.mockResolvedValue(0);
      mockDb.order.count.mockResolvedValue(0);
      mockDb.order.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });

      const result = await adminService.getDashboardStats();

      expect(result.revenue).toBe(0);
    });
  });

  describe("listUsers", () => {
    it("should return all users", async () => {
      const users = [fakeUser(), fakeUser()];
      mockDb.user.findMany.mockResolvedValue(users);

      const result = await adminService.listUsers();

      expect(result).toHaveLength(2);
    });
  });

  describe("listOrders", () => {
    it("should return all orders with user info", async () => {
      mockDb.order.findMany.mockResolvedValue([fakeOrder()]);

      const result = await adminService.listOrders();

      expect(result).toHaveLength(1);
    });
  });

  describe("updateUser", () => {
    it("should update user data", async () => {
      const updated = { id: "u1", fullName: "New Name", email: "new@test.com", role: "ADMIN" };
      mockDb.user.update.mockResolvedValue(updated);

      const result = await adminService.updateUser("u1", { role: "ADMIN" });

      expect(mockDb.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "u1" }, data: { role: "ADMIN" } })
      );
      expect(result.role).toBe("ADMIN");
    });
  });
});
