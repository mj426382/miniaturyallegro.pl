# 08 – Integracja z Allegro

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |
| Powiązane | FR-ALG-001, NFR-SEC-006 |

## 1. Decyzje

- OAuth 2.0 Allegro (authorization code); `state` to podpisany JWT z `purpose: allegro-oauth`, który nie
  działa jako token sesji. Tokeny dostępu/odświeżania szyfrowane AES-256-GCM kluczem `ALLEGRO_TOKEN_KEY`;
  odświeżanie serializowane per użytkownik; uszkodzony wpis jest usuwany.
- Import: tylko obrazy z `allegroimg.com`, ≤ 10 MB; zdjęcie dostaje `allegroOfferId`.
- Publikacja: upload do `upload.allegro.pl/sale/images`, potem PATCH oferty (zdjęcie główne albo galeria).
- Bez konfiguracji (`ALLEGRO_CLIENT_ID`) integracja raportuje `configured: false`, UI pokazuje stan
  „nie włączona”; przycisk „Opublikuj na Allegro” na kartach pojawia się tylko po połączeniu konta.
- Odłączenie konta usuwa tokeny (z potwierdzeniem), zaimportowane zdjęcia zostają.

## 2. API

`GET /allegro/status`, `GET /allegro/auth-url`, `POST /allegro/callback {code,state}`,
`GET /allegro/offers?offset&limit&name`, `POST /allegro/import {offerId}`,
`POST /allegro/publish {generationId, offerId, asMain}`, `DELETE /allegro/connection`.

## 3. Kryteria akceptacji

- **AC-ALG-001** – Given brak poświadczeń klienta, When `GET /allegro/status`, Then `configured=false`, a `auth-url` zwraca błąd.
- **AC-ALG-002** – Given skonfigurowane API (mock), When użytkownik połączy konto, pobierze oferty, zaimportuje zdjęcie i opublikuje grafikę, Then każdy krok wywołuje właściwe endpointy Allegro, tokeny są zapisane zaszyfrowane, a zdjęcie ma `allegroOfferId`.
- **AC-ALG-003** – Given integracja niewłączona, When użytkownik otworzy stronę Allegro, Then widzi komunikat o braku konfiguracji, a nawigacja działa.
- **AC-ALG-004** – Given callback OAuth bez kodu, When otwarty, Then UI pokazuje błąd i wraca na stronę integracji.
- **AC-ALG-005** – Given szyfrowanie tokenów, When ten sam tekst jest szyfrowany dwa razy, Then szyfrogramy różnią się (świeży IV), a odszyfrowanie zwraca oryginał.
- **AC-ALG-006** – Given zły klucz lub zmodyfikowany szyfrogram, When odszyfrowanie, Then błąd.
