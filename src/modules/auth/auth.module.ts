import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGenerateToken } from 'src/common/utills/jwt';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtGenerateToken]
})
export class AuthModule {}
