import { Car, Droplets, Zap, Building2, Flag, FileText, Clock, CheckCircle } from 'lucide-react'

// ─── APPLICATION TYPES (WNIOSEK TYPES) ────────────────────
export const APPLICATION_TYPES = {
  ZJAZD: {
    id: 'zjazd',
    label: 'Zjazd z drogi gminnej',
    icon: Car,
    color: '#E8912D',
    legalDays: 30,
    maxDays: 60,
    description: 'Zezwolenie na lokalizację zjazdu z drogi gminnej',
    legalBasis: 'Art. 29 Ustawy o drogach publicznych, Art. 35 KPA',
    fee: '82 zł (zwolnienie dla budownictwa mieszkaniowego)',
    appeal: 'Odwołanie do SKO w terminie 14 dni od doręczenia decyzji',
    requiredDocs: [
      'Mapa zasadnicza 1:500/1:1000 z lokalizacją zjazdu i granicami działki',
      'Oświadczenie o prawie do dysponowania nieruchomością',
      'Kopia decyzji o warunkach zabudowy lub wypis z MPZP',
      'Wypis z rejestru gruntów (dla działki i działek drogowych)',
      'Pełnomocnictwo (jeśli składa architekt w imieniu inwestora)',
    ],
  },
  WOD_KAN: {
    id: 'wod_kan',
    label: 'Przyłącze wod-kan',
    icon: Droplets,
    color: '#3B82F6',
    legalDays: 21,
    maxDays: 42,
    description: 'Warunki przyłączenia do sieci wodociągowej i kanalizacyjnej',
    legalBasis: 'Art. 19a Ustawy o zbiorowym zaopatrzeniu w wodę',
    fee: 'Bezpłatne (zakaz pobierania opłat za wydanie warunków)',
    appeal: 'Wniosek do dyrektora RZGW PGW Wody Polskie',
    note: '21 dni dla domów jednorodzinnych, 45 dni w pozostałych. Ważność: 2 lata.',
    requiredDocs: [
      'Mapa sytuacyjno-wysokościowa 1:500 z planem zabudowy',
      'Oświadczenie o tytule prawnym do nieruchomości',
      'Określenie dobowego zapotrzebowania na wodę (Qdśr, Qhmax)',
      'Określenie ilości i rodzaju odprowadzanych ścieków',
      'Numer księgi wieczystej nieruchomości',
    ],
  },
  ENERGIA: {
    id: 'energia',
    label: 'Przyłącze energetyczne',
    icon: Zap,
    color: '#F59E0B',
    legalDays: 21,
    maxDays: 30,
    description: 'Warunki przyłączenia do sieci elektroenergetycznej (gr. V/VI)',
    legalBasis: 'Art. 7 ust. 8g Prawa energetycznego',
    fee: 'Wg taryfy operatora (opłata przyłączeniowa po zawarciu umowy)',
    appeal: 'Wniosek do Prezesa URE (art. 8 Prawa energetycznego)',
    note: '21 dni gr. V/VI, 30 dni gr. IV. Ważność: 2 lata. Kara za opóźnienie: min. 1500 zł/dzień.',
    requiredDocs: [
      'Plan zabudowy / szkic sytuacyjny z lokalizacją obiektu',
      'Dokument potwierdzający tytuł prawny do nieruchomości',
      'Określenie mocy przyłączeniowej (kW)',
      'Planowany termin rozpoczęcia odbioru energii',
      'Schemat jednokreskowy (dla większych mocy)',
    ],
  },
  ADAPTACJA: {
    id: 'adaptacja',
    label: 'Adaptacja / Wybór inwestora',
    icon: Building2,
    color: '#8B5CF6',
    legalDays: null,
    maxDays: null,
    description: 'Według adaptacji projektu lub wybór inwestora wykonawczego',
    legalBasis: 'Ustalane indywidualnie w umowie',
    fee: 'Wg umowy z projektantem/inwestorem',
    requiredDocs: [
      'Projekt budowlany do adaptacji',
      'Wszystkie warunki techniczne przyłączeń',
      'Mapa do celów projektowych',
      'Decyzja WZ lub wypis z MPZP',
    ],
  },
}

// ─── MILESTONES ───────────────────────────────────────────
export const MILESTONES = [
  {
    id: 'm1',
    label: 'Inicjacja projektu',
    description: 'Podpisanie umowy z klientem, zebranie danych',
    icon: Flag,
    color: '#6366F1',
    tasks: [
      'Podpisanie umowy z klientem',
      'Zebranie danych osobowych klienta',
      'Pobranie danych działki z e-Mapy',
      'Analiza MPZP / złożenie wniosku o WZ',
      'Pobranie i analiza pliku MPZP',
    ],
  },
  {
    id: 'm2',
    label: 'Złożenie wniosków',
    description: 'Przygotowanie i złożenie wszystkich wymaganych wniosków',
    icon: FileText,
    color: '#3B82F6',
    tasks: [
      'Przygotowanie wniosku o zjazd z drogi',
      'Złożenie wniosku o zjazd',
      'Przygotowanie wniosku o przyłącze wod-kan',
      'Złożenie wniosku o przyłącze wod-kan',
      'Przygotowanie wniosku o przyłącze energetyczne',
      'Złożenie wniosku o przyłącze energetyczne',
      'Uzgodnienie adaptacji / wybór inwestora',
    ],
  },
  {
    id: 'm3',
    label: 'Uzyskanie odpowiedzi',
    description: 'Oczekiwanie na decyzje i warunki ze wszystkich urzędów',
    icon: Clock,
    color: '#F59E0B',
    tasks: [
      'Uzyskanie zezwolenia na zjazd',
      'Uzyskanie warunków przyłączenia wod-kan',
      'Uzyskanie warunków przyłączenia energetycznego',
      'Kompletacja adaptacji projektu',
    ],
  },
  {
    id: 'm4',
    label: 'Pozwolenie na budowę',
    description: 'Złożenie wniosku o pozwolenie na budowę po uzyskaniu wszystkich decyzji',
    icon: CheckCircle,
    color: '#10B981',
    tasks: [
      'Weryfikacja kompletności dokumentacji',
      'Przygotowanie projektu budowlanego',
      'Złożenie wniosku o pozwolenie na budowę',
      'Oczekiwanie na decyzję (65 dni)',
      'Uprawomocnienie decyzji (14 dni)',
    ],
  },
]

// ─── ENUMS ────────────────────────────────────────────────
export const TASK_STATUSES = {
  TODO: { label: 'Do zrobienia', color: '#94A3B8', bg: '#F1F5F9' },
  IN_PROGRESS: { label: 'W trakcie', color: '#3B82F6', bg: '#EFF6FF' },
  WAITING: { label: 'Oczekiwanie', color: '#F59E0B', bg: '#FFFBEB' },
  DONE: { label: 'Zakończone', color: '#10B981', bg: '#ECFDF5' },
  BLOCKED: { label: 'Zablokowane', color: '#EF4444', bg: '#FEF2F2' },
}

export const PROPERTY_TITLES = ['Własność', 'Użytkowanie wieczyste', 'Dzierżawa', 'Najem', 'Inne']
export const ROAD_CLASSES = ['Gminna', 'Powiatowa', 'Wojewódzka', 'Krajowa', 'Wewnętrzna']
export const BUILDING_TYPES = [
  'Dom jednorodzinny',
  'Dom w zabudowie bliźniaczej',
  'Dom w zabudowie szeregowej',
  'Budynek wielorodzinny',
  'Budynek usługowy',
  'Budynek produkcyjny',
  'Inny',
]
export const PROVINCES = [
  'dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie',
  'małopolskie', 'mazowieckie', 'opolskie', 'podkarpackie', 'podlaskie',
  'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie',
  'wielkopolskie', 'zachodniopomorskie',
]
