/**
 * Generator wniosków PDF — ArchiManager
 *
 * Generuje wniosek o zjazd z drogi gminnej na wzorze UG
 * Działa w przeglądarce (jsPDF) — nie wymaga serwera.
 */

import { jsPDF } from 'jspdf'

/**
 * Generate "Wniosek o zjazd z drogi gminnej" PDF
 *
 * @param {object} client - client data from project
 * @param {object} plot - plot data from project
 * @param {object} overrides - optional field overrides
 * @returns {Blob} PDF blob for download
 */
export function generateWniosekZjazd(client, plot, overrides = {}) {

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageW = 210
  const marginL = 25
  const marginR = 25
  const contentW = pageW - marginL - marginR
  let y = 20

  // ── Helpers ──
  const setNormal = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(11) }
  const setBold = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(11) }
  const setSmall = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8) }
  const setLabel = () => { doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(130, 130, 130) }
  const resetColor = () => doc.setTextColor(0, 0, 0)

  const rightText = (text, yy) => {
    doc.text(text, pageW - marginR, yy, { align: 'right' })
  }

  const centerText = (text, yy) => {
    doc.text(text, pageW / 2, yy, { align: 'center' })
  }

  const fillOrDots = (val, dotLen = 40) => {
    if (val && val.trim()) return val.trim()
    return '.'.repeat(dotLen)
  }

  const wrapText = (text, maxWidth, yy) => {
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, marginL, yy)
    return yy + lines.length * 5.5
  }

  // ── Data ──
  const d = {
    firstName: client.first_name || '',
    lastName: client.last_name || '',
    address: `${client.street || ''} ${client.number || ''}, ${client.postal_code || ''} ${client.city || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, ''),
    phone: client.phone || '',
    commune: plot.commune_name || client.commune || client.city || '',
    roadName: plot.road_name || '',
    roadNumber: plot.road_plot_number || '',
    locality: client.city || plot.commune_name || '',
    parcelNumber: plot.number || '',
    purpose: plot.purpose || overrides.purpose || 'budownictwo mieszkaniowe jednorodzinne',
    exitWidth: overrides.exit_width || '5,0 m',
    surfaceType: overrides.surface_type || 'kostka betonowa',
    contractor: overrides.contractor || 'roboty wykonywac bede wlasnymi silami',
    titleType: client.property_title === 'Wlasnosc' ? 'wlascicielem' : 'uzytkownikiem',
    changeDescription: overrides.change_description || '',
    date: new Date().toLocaleDateString('pl-PL'),
    ...overrides,
  }

  const fullName = `${d.firstName} ${d.lastName}`.trim()

  // ════════════════════════════════════════
  // PAGE 1: WNIOSEK
  // ════════════════════════════════════════

  // Date & location (top right)
  setNormal()
  rightText(`${d.locality}, ${d.date}`, y)
  setLabel()
  rightText('(miejscowosc, data)', y + 4)
  resetColor()
  y += 14

  // Applicant
  setBold()
  doc.text(fillOrDots(fullName), marginL, y)
  y += 6
  setNormal()
  doc.text(fillOrDots(d.address), marginL, y)
  y += 6
  doc.text(`tel. ${fillOrDots(d.phone, 25)}`, marginL, y)
  y += 4
  setLabel()
  doc.text('( imie, nazwisko, adres, telefon )', marginL, y)
  resetColor()
  y += 14

  // Recipient
  setBold()
  doc.setFontSize(14)
  rightText('Urzad Gminy', y)
  y += 7
  rightText(`w ${d.commune || '.....................'}`, y)
  doc.setFontSize(11)
  y += 16

  // Title
  doc.setFontSize(18)
  centerText('WNIOSEK', y)
  doc.setFontSize(11)
  y += 12

  // Body
  setNormal()
  y = wrapText(
    `Wnosze, o wydanie zgody na budowe zjazdu z drogi publicznej`,
    contentW, y)
  y += 2

  y = wrapText(
    `Nr ${fillOrDots(d.roadNumber, 15)} w miejscowosci ${fillOrDots(d.locality, 25)}`,
    contentW, y)
  y += 2

  y = wrapText(
    `do nieruchomosci nr ${fillOrDots(d.parcelNumber, 20)}`,
    contentW, y)
  y += 2

  y = wrapText(
    `Oswiadczam, ze jestem ${d.titleType} przedmiotowej nieruchomosci.`,
    contentW, y)
  y += 2

  y = wrapText(
    `Nieruchomosc ta jest wykorzystywana na cele ${fillOrDots(d.purpose, 30)}`,
    contentW, y)
  y += 2

  if (d.changeDescription) {
    y = wrapText(
      `Po wybudowaniu zjazdu sposob wykorzystania nieruchomosci ulegnie zmianie polegajacej na ${fillOrDots(d.changeDescription, 25)}`,
      contentW, y)
  } else {
    y = wrapText(
      `Po wybudowaniu zjazdu sposob wykorzystania nieruchomosci nie ulegnie zmianie.`,
      contentW, y)
  }
  y += 4

  y = wrapText(`Szerokosc zjazdu: ${fillOrDots(d.exitWidth, 30)}`, contentW, y)
  y += 2
  y = wrapText(`Utwardzenie nawierzchni: ${fillOrDots(d.surfaceType, 30)}`, contentW, y)
  y += 4

  y = wrapText(`Wykonawca robot budowlanych bedzie:`, contentW, y)
  y += 1
  y = wrapText(fillOrDots(d.contractor, 50), contentW, y)
  setLabel()
  doc.text('( wskazac firme lub zaznaczyc ze roboty wykonywac bede wlasnymi silami )', marginL, y + 2)
  resetColor()
  y += 10

  // Attachments
  setNormal()
  doc.text('Do wniosku zalaczam:', marginL, y)
  y += 6
  const attachments = [
    'Mape w skali 1:500 lub 1:1000',
    'Kopie dokumentu potwierdzajacego tytul prawny do nieruchomosci',
    'Lokalizacje zjazdu',
    'Oplate skarbowa jesli jest wymagana',
  ]
  attachments.forEach((att, i) => {
    doc.text(`    ${i + 1}) ${att}`, marginL, y)
    y += 6
  })

  y += 12
  // Signature
  rightText('.............................................', y)
  y += 5
  setLabel()
  rightText('( podpis wnioskodawcy )', y)
  resetColor()

  y += 8
  setSmall()
  doc.text('*- niepotrzebne skreslic', marginL, y)

  // ════════════════════════════════════════
  // PAGE 2: RODO
  // ════════════════════════════════════════
  doc.addPage()
  y = 20

  setBold()
  doc.setFontSize(10)
  y = wrapText(
    `Informacja dotyczaca przetwarzania danych osobowych w Urzedzie Gminy ${d.commune}`,
    contentW, y)
  y += 4

  setSmall()
  const rodoPoints = [
    `1) Administratorem Pani/Pana danych osobowych jest Wojt Gminy ${d.commune} z siedziba w Urzedzie Gminy ${d.commune}; Administrator prowadzi operacje przetwarzania Pani/Pana danych osobowych.`,
    `2) Pani/Pana dane osobowe przetwarzane sa na podstawie art. 6 ust. 1 lit. c RODO, tj. w oparciu o niezbednosc przetwarzania do celow wynikajacych z prawnie uzasadnionych interesow realizowanych przez Administratora.`,
    `3) Podstawa przetwarzania Pani/Pana danych osobowych jest art. 7 ust. 1 ustawy z dnia 8 marca 1990 r. o samorzadzie gminnym.`,
    `4) Posiada Pani/Pan prawo do: zadania od Administratora dostepu do swoich danych osobowych, ich sprostowania, usuniecia lub ograniczenia przetwarzania; wniesienia sprzeciwu wobec takiego przetwarzania; przenoszenia danych; wniesienia skargi do organu nadzorczego; cofniecia zgody na przetwarzanie danych osobowych.`,
    `5) Pani/Pana dane osobowe nie podlegaja zautomatyzowanemu podejmowaniu decyzji, w tym profilowaniu.`,
    `6) Pani/Pana dane osobowe beda przechowywane przez czas okreslony w Rozporzadzeniu Prezesa Rady Ministrow z dnia 18 stycznia 2011 r. w sprawie instrukcji kancelaryjnej, jednolitych rzeczowych wykazow akt oraz instrukcji w sprawie organizacji i zakresu dzialania archiwow zakladowych.`,
  ]

  rodoPoints.forEach(point => {
    y = wrapText(point, contentW, y)
    y += 3
  })

  y += 10
  doc.setFontSize(9)
  doc.text('Potwierdzam zapoznanie sie z powyszsza informacja', marginL, y)
  y += 12
  setNormal()
  rightText('.............................................', y)
  y += 5
  setLabel()
  rightText('( data i podpis )', y)
  resetColor()

  // ── Return blob ──
  return doc.output('blob')
}

/**
 * Trigger PDF download in the browser
 */
export function downloadWniosekZjazd(client, plot, overrides = {}) {
  const blob = generateWniosekZjazd(client, plot, overrides)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const parcelNum = (plot.number || 'dzialka').replace(/\//g, '-')
  a.download = `wniosek_zjazd_${parcelNum}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
