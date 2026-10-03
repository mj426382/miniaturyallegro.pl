# Przykłady „przed / po”

Wrzuć tu PRAWDZIWE pary zdjęć wygenerowane w AllGrafika (masz prawa do zdjęcia produktu):

```
kubek-before.jpg      <- oryginalne zdjęcie z telefonu
kubek-after.jpg       <- grafika z AllGrafika (najlepiej 1:1, 1200×1200)
sluchawki-before.webp
sluchawki-after.webp
captions.json         <- opcjonalne podpisy
```

`captions.json`:

```json
{
  "kubek": { "title": "Kubek ceramiczny – kategoria Dom", "style": "Białe tło" },
  "sluchawki": { "title": "Słuchawki – Elektronika", "style": "Ciemny luksus" }
}
```

Sekcja „Przed / po” na stronie głównej pojawia się automatycznie po `npm run build`,
gdy istnieje co najmniej jedna para. Bez par sekcja jest ukryta – nigdy nie pokazujemy
wymyślonych przykładów. Zalecane: 6–8 par z różnych kategorii (elektronika, kosmetyki,
odzież, dom, zabawki), zdjęcia „przed” celowo niedoskonałe (telefon, kuchenny blat).
