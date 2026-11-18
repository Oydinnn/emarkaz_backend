import { Body, Controller, Post } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService : AuthService){}

    @Post("login")
    userLogin(@Body() payload : LoginDto){
        return this.authService.userLogin(payload)
    }

    @Post('refresh-token')
    refreshToken(@Body() payload : RefreshTokenDto){
        return this.authService.refreshToken(payload)
    }

}
