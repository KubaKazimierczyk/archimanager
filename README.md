# ArchiManager

Aplikacja wspierająca architektów w zarządzaniu projektami budowlanymi — od inicjacji projektu, przez składanie wniosków urzędowych, aż po pozwolenie na budowę.

## Funkcje

- **Lista projektów** — zarządzanie wieloma projektami jednocześnie
- **Dane klienta** — z integracją API TERYT (autouzupełnianie adresów)
- **Dane działki** — integracja z e-Mapą Mazowsza, automatyczne pobieranie i analiza MPZP
- **Wnioski urzędowe** — zjazd z drogi, przyłącze wod-kan, energetyczne, adaptacja
- **Terminy ustawowe** — śledzenie deadlinów z paskami postępu
- **Predykcje ML** — bayesowski model predykcji czasu odpowiedzi urzędów
- **Kamienie milowe** — inicjacja → złożenie wniosków → odpowiedzi → pozwolenie na budowę
- **Generowanie wniosków** — wypełnianie formularzy danymi klienta i działki

## Stack technologiczny

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Deploy**: Netlify (Free Tier)
- **ML**: Bayesian prediction engine (client-side, docelowo Supabase Edge Functions)

## Szybki start

### 1. Instalacja

```bash
npm install
```

### 2. Konfiguracja Supabase (opcjonalne — bez tego działa tryb demo)

1. Utwórz projekt na [supabase.com](https://supabase.com)
2. Uruchom migrację SQL z `supabase/migration.sql` w SQL Editor
3. Utwórz bucket `project-files` w Storage
4. Skopiuj `.env.example` do `.env` i wypełnij klucze

```bash
cp .env.example .env
```

### 3. Uruchomienie

```bash
npm run dev
```

### 4. Deploy na Netlify

```bash
npm run build
# Upload folderu dist/ na Netlify
# Lub połącz repo z Netlify (auto-deploy)
```

W Netlify ustaw zmienne środowiskowe:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Tryb demo

Bez skonfigurowanego Supabase aplikacja działa w trybie demo z przykładowymi danymi w pamięci. Idealne do testowania UI i flow.

## Struktura projektu

```
src/
├── components/       # Reużywalne komponenty UI
│   ├── Sidebar.jsx   # Nawigacja boczna
│   └── ui.jsx        # StatusBadge, ProgressRing, Input, etc.
├── hooks/            # Custom React hooks
│   └── useData.js    # Fetching danych z Supabase/demo
├── lib/              # Logika biznesowa
│   ├── constants.js  # Typy wniosków, kamienie milowe, enumy
│   ├── database.js   # Warstwa abstrakcji DB (Supabase/demo)
│   ├── predictions.js # Silnik ML predykcji
│   └── supabase.js   # Klient Supabase
├── pages/            # Widoki stron
│   ├── Analytics.jsx  # Analityka ML
│   ├── Dashboard.jsx  # Panel główny
│   ├── NewProject.jsx # Formularz nowego projektu
│   └── ProjectView.jsx # Widok projektu (4 zakładki)
├── App.jsx           # Router
├── index.css         # Tailwind + custom styles
└── main.jsx          # Entry point
supabase/
└── migration.sql     # Schemat bazy danych
```

## Następne iteracje

- [ ] Realna integracja API TERYT
- [ ] Integracja z API e-Mapy Mazowsza (WFS/WMS)
- [ ] Parsowanie MPZP przez Claude API (document understanding)
- [ ] Generowanie wniosków PDF (wypełnione danymi)
- [ ] Auth (Supabase Auth z magic link)
- [ ] Powiadomienia o zbliżających się terminach
- [ ] Rozszerzenie modelu ML o seasonality i municipality-specific weights
- [ ] Kolejne etapy projektu po pozwoleniu na budowę
# archimanager
