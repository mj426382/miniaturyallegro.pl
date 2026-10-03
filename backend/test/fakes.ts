import sharp from 'sharp';
import { GenerationStyle } from '../src/generation/styles';
import { GeneratedImage, OfferCopy, OfferCopyInput } from '../src/generation/gemini.service';
import { MailMessage } from '../src/mail/mail.service';

/** 64x64 PNG used as "generated" output and as upload fixture. */
export async function makePng(color = { r: 200, g: 30, b: 30 }, size = 64): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 3, background: color } })
    .png()
    .toBuffer();
}

export async function makeJpeg(size = 128): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 3, background: { r: 10, g: 120, b: 200 } } })
    .jpeg()
    .toBuffer();
}

/**
 * Deterministic stand-in for GeminiService. No network. Failures can be
 * injected per style id to test refunds and retries.
 */
export class FakeGeminiService {
  failStyles = new Set<string>();
  failDescription = false;
  failOfferCopy = false;
  calls = { description: 0, prompts: 0, image: 0, custom: 0, rework: 0, offerCopy: 0 };
  lastOfferCopyInput: OfferCopyInput | null = null;
  delayMs = 0;
  private png: Buffer | null = null;

  async generateImageDescription(): Promise<string> {
    this.calls.description++;
    if (this.failDescription) throw new Error('description failed');
    return 'A red cube product with a white logo.';
  }

  async generateAllStylePrompts(_description: string, styles: GenerationStyle[]): Promise<Map<string, string>> {
    this.calls.prompts++;
    return new Map(styles.map((s) => [s.id, `prompt-for-${s.id}`]));
  }

  async generatePromptForStyle(_d: string, style: GenerationStyle): Promise<string> {
    return `prompt-for-${style.id}`;
  }

  async generateCustomPrompt(_d: string, userPrompt: string): Promise<string> {
    this.calls.custom++;
    return `custom:${userPrompt}`;
  }

  async generateReworkPrompt(_d: string, userPrompt: string): Promise<string> {
    this.calls.rework++;
    return `rework:${userPrompt}`;
  }

  async generateOfferCopy(input: OfferCopyInput): Promise<OfferCopy> {
    this.calls.offerCopy++;
    this.lastOfferCopyInput = input;
    if (this.failOfferCopy) throw new Error('offer copy failed');
    if (input.current && input.instruction) {
      return {
        title: `${input.current.title} (poprawiony)`,
        body: `${input.current.body}<p>Poprawka: ${input.instruction}</p>`,
        keywords: [...input.current.keywords, 'poprawka'],
      };
    }
    return {
      title: `Kubek ceramiczny 350 ml – ${input.sellerNotes || 'z analizy zdjęcia'}`,
      body:
        '<h1>Kubek ceramiczny</h1><p onclick="x()">Solidny kubek <strong>350 ml</strong> do codziennego użytku, zmywarka OK.</p>' +
        '<script>alert(1)</script><h2>Najważniejsze cechy</h2><ul><li>pojemność 350 ml</li><li>szkliwo</li></ul>',
      keywords: ['Kubek ceramiczny', 'kubek 350 ml', 'KUBEK CERAMICZNY', 42 as any],
    };
  }

  async generateImage(_b64: string, _mime: string, prompt: string): Promise<GeneratedImage> {
    this.calls.image++;
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    for (const style of this.failStyles) {
      if (prompt.includes(style)) throw new Error(`simulated failure for ${style}`);
    }
    if (!this.png) this.png = await makePng();
    return { base64: this.png.toString('base64'), mimeType: 'image/png' };
  }
}

/** Captures outgoing e-mails so tests can read reset links. */
export class FakeMailService {
  sent: MailMessage[] = [];
  readonly isConfigured = true;
  async send(message: MailMessage) {
    this.sent.push(message);
  }
  lastResetToken(): string | undefined {
    const last = this.sent[this.sent.length - 1];
    return last?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  }
}
