# ADR-0002: Kredyty rozliczane w transakcji z blokadą wiersza; reconciler zamiast kolejki

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Data | 2026-10-02 |

## Kontekst

Masowe przesyłanie i podwójne kliknięcia uruchamiały generacje równolegle. Saldo potrafiło zejść poniżej
zera, a limit generacji w toku był sprawdzany poza transakcją. Po restarcie kontenera generacje
zostawały w `PENDING` na zawsze, a kredyty przepadały.

## Decyzja

- `CreditsService.deduct` otwiera transakcję, blokuje wiersz użytkownika (`SELECT … FOR UPDATE`), liczy
  generacje w toku, pobiera kredyty (darmowe przed płatnymi) i w tej samej transakcji tworzy wiersze
  generacji (`within`). Zakup pakietu poprawek opisu używa tego samego mechanizmu.
- Przejścia stanów są warunkowe (`updateMany … where status = PENDING`), więc reconciler i procesor nie
  mogą obsłużyć tej samej generacji dwa razy ani zwrócić kredytu dwukrotnie.
- Zamiast zewnętrznej kolejki: semafor w procesie (`GEMINI_MAX_CONCURRENT`) i reconciler co 5 min,
  który generacje starsze niż 20 min oznacza jako nieudane i zwraca kredyty.

## Konsekwencje

- Jedna instancja backendu; przy skalowaniu poziomym limit współbieżności się mnoży – wtedy BullMQ/Redis
  (osobny ADR).
- Testy współbieżności wymagają sztucznego opóźnienia w atrapie Gemini (`delayMs`).
