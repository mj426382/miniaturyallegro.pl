# ADR-0003: Eksport liczony na serwerze (sharp), podgląd w CSS, kadr jako ułamki obróconego obrazu

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Data | 2026-10-02 |

## Kontekst

Sprzedawcy potrzebują formatów Allegro bez białych pasów, obrotu i prostej korekty. Przetwarzanie w
przeglądarce (canvas) różni się między urządzeniami, a telefony mają ograniczoną pamięć.

## Decyzja

- Jedyne źródło prawdy to serwer: `POST /generation/export/:id` z `crop`, `rotate`, `adjust`, plakietką;
  sharp wykonuje obrót → kadr → skalowanie → korektę → plakietkę → format.
- Kadr jest przesyłany jako ułamki 0–1 względem **obróconego** obrazu (tak raportuje `react-easy-crop`);
  serwer zamienia je na piksele po obrocie i odrzuca kadr poza obrazem lub mniejszy niż 10 % boku.
- Podgląd korekt w UI to filtry CSS o tych samych wzorach co `modulate`/`linear` w sharp; wyostrzenie
  nie ma podglądu i jest tak opisane.
- Modal eksportu ma dwa kroki (format i kadr → korekta i plakietka), żeby nie przytłaczać na telefonie.

## Konsekwencje

- Zero kosztu AI; eksport jest bezpłatny i powtarzalny.
- Dodanie nowego formatu = wpis w `EXPORT_RATIOS` + preset w modalu + AC w `06-export.md`.
