import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';

/**
 * Replicates the securityPolicy logic from utils/securityPolicy.js so that the
 * DTO validator picks up PASSWORD_MIN_LENGTH at runtime (not compile time).
 *
 * Rules (same as legacy):
 *   - Production (non-test): default 10, env override via PASSWORD_MIN_LENGTH
 *   - All other envs: default 6, env override via PASSWORD_MIN_LENGTH
 *   - Minimum accepted env value: 6 (lower values are ignored)
 */
function resolveMinPasswordLength(): number {
  const isProduction = process.env.NODE_ENV === 'production';
  const isJest =
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.JEST_WORKER_ID) ||
    process.argv.some((a) => a.includes('jest'));
  const defaultMin = isProduction && !isJest ? 10 : 6;
  const envParsed = parseInt(process.env.PASSWORD_MIN_LENGTH || '', 10);
  return Number.isInteger(envParsed) && envParsed >= 6 ? envParsed : defaultMin;
}

@ValidatorConstraint({ name: 'passwordMinLength', async: false })
export class PasswordMinLengthConstraint implements ValidatorConstraintInterface {
  validate(password: string): boolean {
    return typeof password === 'string' && password.length >= resolveMinPasswordLength();
  }

  defaultMessage(): string {
    return `Password must be at least ${resolveMinPasswordLength()} characters`;
  }
}

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name: string;

  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;

  @IsString()
  @Validate(PasswordMinLengthConstraint)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
