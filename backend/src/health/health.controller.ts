import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

export const HEALTH_LIMIT_PER_MINUTE = 60;

/**
 * Liveness/readiness probe for Docker healthchecks and uptime monitoring.
 * Intentionally returns no configuration details.
 */
@ApiTags('health')
// Spec 01, AC-SEC-013: public and touches the database – 60/min per IP is far above any probe
// (Docker checks every 30 s from localhost) but stops a flood from turning into DB load.
@Throttle({ default: { limit: HEALTH_LIMIT_PER_MINUTE, ttl: 60_000 } })
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + database readiness probe' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
  }
}
