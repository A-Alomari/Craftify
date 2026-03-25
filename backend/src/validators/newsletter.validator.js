const { z } = require("zod");

const newsletterSchema = z.object({
  email: z.email(),
});

module.exports = {
  newsletterSchema,
};
