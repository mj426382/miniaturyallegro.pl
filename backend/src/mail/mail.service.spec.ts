import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

function serviceWith(env: Record<string, string>) {
  const sendMail = jest.fn().mockResolvedValue({});
  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  const service = new MailService({ get: (key: string) => env[key] } as unknown as ConfigService);
  return { service, sendMail };
}

describe('MailService (spec 16)', () => {
  const message = { to: 'user@example.com', subject: 'Temat', text: 'Treść' };

  it('[AC-ADM-013] sends every e-mail with Reply-To kontakt@allgrafika.pl by default', async () => {
    const { service, sendMail } = serviceWith({ SMTP_HOST: 'smtp.test' });
    await service.send(message);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'AllGrafika <no-reply@allgrafika.pl>',
        replyTo: 'kontakt@allgrafika.pl',
        ...message,
      }),
    );
  });

  it('[AC-ADM-013] uses MAIL_REPLY_TO and lets an explicit replyTo win', async () => {
    const { service, sendMail } = serviceWith({ SMTP_HOST: 'smtp.test', MAIL_REPLY_TO: 'pomoc@allgrafika.pl' });
    await service.send(message);
    expect(sendMail).toHaveBeenLastCalledWith(expect.objectContaining({ replyTo: 'pomoc@allgrafika.pl' }));
    await service.send({ ...message, replyTo: 'inny@allgrafika.pl' });
    expect(sendMail).toHaveBeenLastCalledWith(expect.objectContaining({ replyTo: 'inny@allgrafika.pl' }));
  });
});
