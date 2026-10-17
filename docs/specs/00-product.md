# 00 – Produkt: AllGrafika.pl

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła (Jan-Mat Mateusz Janduła, NIP 9482625280) |
| Data | 2026-10-03 |

## Wizja

Sprzedawca na OLX, Vinted, eBay, Amazon albo we własnym sklepie internetowym wrzuca zdjęcie produktu
z telefonu i w kilka minut ma zestaw profesjonalnych miniaturek w formatach wybranej platformy oraz gotowy
opis oferty pod jej wyszukiwarkę. Bez fotografa, bez grafika, bez
nauki narzędzi. Produkt na grafice jest wierny oryginałowi (kształt, kolory, logo, napisy).

## Persony

1. **Mikrosprzedawca** (1–50 ofert, sam robi zdjęcia telefonem). Płaci pakietami, liczy każdą złotówkę,
   korzysta głównie z telefonu. Główny klient.
2. **Mały sklep** (50–500 SKU, osoba od ofert). Dodaje produkty hurtowo, potrzebuje abonamentu,
   eksportu pod kilka platform naraz i spójnych grafik dla całego asortymentu.
3. **Agencja / freelancer** obsługujący kilku sprzedawców. Potrzebuje szybkości i eksportu w wielu formatach.

## Cele i metryki

| Cel | Metryka | Próg |
|---|---|---|
| Aktywacja | % nowych kont, które wygenerowały ≥1 grafikę w 24 h | ≥ 60 % |
| Jakość | % grafik ocenionych kciukiem w górę / ocenionych | ≥ 80 % |
| Monetyzacja | % kont, które kupiły pakiet lub abonament w 30 dni | ≥ 8 % |
| Koszt | koszt AI na 1 kredyt sprzedany | ≤ 0,20 zł |
| Szybkość | Lighthouse landing (mobile) perf / SEO | ≥ 90 / 100 |
| Dostępność | Brak naruszeń WCAG 2.1 AA o wadze serious/critical (axe) | 0 |

## Zasady produktowe

- **Produkt jest święty**: AI zmienia tło, scenę i światło, nigdy kształt, kolor, logo i napisy.
- **Płacisz za to, co wybierasz**: zestaw startowy to 3 kredyty, resztę dogenerujesz; opis oferty jest gratis.
- **Nieudane = zwrócone**: generacja zakończona błędem technicznego zwraca kredyt automatycznie.
- **Telefon jest pierwszy**: każdy przepływ działa na iPhone i Androidzie, pobieranie trafia do Zdjęć.
- **Zgodnie z prawem polskim**: regulamin, prawo odstąpienia, RODO, zakaz nieuczciwych praktyk w opisach.

## Poza zakresem (świadomie)

- Edytor graficzny ogólnego przeznaczenia (warstwy, tekst dowolny) – robimy tylko to, czego wymagają platformy sprzedażowe.
- Integracje z marketplace'ami (OAuth, publikacja ofert) – dajemy presety eksportu i opisu, nie integracje (08).
  Integracja z Allegro została usunięta 2026-10-17 (decyzja właściciela).
- Aplikacje natywne – PWA/web wystarcza.
- Wielojęzyczność – produkt jest po polsku.
