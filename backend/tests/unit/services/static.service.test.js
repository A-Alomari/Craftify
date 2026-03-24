/**
 * Unit tests for static.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const staticService = require("../../../src/services/static.service");
const { fakeFaq, fakeContactMessage } = require("../../fixtures/users");

describe("Static Service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("listFaqs", () => {
    it("should return list of FAQs", async () => {
      const faqs = [fakeFaq(), fakeFaq()];
      mockDb.faq.findMany.mockResolvedValue(faqs);

      const result = await staticService.listFaqs();

      expect(result).toHaveLength(2);
    });

    it("should return empty array when no FAQs exist", async () => {
      mockDb.faq.findMany.mockResolvedValue([]);

      const result = await staticService.listFaqs();
      expect(result).toHaveLength(0);
    });
  });

  describe("createContactMessage", () => {
    it("should create contact message", async () => {
      const msg = fakeContactMessage({ name: "Jane", email: "jane@t.com", message: "Hi there!" });
      mockDb.contactMessage.create.mockResolvedValue(msg);

      const result = await staticService.createContactMessage({
        name: "Jane",
        email: "jane@t.com",
        message: "Hi there!",
      });

      expect(mockDb.contactMessage.create).toHaveBeenCalledWith({
        data: { name: "Jane", email: "jane@t.com", message: "Hi there!" },
      });
      expect(result.name).toBe("Jane");
    });
  });
});
