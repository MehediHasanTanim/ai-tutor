import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The refresh token issued by login, register, or a prior refresh.' })
  @IsJWT({ message: 'refresh_token must be a valid token' })
  refresh_token: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'The refresh token for the session being ended.' })
  @IsJWT({ message: 'refresh_token must be a valid token' })
  refresh_token: string;
}
