import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check — verifies API and DB connectivity' })
  @ApiResponse({ status: 200, description: 'API is running' })
  async getHealth(): Promise<{ status: string; timestamp: string; db: string }> {
    return this.appService.getHealth();
  }
}
