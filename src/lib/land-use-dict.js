/**
 * Słownik użytków gruntowych (EGiB)
 * Źródło: Rozporządzenie w sprawie ewidencji gruntów i budynków
 */

export const LAND_USE_DICT = {
  "R":  { official: "Grunty orne", common: "pole / grunty orne", category: "rolne", hint: "Typowo uprawy polowe; często wymagane odrolnienie przy zabudowie." },
  "Ł":  { official: "Łąki trwałe", common: "łąka", category: "rolne", hint: "Użytki zielone; przy inwestycjach sprawdź ograniczenia środowiskowe i melioracje." },
  "Ps": { official: "Pastwiska trwałe", common: "pastwisko", category: "rolne", hint: "Użytki zielone; podobnie jak łąki — możliwe ograniczenia." },
  "S":  { official: "Sady", common: "sad", category: "rolne", hint: "Formalnie rolny; nasadzenia wieloletnie." },
  "Br": { official: "Grunty rolne zabudowane", common: "zabudowa zagrodowa / zabudowania gospodarcze", category: "rolne", hint: "Często siedliska; ważne dla analizy istniejącej zabudowy." },
  "Wsr":{ official: "Grunty pod stawami", common: "staw / stawy", category: "rolne", hint: "Sprawdź strefy ochronne i przepisy wodne." },
  "W":  { official: "Rowy", common: "rów / rów melioracyjny", category: "rolne", hint: "Zwróć uwagę na melioracje i przebieg urządzeń wodnych." },
  "Lzr":{ official: "Grunty zadrzewione i zakrzewione na użytkach rolnych", common: "zakrzaczenia na rolnym", category: "rolne", hint: "Często mylone z Lz; formalnie nadal rolny." },

  "Ls": { official: "Lasy", common: "las", category: "leśne", hint: "Zwykle duże ograniczenia w zabudowie; sprawdź formy ochrony i UoL." },
  "Lz": { official: "Grunty zadrzewione i zakrzewione", common: "zadrzewienia / zakrzaczenia", category: "leśne/zieleń", hint: "Niekoniecznie las, ale może podlegać ochronie drzew." },
  "ZL": { official: "Grunty przeznaczone do zalesienia", common: "teren do zalesienia", category: "leśne/zieleń", hint: "W praktyce: kierunek leśny; sprawdź MPZP i decyzje środowiskowe." },

  "B":  { official: "Tereny mieszkaniowe", common: "zabudowa mieszkaniowa", category: "zabudowane", hint: "Najczęściej budownictwo jednorodzinne/wielorodzinne zależnie od planu." },
  "Ba": { official: "Tereny przemysłowe", common: "przemysł / zakład", category: "zabudowane", hint: "Zwykle obszary działalności produkcyjnej/usługowej." },
  "Bi": { official: "Inne tereny zabudowane", common: "inna zabudowa (usługi, obiekty)", category: "zabudowane", hint: "Dla różnych typów zabudowy poza mieszkaniową i przemysłową." },
  "Bp": { official: "Zurbanizowane tereny niezabudowane lub w trakcie zabudowy", common: "działka w trakcie inwestycji / teren pod zabudowę", category: "zurbanizowane", hint: "Bardzo częste w miastach; teren pod zabudowę." },
  "Bz": { official: "Tereny rekreacyjno-wypoczynkowe", common: "rekreacja / wypoczynek", category: "zurbanizowane", hint: "Parki, ośrodki; ograniczenia wynikają z MPZP." },

  "dr": { official: "Drogi", common: "droga", category: "komunikacja", hint: "Istotne przy dostępie do drogi publicznej i zjazdach." },
  "Tk": { official: "Tereny kolejowe", common: "kolej / tory", category: "komunikacja", hint: "Ograniczenia hałasowe i odległościowe; sprawdź strefy oddziaływania." },
  "Ti": { official: "Inne tereny komunikacyjne", common: "komunikacja (place, parkingi)", category: "komunikacja", hint: "Różne formy komunikacji poza drogami/koleją." },

  "Ws": { official: "Grunty pod wodami powierzchniowymi stojącymi", common: "jezioro / zbiornik", category: "wody", hint: "Ryzyko stref zalewowych i ochrony brzegów." },
  "Wp": { official: "Grunty pod wodami powierzchniowymi płynącymi", common: "rzeka / strumień", category: "wody", hint: "Wody płynące = dodatkowe wymagania dot. odległości i ochrony." },
  "Wm": { official: "Morskie wody wewnętrzne", common: "wody morskie wewnętrzne", category: "wody", hint: "Rzadkie; wody morskie." },

  "K":  { official: "Tereny kopalniane", common: "teren górniczy / kopalnia", category: "specjalne", hint: "Sprawdź wpływy eksploatacji (osiadania) i ograniczenia." },
  "Tb": { official: "Tereny różne", common: "teren różny", category: "specjalne", hint: "Catch-all; wymaga dodatkowej weryfikacji." },
  "Tr": { official: "Tereny rekultywowane", common: "rekultywacja / teren po eksploatacji", category: "specjalne", hint: "Może mieć ograniczenia i wymogi dodatkowych badań." },
  "Tp": { official: "Tereny pod urządzeniami technicznymi", common: "infrastruktura techniczna", category: "specjalne", hint: "Ujęcia, przepompownie, stacje; sprawdź strefy ochronne." },

  "N":  { official: "Nieużytki", common: "nieużytek", category: "rolne/pozostałe", hint: "Zaniedbane grunty; może komplikować proces inwestycyjny." },
}

// Klasy bonitacyjne gleb
export const SOIL_CLASSES = {
  "I":    { quality: "najlepsza", description: "Gleby najwyższej jakości — odrolnienie bardzo trudne" },
  "II":   { quality: "bardzo dobra", description: "Gleby bardzo dobre — odrolnienie trudne" },
  "IIIa": { quality: "dobra", description: "Gleby dobre — odrolnienie wymaga zgody ministra (kl. I-III)" },
  "IIIb": { quality: "dobra", description: "Gleby dobre — odrolnienie wymaga zgody ministra (kl. I-III)" },
  "IVa":  { quality: "średnia", description: "Gleby średnie — odrolnienie łatwiejsze (decyzja starosty)" },
  "IVb":  { quality: "średnia", description: "Gleby średnie — odrolnienie łatwiejsze" },
  "V":    { quality: "słaba", description: "Gleby słabe — odrolnienie najłatwiejsze" },
  "VI":   { quality: "najsłabsza", description: "Gleby najsłabsze — odrolnienie zazwyczaj bezproblemowe" },
}

/**
 * Parsuje oznaczenie klasoużytku np. "RIVa", "PsV", "B-RIIIa", "Ls"
 * Zwraca: { code, useType, soilClass, fullInfo }
 */
export function parseLandUseCode(raw) {
  if (!raw || typeof raw !== 'string') return null
  const code = raw.trim()

  // Pattern: OFU-OZU+OZK lub OZU+OZK lub sam OFU
  // Przykłady: RIVa, PsV, B-RIIIa, Ls, Bi, dr
  const match = code.match(/^([A-ZŁa-z]{1,3})(?:-([A-ZŁa-z]{1,3}))?(I{1,3}|IV[ab]?|V|VI)?$/)
  if (!match) {
    // Spróbuj bez klasy
    const simpleMatch = code.match(/^([A-ZŁa-z]{1,3})(?:-([A-ZŁa-z]{1,3}))?$/)
    if (simpleMatch) {
      const useCode = simpleMatch[2] || simpleMatch[1]
      const useType = LAND_USE_DICT[useCode] || LAND_USE_DICT[simpleMatch[1]]
      return {
        code,
        useCode,
        useType: useType || null,
        soilClass: null,
        fullInfo: useType
          ? `${useType.official} (${useType.common})`
          : code,
        hint: useType?.hint || null,
        category: useType?.category || null,
      }
    }
    return { code, useCode: code, useType: null, soilClass: null, fullInfo: code, hint: null, category: null }
  }

  const mainCode = match[2] || match[1] // OZU jeśli jest, inaczej OFU
  const ofu = match[2] ? match[1] : null // OFU jeśli różne od OZU
  const classStr = match[3] || null
  const useType = LAND_USE_DICT[mainCode] || LAND_USE_DICT[match[1]]
  const soilClass = classStr ? SOIL_CLASSES[classStr] : null

  const parts = []
  if (useType) parts.push(`${useType.official} (${useType.common})`)
  else parts.push(mainCode)
  if (ofu && LAND_USE_DICT[ofu]) parts.push(`na terenie: ${LAND_USE_DICT[ofu].common}`)
  if (soilClass) parts.push(`klasa ${classStr} — ${soilClass.description}`)

  return {
    code,
    useCode: mainCode,
    ofu,
    useType: useType || null,
    soilClass,
    soilClassStr: classStr,
    fullInfo: parts.join('; '),
    hint: useType?.hint || null,
    category: useType?.category || null,
  }
}

/**
 * Parsuje listę oznaczeń (np. "RIVa, PsV, B") i zwraca tablicę z pełnymi opisami
 */
export function parseLandUseList(landUseStr) {
  if (!landUseStr) return []
  return landUseStr
    .split(/[,;]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(parseLandUseCode)
    .filter(Boolean)
}

/**
 * Kategorie kolorów do wyświetlania
 */
export const CATEGORY_COLORS = {
  "rolne":           { bg: "bg-amber-50",   border: "border-amber-200", text: "text-amber-800", icon: "🌾" },
  "leśne":           { bg: "bg-green-50",   border: "border-green-200", text: "text-green-800", icon: "🌲" },
  "leśne/zieleń":    { bg: "bg-green-50",   border: "border-green-200", text: "text-green-800", icon: "🌳" },
  "zabudowane":      { bg: "bg-slate-50",   border: "border-slate-200", text: "text-slate-800", icon: "🏠" },
  "zurbanizowane":   { bg: "bg-blue-50",    border: "border-blue-200",  text: "text-blue-800",  icon: "🏗️" },
  "komunikacja":     { bg: "bg-gray-50",    border: "border-gray-200",  text: "text-gray-800",  icon: "🛣️" },
  "wody":            { bg: "bg-cyan-50",    border: "border-cyan-200",  text: "text-cyan-800",  icon: "💧" },
  "specjalne":       { bg: "bg-orange-50",  border: "border-orange-200",text: "text-orange-800",icon: "⚠️" },
  "rolne/pozostałe": { bg: "bg-stone-50",   border: "border-stone-200", text: "text-stone-800", icon: "🏜️" },
}
