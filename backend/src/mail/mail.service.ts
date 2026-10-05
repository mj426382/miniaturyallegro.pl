import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Extra headers, e.g. List-Unsubscribe for marketing mail (spec 16). */
  headers?: Record<string, string>;
}

/**
 * Transactional e-mail via SMTP (nodemailer).
 *
 * When SMTP is not configured (local development, tests) messages are logged
 * instead of sent, so flows like password reset remain testable.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(private configService: ConfigService) {
    const host = configService.get<string>('SMTP_HOST');
    const port = Number(configService.get<string>('SMTP_PORT') || 587);
    const user = configService.get<string>('SMTP_USER');
    const pass = configService.get<string>('SMTP_PASS');
    this.from = configService.get<string>('MAIL_FROM') || 'AllGrafika <no-reply@allgrafika.pl>';

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
      this.logger.log(`Mail: SMTP transport configured (${host}:${port})`);
    } else {
      this.logger.warn('Mail: SMTP_HOST not set – e-mails will be logged instead of sent');
    }
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      // Never log the full body in production – it may contain reset links.
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(`Mail not sent (SMTP not configured): "${message.subject}"`);
      } else {
        this.logger.log(`[DEV MAIL] to=${message.to} subject="${message.subject}"\n${message.text}`);
      }
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
