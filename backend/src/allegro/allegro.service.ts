import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { MAX_UPLOAD_BYTES, validateImageBuffer } from '../images/image-validation';
import { decrypt, deriveKey, encrypt } from '../common/crypto';

/**
 * Allegro REST API integration (OAuth2 authorization code flow).
 *
 * Endpoints used (https://developer.allegro.pl/documentation):
 *   GET  /me                               – seller login
 *   GET  /sale/offers                       – list seller's offers with primary image
 *   GET  /sale/product-offers/{id}          – offer details (current images)
 *   POST https://upload.allegro.pl/sale/images – register an image by URL
 *   PATCH /sale/product-offers/{id}         – replace the images list
 */
export interface AllegroOfferSummary {
  id: string;
  name: string;
  primaryImage: string | null;
  status: string;
  price: string | null;
}

const ALLEGRO_JSON = 'application/vnd.allegro.public.v1+json';
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const STATE_TTL = '10m';

@Injectable()
export class AllegroService {
  private readonly logger = new Logger(AllegroService.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri: string;
  private readonly authBase: string;
  private readonly apiBase: string;
  private readonly uploadBase: string;
  private readonly key: Buffer;
  private http: AxiosInstance;
  /** In-flight refreshes per user – Allegro rotates refresh tokens, so two parallel refreshes would invalidate each other. */
  private readonly refreshing = new Map<string, Promise<string>>();

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private jwt: JwtService,
    config: ConfigService,
  ) {
    this.clientId = config.get<string>('ALLEGRO_CLIENT_ID') || undefined;
    this.clientSecret = config.get<string>('ALLEGRO_CLIENT_SECRET') || undefined;
    const frontend = (config.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
    this.redirectUri = config.get<string>('ALLEGRO_REDIRECT_URI') || `${frontend}/allegro/callback`;
    const sandbox = config.get<string>('ALLEGRO_SANDBOX') === 'true';
    this.authBase = sandbox ? 'https://allegro.pl.allegrosandbox.pl' : 'https://allegro.pl';
    this.apiBase = sandbox ? 'https://api.allegro.pl.allegrosandbox.pl' : 'https://api.allegro.pl';
    this.uploadBase = sandbox ? 'https://upload.allegro.pl.allegrosandbox.pl' : 'https://upload.allegro.pl';
    this.key = deriveKey(config.get<string>('ALLEGRO_TOKEN_KEY') || config.get<string>('JWT_SECRET') || 'dev');
    this.http = axios.create({ timeout: 30_000 });
  }

  /** Tests inject an axios mock. */
  setHttpClient(client: AxiosInstance) {
    this.http = client;
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private requireConfigured() {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Integracja z Allegro nie jest skonfigurowana');
    }
  }

  // ─── Connection lifecycle ─────────────────────────────────────────

  async getStatus(userId: string) {
    const conn = await this.prisma.allegroConnection.findUnique({ where: { userId } });
    return {
      configured: this.isConfigured,
      connected: Boolean(conn),
      sellerLogin: conn?.sellerLogin ?? null,
      connectedAt: conn?.createdAt ?? null,
    };
  }

  getAuthUrl(userId: string) {
    this.requireConfigured();
    const state = this.jwt.sign({ sub: userId, purpose: 'allegro-oauth' }, { expiresIn: STATE_TTL });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId!,
      redirect_uri: this.redirectUri,
      state,
    });
    return { url: `${this.authBase}/auth/oauth/authorize?${params.toString()}` };
  }

  async handleCallback(userId: string, code: string, state: string) {
    this.requireConfigured();
    let payload: any;
    try {
      payload = this.jwt.verify(state);
    } catch {
      throw new UnauthorizedException('Nieprawidłowy lub wygasły stan autoryzacji Allegro');
    }
    if (payload?.sub !== userId || payload?.purpose !== 'allegro-oauth') {
      throw new UnauthorizedException('Stan autoryzacji nie pasuje do użytkownika');
    }

    const tokens = await this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri });
    const sellerLogin = await this.fetchSellerLogin(tokens.access_token).catch(() => null);

    await this.prisma.allegroConnection.upsert({
      where: { userId },
      create: {
        userId,
        accessTokenEncrypted: encrypt(tokens.access_token, this.key),
        refreshTokenEncrypted: encrypt(tokens.refresh_token, this.key),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        sellerLogin,
      },
      update: {
        accessTokenEncrypted: encrypt(tokens.access_token, this.key),
        refreshTokenEncrypted: encrypt(tokens.refresh_token, this.key),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        sellerLogin,
      },
    });
    this.logger.log(`Allegro account connected for user ${userId}`);
    return { connected: true, sellerLogin };
  }

  async disconnect(userId: string) {
    await this.prisma.allegroConnection.deleteMany({ where: { userId } });
    return { connected: false };
  }

  // ─── Offers ───────────────────────────────────────────────────────

  async listOffers(
    userId: string,
    options: { offset?: number; limit?: number; name?: string } = {},
  ): Promise<{ offers: AllegroOfferSummary[]; total: number }> {
    const token = await this.getAccessToken(userId);
    const params: Record<string, string | number> = {
      limit: Math.min(Math.max(options.limit ?? 20, 1), 50),
      offset: Math.max(options.offset ?? 0, 0),
      'publication.status': 'ACTIVE',
    };
    if (options.name) params.name = options.name.slice(0, 100);

    const { data } = await this.http.get(`${this.apiBase}/sale/offers`, {
      params,
      headers: { Authorization: `Bearer ${token}`, Accept: ALLEGRO_JSON },
    });

    const offers: AllegroOfferSummary[] = (data.offers ?? []).map((o: any) => ({
      id: String(o.id),
      name: o.name,
      primaryImage: o.primaryImage?.url ?? null,
      status: o.publication?.status ?? 'UNKNOWN',
      price: o.sellingMode?.price?.amount ? `${o.sellingMode.price.amount} ${o.sellingMode.price.currency}` : null,
    }));
    return { offers, total: data.totalCount ?? offers.length };
  }

  /** Downloads the offer's main photo and stores it as a new Image of the user. */
  async importOfferImage(userId: string, offerId: string) {
    const token = await this.getAccessToken(userId);
    const offer = await this.getOffer(token, offerId);
    const firstImage = offer.images?.[0];
    const imageUrl: string | undefined =
      (typeof firstImage === 'string' ? firstImage : firstImage?.url) ?? offer.primaryImage?.url;
    if (!imageUrl || !/^https:\/\/[a-z0-9.-]+\.allegroimg\.com\//i.test(imageUrl)) {
      throw new NotFoundException('Oferta nie ma zdjęcia do zaimportowania');
    }

    const { data } = await this.http.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxContentLength: MAX_UPLOAD_BYTES,
      maxBodyLength: MAX_UPLOAD_BYTES,
    });
    const buffer = Buffer.from(data);
    const validated = await validateImageBuffer(buffer);
    const { url, filename } = await this.storage.uploadFile(
      buffer,
      `allegro${validated.extension}`,
      validated.mimeType,
      'originals',
    );

    const image = await this.prisma.image.create({
      data: { userId, originalUrl: url, filename, allegroOfferId: String(offerId) },
    });
    return { id: image.id, offerId: String(offerId), offerName: offer.name ?? null };
  }

  /**
   * Publishes a generated graphic to an offer. `position: 'first'` makes it the main
   * photo (use the white-background style for that), `'last'` appends it to the gallery.
   */
  async publishGeneration(userId: string, offerId: string, generationId: string, position: 'first' | 'last' = 'first') {
    const generation = await this.prisma.generation.findUnique({
      where: { id: generationId },
      include: { image: true },
    });
    if (!generation || generation.image.userId !== userId) throw new NotFoundException('Nie znaleziono grafiki');
    if (generation.status !== 'COMPLETED' || !generation.url) throw new BadRequestException('Grafika nie jest gotowa');

    const token = await this.getAccessToken(userId);
    const headers = { Authorization: `Bearer ${token}`, Accept: ALLEGRO_JSON, 'Content-Type': ALLEGRO_JSON };

    // 1. Allegro fetches the image from a public URL – our presigned link is valid for hours.
    const publicUrl = await this.storage.getSignedUrl(generation.url);
    if (!publicUrl.startsWith('http')) {
      throw new BadRequestException('Publikacja wymaga magazynu plików dostępnego publicznie (Backblaze B2)');
    }
    const uploadRes = await this.http.post(`${this.uploadBase}/sale/images`, { url: publicUrl }, { headers });
    const location: string | undefined = uploadRes.data?.location;
    if (!location) throw new BadRequestException('Allegro nie przyjęło obrazu');

    // 2. Replace the images list, keeping the existing ones.
    const offer = await this.getOffer(token, offerId);
    const current: string[] = (offer.images ?? [])
      .map((img: any) => (typeof img === 'string' ? img : img.url))
      .filter(Boolean);
    const images = position === 'first' ? [location, ...current] : [...current, location];
    await this.http.patch(
      `${this.apiBase}/sale/product-offers/${encodeURIComponent(offerId)}`,
      { images },
      { headers },
    );

    this.logger.log(`Published generation ${generationId} to Allegro offer ${offerId} (${position})`);
    return { offerId: String(offerId), imagesCount: images.length, position };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async getOffer(token: string, offerId: string) {
    const { data } = await this.http.get(`${this.apiBase}/sale/product-offers/${encodeURIComponent(offerId)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: ALLEGRO_JSON },
    });
    return data;
  }

  private async fetchSellerLogin(accessToken: string): Promise<string | null> {
    const { data } = await this.http.get(`${this.apiBase}/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: ALLEGRO_JSON },
    });
    return data?.login ?? null;
  }

  private async tokenRequest(
    form: Record<string, string>,
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    try {
      const { data } = await this.http.post(`${this.authBase}/auth/oauth/token`, new URLSearchParams(form).toString(), {
        auth: { username: this.clientId!, password: this.clientSecret! },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return data;
    } catch (err: any) {
      const detail = err?.response?.data?.error_description || err?.response?.data?.error || err?.message;
      this.logger.error(`Allegro token request failed: ${detail}`);
      throw new UnauthorizedException('Autoryzacja Allegro nie powiodła się. Połącz konto ponownie.');
    }
  }

  private async getAccessToken(userId: string): Promise<string> {
    this.requireConfigured();
    const conn = await this.prisma.allegroConnection.findUnique({ where: { userId } });
    if (!conn) throw new NotFoundException('Konto Allegro nie jest połączone');

    if (conn.expiresAt.getTime() - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
      return this.safeDecrypt(userId, conn.accessTokenEncrypted);
    }

    const inFlight = this.refreshing.get(userId);
    if (inFlight) return inFlight;

    const refresh = (async () => {
      // Re-read inside the lock: another request may have refreshed meanwhile.
      const fresh = await this.prisma.allegroConnection.findUnique({ where: { userId } });
      if (!fresh) throw new NotFoundException('Konto Allegro nie jest połączone');
      if (fresh.expiresAt.getTime() - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
        return this.safeDecrypt(userId, fresh.accessTokenEncrypted);
      }
      const refreshToken = await this.safeDecrypt(userId, fresh.refreshTokenEncrypted);
      const tokens = await this.tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        redirect_uri: this.redirectUri,
      });
      await this.prisma.allegroConnection.update({
        where: { userId },
        data: {
          accessTokenEncrypted: encrypt(tokens.access_token, this.key),
          refreshTokenEncrypted: encrypt(tokens.refresh_token, this.key),
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });
      return tokens.access_token;
    })().finally(() => this.refreshing.delete(userId));

    this.refreshing.set(userId, refresh);
    return refresh;
  }

  /** A row encrypted with a previous key is unusable – drop it and ask the user to reconnect. */
  private async safeDecrypt(userId: string, payload: string): Promise<string> {
    try {
      return decrypt(payload, this.key);
    } catch {
      this.logger.warn(`Allegro tokens for user ${userId} could not be decrypted – connection removed`);
      await this.prisma.allegroConnection.deleteMany({ where: { userId } });
      throw new NotFoundException('Połączenie z Allegro wygasło. Połącz konto ponownie.');
    }
  }
}
