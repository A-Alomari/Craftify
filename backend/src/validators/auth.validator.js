const { z } = require("zod");

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(["BUYER", "ARTISAN"]).default("BUYER"),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.email(),
});

const verifyCodeSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
});

const resetPasswordSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyCodeSchema,
  resetPasswordSchema,
};