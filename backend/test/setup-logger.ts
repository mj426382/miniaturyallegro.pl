import { Logger } from '@nestjs/common';

// Keep test output readable – application logs are noise here.
Logger.overrideLogger(['error']);
