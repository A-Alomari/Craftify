import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  current_password: string;

  @IsString()
  @MinLength(6)
  new_password: string;

  @IsNotEmpty()
  @IsString()
  confirm_password: string;
}
