/*
 * Fragen-Datenbank – ADT Tumordokumentar/in Prüfungsvorbereitung
 * ---------------------------------------------------------------
 * WICHTIG: Diese Fragen sind sorgfältig nach etablierten, stabilen
 * Standards (UICC/TNM, ICD-O-3, ICD-10, ADT/GEKID-Basisdatensatz,
 * § 65c SGB V / KFRG) formuliert. Sie ersetzen NICHT das offizielle
 * ADT-Prüfungsfragentool, sondern dienen dem Üben der Inhalte.
 *
 * Struktur eines Eintrags:
 *   id          eindeutige ID (nicht ändern – wird für Fortschritt genutzt)
 *   topic       Themen-Schlüssel (siehe TOPICS unten)
 *   difficulty  1 = leicht, 2 = mittel, 3 = schwer
 *   type        "single"  = genau eine richtige Antwort
 *               "multi"   = eine ODER mehrere richtige Antworten (Prüfungsformat!)
 *               "numeric" = Rechen-/Anwendungsaufgabe mit freier Zahl-Eingabe
 *   question    Fragetext
 *   options     Array der Antwortmöglichkeiten            (single/multi)
 *   correct     Array der Indizes (0-basiert) der RICHTIGEN Antworten (single/multi)
 *   answer      erwartete Zahl                            (numeric)
 *   tolerance   erlaubte Abweichung ± (optional, Standard 0) (numeric)
 *   unit        Einheit zur Anzeige (optional)            (numeric)
 *   explanation Erklärung – vermittelt den Lerninhalt (inkl. Rechenweg bei numeric)
 *
 * Neue Fragen einfach unten anhängen. Die App validiert das Format beim Start.
 */

const SAMPLE_TOPICS = {
  grundlagen:    { name: "Grundlagen der Onkologie",        icon: "🧬", color: "#5b8def" },
  tnm:           { name: "TNM-Klassifikation (UICC)",       icon: "📐", color: "#e8734a" },
  icdo:          { name: "ICD-O-3 (Topografie & Morphologie)", icon: "🔬", color: "#7c5cbf" },
  icd10:         { name: "ICD-10 & Dignität",               icon: "📖", color: "#3fa796" },
  grading:       { name: "Grading, Residual- & Zusatzcodes", icon: "🎯", color: "#d9a441" },
  register:      { name: "Krebsregister & Meldewesen",      icon: "🏛️", color: "#c0577a" },
  epidemiologie: { name: "Epidemiologie & Statistik",       icon: "📊", color: "#4a90a4" },
  therapie:      { name: "Therapie & Verlauf",              icon: "💊", color: "#6aa84f" },
  datenschutz:   { name: "Datenschutz & Recht",             icon: "🔒", color: "#8a8f99" },
};

const SAMPLE_QUESTIONS = [
  // ===================== GRUNDLAGEN =====================
  {
    id: "gr-001", topic: "grundlagen", difficulty: 1, type: "single",
    question: "Wofür steht die Abkürzung „ADT“ im Kontext der Tumordokumentation?",
    options: [
      "Arbeitsgemeinschaft Deutscher Tumorzentren e. V.",
      "Allgemeine Deutsche Tumorklassifikation",
      "Anerkannte Diagnose-Terminologie",
      "Ausschuss für Datenschutz in Tumorregistern",
    ],
    correct: [0],
    explanation: "Die ADT (Arbeitsgemeinschaft Deutscher Tumorzentren e. V.) gibt u. a. den ADT/GEKID-Basisdatensatz heraus und verantwortet das Zertifikat „Tumordokumentar/in“.",
  },
  {
    id: "gr-002", topic: "grundlagen", difficulty: 1, type: "multi",
    question: "Welche Aussagen zu bösartigen (malignen) Tumoren treffen zu?",
    options: [
      "Sie können infiltrierend/invasiv in Nachbargewebe einwachsen.",
      "Sie können Metastasen bilden.",
      "Sie sind grundsätzlich vollständig abgekapselt und wachsen nur verdrängend.",
      "Sie können erneut auftreten (Rezidiv).",
    ],
    correct: [0, 1, 3],
    explanation: "Maligne Tumoren wachsen infiltrierend/destruierend, metastasieren und können rezidivieren. Das rein verdrängende, abgekapselte Wachstum ist typisch für benigne (gutartige) Tumoren.",
  },
  {
    id: "gr-003", topic: "grundlagen", difficulty: 2, type: "single",
    question: "Was bezeichnet der Begriff „Primärtumor“?",
    options: [
      "Der zuerst diagnostizierte Tumor, unabhängig vom Ursprung",
      "Der Tumor am Ort seiner Entstehung (Ursprungsgewebe)",
      "Jede Fernmetastase eines Tumors",
      "Der größte messbare Tumorherd im Körper",
    ],
    correct: [1],
    explanation: "Der Primärtumor ist der Tumor am Ort seiner Entstehung. Metastasen (Tochtergeschwülste) gehen von ihm aus, sind aber selbst keine Primärtumoren.",
  },
  {
    id: "gr-004", topic: "grundlagen", difficulty: 2, type: "single",
    question: "Wie nennt man einen bösartigen Tumor, der vom Epithelgewebe (Deckgewebe/Drüsen) ausgeht?",
    options: ["Sarkom", "Karzinom", "Lymphom", "Blastom"],
    correct: [1],
    explanation: "Karzinome gehen von Epithelgewebe aus (häufigste Krebsgruppe). Sarkome entstehen aus Binde-/Stützgewebe (mesenchymal), Lymphome aus dem lymphatischen System.",
  },
  {
    id: "gr-005", topic: "grundlagen", difficulty: 2, type: "single",
    question: "Wie nennt man einen bösartigen Tumor des Binde-, Stütz- oder Muskelgewebes (mesenchymalen Ursprungs)?",
    options: ["Karzinom", "Adenom", "Sarkom", "Papillom"],
    correct: [2],
    explanation: "Sarkome sind maligne Tumoren mesenchymalen Ursprungs (z. B. Knochen, Muskel, Fettgewebe). Adenom und Papillom sind gutartige epitheliale Tumoren.",
  },

  // ===================== TNM =====================
  {
    id: "tnm-001", topic: "tnm", difficulty: 1, type: "single",
    question: "Wofür stehen die Buchstaben T, N und M im TNM-System der UICC?",
    options: [
      "Tumorgröße, Nekrose, Mitoserate",
      "Primärtumor, regionäre Lymphknoten, Fernmetastasen",
      "Tumorstadium, Nachsorge, Morphologie",
      "Topografie, Nodalstatus, Malignität",
    ],
    correct: [1],
    explanation: "T = Ausdehnung des Primärtumors, N = regionäre Lymphknoten (Nodi), M = Fernmetastasen. Das TNM-System der UICC beschreibt die anatomische Ausbreitung.",
  },
  {
    id: "tnm-002", topic: "tnm", difficulty: 2, type: "single",
    question: "Was bedeutet das Präfix „c“ in „cTNM“?",
    options: [
      "Klinische Klassifikation (vor Therapie, aus Untersuchung/Bildgebung)",
      "Pathologische Klassifikation nach Operation",
      "Klassifikation eines Rezidivs",
      "Klassifikation nach Autopsie",
    ],
    correct: [0],
    explanation: "„c“ (clinical) steht für die klinische Klassifikation vor Therapie auf Basis von Untersuchung, Bildgebung, Endoskopie etc. „p“ (pathological) beruht auf der histopathologischen Untersuchung nach Operation.",
  },
  {
    id: "tnm-003", topic: "tnm", difficulty: 2, type: "single",
    question: "Wofür steht das Präfix „p“ in „pTNM“?",
    options: [
      "Für die palliative Situation",
      "Für die pathologische (histopathologische) Klassifikation nach Resektion",
      "Für den Primärtumor",
      "Für eine prognostische Schätzung",
    ],
    correct: [1],
    explanation: "„p“ = pathologische Klassifikation, die auf der feingeweblichen Untersuchung des Operationspräparats beruht. Für pN ist die Entnahme und Untersuchung von Lymphknoten erforderlich.",
  },
  {
    id: "tnm-004", topic: "tnm", difficulty: 2, type: "single",
    question: "Was bedeutet das Präfix „y“ in der TNM-Klassifikation (z. B. ypT2)?",
    options: [
      "Der Tumor wurde bei einer Autopsie festgestellt.",
      "Die Klassifikation erfolgt während oder nach initialer multimodaler (neoadjuvanter) Therapie.",
      "Es handelt sich um ein Rezidiv.",
      "Es liegen mehrere Primärtumoren vor.",
    ],
    correct: [1],
    explanation: "Das „y“-Präfix kennzeichnet die Klassifikation während oder nach neoadjuvanter (präoperativer) Therapie, z. B. ypT nach neoadjuvanter Chemo-/Strahlentherapie.",
  },
  {
    id: "tnm-005", topic: "tnm", difficulty: 2, type: "single",
    question: "Was kennzeichnet das Präfix „r“ in der TNM-Klassifikation (z. B. rT1)?",
    options: [
      "Eine Rest-Erkrankung (Residualtumor)",
      "Ein Rezidiv (erneutes Auftreten nach krankheitsfreiem Intervall)",
      "Eine radiologisch gesicherte Diagnose",
      "Eine regionäre Ausbreitung",
    ],
    correct: [1],
    explanation: "Das „r“-Präfix kennzeichnet die Klassifikation eines Rezidivtumors nach einem krankheitsfreien Intervall. Der Residualtumor nach Behandlung wird dagegen mit der R-Klassifikation (R0–R2) beschrieben.",
  },
  {
    id: "tnm-006", topic: "tnm", difficulty: 1, type: "single",
    question: "Was bedeutet „Tis“ in der TNM-Klassifikation?",
    options: [
      "Primärtumor kann nicht beurteilt werden",
      "Kein Anhalt für Primärtumor",
      "Carcinoma in situ",
      "Tumor mit Infiltration in Nachbarorgane",
    ],
    correct: [2],
    explanation: "Tis = Carcinoma in situ: eine nicht-invasive Neubildung, die die Basalmembran (noch) nicht durchbrochen hat. T0 = kein Anhalt für Primärtumor, TX = Primärtumor nicht beurteilbar.",
  },
  {
    id: "tnm-007", topic: "tnm", difficulty: 2, type: "single",
    question: "Was bedeutet „TX“?",
    options: [
      "Der Primärtumor kann nicht beurteilt werden.",
      "Es liegt kein Primärtumor vor.",
      "Der Tumor ist maximal ausgedehnt.",
      "Der Tumor ist ein Carcinoma in situ.",
    ],
    correct: [0],
    explanation: "TX bedeutet, dass der Primärtumor nicht beurteilt werden kann (fehlende Information). T0 heißt dagegen: kein Anhalt für einen Primärtumor.",
  },
  {
    id: "tnm-008", topic: "tnm", difficulty: 1, type: "single",
    question: "Was bedeutet die Kategorie „M1“?",
    options: [
      "Keine Fernmetastasen",
      "Fernmetastasen vorhanden",
      "Fernmetastasen nicht beurteilbar",
      "Nur regionäre Lymphknotenmetastasen",
    ],
    correct: [1],
    explanation: "M1 = Fernmetastasen nachgewiesen. M0 = keine Fernmetastasen. Regionäre Lymphknoten werden über die N-Kategorie, nicht über M erfasst.",
  },
  {
    id: "tnm-009", topic: "tnm", difficulty: 3, type: "multi",
    question: "Welche Aussagen zur M-Kategorie sind nach aktueller UICC-Regel korrekt?",
    options: [
      "M0 bedeutet: keine Fernmetastasen.",
      "M1 bedeutet: Fernmetastasen vorhanden.",
      "„MX“ soll nach aktueller UICC-Empfehlung nicht mehr verwendet werden.",
      "pM0 kann allein aufgrund einer klinischen Untersuchung vergeben werden.",
    ],
    correct: [0, 1, 2],
    explanation: "M0 = keine, M1 = vorhandene Fernmetastasen. Die Kategorie „MX“ gilt als entbehrlich und soll nicht mehr genutzt werden. pM0 gibt es faktisch nur bei Autopsie – eine klinische Einschätzung ohne Metastasen ist cM0, nicht pM0.",
  },
  {
    id: "tnm-010", topic: "tnm", difficulty: 3, type: "single",
    question: "Welches Suffix kennzeichnet das gleichzeitige Vorliegen multipler simultaner Primärtumoren in einem Organ (z. B. T2(m))?",
    options: ["(m)", "(y)", "(is)", "(r)"],
    correct: [0],
    explanation: "Das Suffix „(m)“ in Klammern kennzeichnet multiple simultane Primärtumoren in einem anatomischen Bezirk. Alternativ kann die Anzahl angegeben werden, z. B. T2(3).",
  },
  {
    id: "tnm-011", topic: "tnm", difficulty: 2, type: "single",
    question: "Was beschreibt die N-Kategorie?",
    options: [
      "Die Zahl der befallenen Organe",
      "Das Fehlen oder Vorhandensein und die Ausdehnung regionärer Lymphknotenmetastasen",
      "Die Fernmetastasierung",
      "Die Nekroserate des Tumors",
    ],
    correct: [1],
    explanation: "Die N-Kategorie beschreibt Fehlen (N0), Vorhandensein und Ausdehnung von Metastasen in den regionären Lymphknoten. NX = regionäre Lymphknoten nicht beurteilbar.",
  },

  // ===================== ICD-O-3 =====================
  {
    id: "ico-001", topic: "icdo", difficulty: 1, type: "multi",
    question: "Aus welchen zwei Hauptachsen setzt sich die Verschlüsselung nach ICD-O-3 zusammen?",
    options: [
      "Topografie (Lokalisation)",
      "Morphologie (Histologie und Verhalten)",
      "Therapieart",
      "Patientenalter",
    ],
    correct: [0, 1],
    explanation: "Die ICD-O-3 verschlüsselt zweiachsig: Topografie (Lokalisation, C-Code) und Morphologie (Histologie + Verhalten/Dignität + Differenzierungsgrad). Therapie und Alter sind keine ICD-O-Achsen.",
  },
  {
    id: "ico-002", topic: "icdo", difficulty: 2, type: "single",
    question: "Wie ist ein vollständiger ICD-O-3-Morphologiecode aufgebaut (Beispiel 8140/3)?",
    options: [
      "Vier Ziffern Histologie, danach nach dem Schrägstrich eine Ziffer für das Verhalten (Dignität)",
      "Drei Ziffern Lokalisation, danach eine Ziffer Grading",
      "Eine Ziffer Verhalten, danach vier Ziffern Lokalisation",
      "Fünf Ziffern für die Therapie",
    ],
    correct: [0],
    explanation: "Der Morphologiecode besteht aus vier Ziffern für die Histologie (z. B. 8140 = Adenokarzinom o. n. A.) und nach dem Schrägstrich einer Ziffer für das biologische Verhalten (/3 = maligne, primär).",
  },
  {
    id: "ico-003", topic: "icdo", difficulty: 2, type: "single",
    question: "Was bedeutet die Verhaltenskodierung „/3“ im ICD-O-3-Morphologiecode?",
    options: [
      "Gutartig (benigne)",
      "In situ (nicht invasiv)",
      "Bösartig (maligne), Primärtumor",
      "Unsicheres oder unbekanntes Verhalten",
    ],
    correct: [2],
    explanation: "/3 = bösartig (maligne), Primärlokalisation. /0 = benigne, /1 = unsicher/grenzwertig, /2 = In situ, /6 = maligne Metastase, /9 = maligne, unklar ob primär oder metastatisch.",
  },
  {
    id: "ico-004", topic: "icdo", difficulty: 3, type: "single",
    question: "Welche Verhaltenskodierung nach ICD-O-3 steht für ein Carcinoma in situ?",
    options: ["/0", "/1", "/2", "/3"],
    correct: [2],
    explanation: "/2 kennzeichnet In-situ-Neubildungen (nicht-invasiv, intraepithelial, nicht-infiltrierend). Invasiv-maligne Primärtumoren erhalten /3.",
  },
  {
    id: "ico-005", topic: "icdo", difficulty: 3, type: "multi",
    question: "Ordnen Sie zu: Welche Verhaltenscodes (/…) nach ICD-O-3 sind korrekt beschrieben?",
    options: [
      "/0 = gutartig (benigne)",
      "/1 = unsicheres, grenzwertiges oder unbekanntes Verhalten",
      "/6 = maligne, Metastase (Sekundärlokalisation)",
      "/3 = gutartig, in situ",
    ],
    correct: [0, 1, 2],
    explanation: "/0 benigne, /1 unsicher/grenzwertig, /6 maligne Metastase. Falsch ist die letzte Zuordnung: /3 steht für maligne (Primärtumor), nicht für gutartig/in situ.",
  },
  {
    id: "ico-006", topic: "icdo", difficulty: 2, type: "single",
    question: "Womit beginnen die Topografie-Codes (Lokalisation) der ICD-O-3?",
    options: [
      "Mit dem Buchstaben „C“ (z. B. C50.9)",
      "Mit dem Buchstaben „M“",
      "Mit einer vierstelligen Zahl",
      "Mit dem Buchstaben „D“",
    ],
    correct: [0],
    explanation: "Die Topografieachse der ICD-O-3 nutzt C-Codes (analog zu den bösartigen Neubildungen C00–C80 der ICD-10), z. B. C50.9 = Mamma o. n. A.",
  },

  // ===================== ICD-10 & DIGNITÄT =====================
  {
    id: "icd-001", topic: "icd10", difficulty: 1, type: "single",
    question: "Welcher ICD-10-Kapitelbereich kodiert bösartige Neubildungen (Malignome)?",
    options: ["A00–B99", "C00–C97", "D10–D36", "E00–E90"],
    correct: [1],
    explanation: "C00–C97 umfasst die bösartigen Neubildungen. D10–D36 sind gutartige Neubildungen; A00–B99 sind Infektionskrankheiten.",
  },
  {
    id: "icd-002", topic: "icd10", difficulty: 2, type: "single",
    question: "Welcher ICD-10-Bereich kodiert In-situ-Neubildungen?",
    options: ["C00–C75", "D00–D09", "D10–D36", "D37–D48"],
    correct: [1],
    explanation: "D00–D09 = In-situ-Neubildungen. D10–D36 = gutartige Neubildungen, D37–D48 = Neubildungen unsicheren oder unbekannten Verhaltens.",
  },
  {
    id: "icd-003", topic: "icd10", difficulty: 2, type: "single",
    question: "Welcher ICD-10-Bereich kodiert Neubildungen unsicheren oder unbekannten Verhaltens?",
    options: ["D00–D09", "D10–D36", "D37–D48", "C76–C80"],
    correct: [2],
    explanation: "D37–D48 = Neubildungen unsicheren oder unbekannten Verhaltens. Dies entspricht in etwa der Verhaltenskodierung /1 der ICD-O-3.",
  },
  {
    id: "icd-004", topic: "icd10", difficulty: 2, type: "single",
    question: "Wofür stehen die Kodes C76–C80 der ICD-10?",
    options: [
      "Gutartige Neubildungen des Verdauungstrakts",
      "Bösartige Neubildungen ungenau bezeichneter, sekundärer und nicht näher bezeichneter Lokalisationen",
      "In-situ-Neubildungen der Haut",
      "Neubildungen des lymphatischen Gewebes",
    ],
    correct: [1],
    explanation: "C76–C80 umfassen bösartige Neubildungen ungenau bezeichneter, sekundärer (Metastasen) und nicht näher bezeichneter Lokalisationen, z. B. C80.9 = bösartige Neubildung ohne Angabe der Lokalisation (CUP).",
  },
  {
    id: "icd-005", topic: "icd10", difficulty: 3, type: "multi",
    question: "Welche Zuordnungen von ICD-10-Bereich zu Dignität sind korrekt?",
    options: [
      "C00–C97 → bösartig",
      "D00–D09 → in situ",
      "D10–D36 → gutartig",
      "D37–D48 → bösartig, metastasiert",
    ],
    correct: [0, 1, 2],
    explanation: "C = bösartig, D00–D09 = in situ, D10–D36 = gutartig, D37–D48 = unsicheres/unbekanntes Verhalten (nicht „bösartig metastasiert“ – Metastasen werden mit C77–C79 kodiert).",
  },

  // ===================== GRADING / RESIDUAL / ZUSATZ =====================
  {
    id: "gd-001", topic: "grading", difficulty: 1, type: "single",
    question: "Was beschreibt das Grading (G) eines Tumors?",
    options: [
      "Die anatomische Ausdehnung des Tumors",
      "Den Differenzierungsgrad des Tumorgewebes (Ähnlichkeit zum Ursprungsgewebe)",
      "Die Anzahl der Fernmetastasen",
      "Den Rest-Tumor nach Operation",
    ],
    correct: [1],
    explanation: "Das Grading beschreibt den histologischen Differenzierungsgrad. G1 = gut differenziert (tumorgewebe ähnelt Ursprungsgewebe), G3/G4 = schlecht/undifferenziert. Ausdehnung = TNM, Rest-Tumor = R-Klassifikation.",
  },
  {
    id: "gd-002", topic: "grading", difficulty: 2, type: "single",
    question: "Was bedeutet „G1“?",
    options: [
      "Undifferenziert (bösartigstes Erscheinungsbild)",
      "Gut differenziert",
      "Grading nicht bestimmbar",
      "Mäßig differenziert",
    ],
    correct: [1],
    explanation: "G1 = gut differenziert. G2 = mäßig, G3 = schlecht, G4 = undifferenziert, GX = Differenzierungsgrad nicht bestimmbar. Höheres G = größere Entdifferenzierung.",
  },
  {
    id: "gd-003", topic: "grading", difficulty: 2, type: "single",
    question: "Was bedeutet die Residualklassifikation „R0“?",
    options: [
      "Mikroskopischer Residualtumor",
      "Makroskopischer Residualtumor",
      "Kein Residualtumor (Tumor vollständig entfernt)",
      "Vorhandensein von Rezidiven",
    ],
    correct: [2],
    explanation: "R0 = kein Residualtumor (Resektionsränder tumorfrei). R1 = mikroskopischer Residualtumor, R2 = makroskopischer Residualtumor, RX = Vorhandensein nicht beurteilbar.",
  },
  {
    id: "gd-004", topic: "grading", difficulty: 2, type: "single",
    question: "Was bedeutet „R1“ in der Residualklassifikation?",
    options: [
      "Kein Residualtumor",
      "Mikroskopisch nachweisbarer Residualtumor",
      "Makroskopisch sichtbarer Residualtumor",
      "Rezidiv nach einem Jahr",
    ],
    correct: [1],
    explanation: "R1 = mikroskopischer Residualtumor (im Schnittrand histologisch Tumorzellen nachweisbar). R2 = makroskopisch verbliebener Tumor.",
  },
  {
    id: "gd-005", topic: "grading", difficulty: 3, type: "multi",
    question: "Welche Zusatzkodierungen zur TNM beschreiben eine Gefäß- bzw. Nerveninvasion?",
    options: [
      "L – Lymphgefäßinvasion (L0/L1)",
      "V – Veneninvasion (V0/V1/V2)",
      "Pn – perineurale Invasion (Pn0/Pn1)",
      "G – Gefäßinvasion (G0/G1)",
    ],
    correct: [0, 1, 2],
    explanation: "L = Lymphgefäßinvasion, V = Venen-(Blutgefäß-)invasion, Pn = perineurale Invasion. „G“ steht dagegen für das Grading (Differenzierungsgrad), nicht für Gefäßinvasion.",
  },
  {
    id: "gd-006", topic: "grading", difficulty: 3, type: "single",
    question: "Was beschreibt der C-Faktor (Certainty-Faktor) in der TNM-Klassifikation?",
    options: [
      "Die Zuverlässigkeit/Sicherheit der Klassifikation entsprechend den verwendeten diagnostischen Methoden",
      "Den Karzinom-Subtyp",
      "Die Zahl der befallenen Lymphknoten",
      "Die chemotherapeutische Ansprechrate",
    ],
    correct: [0],
    explanation: "Der C-Faktor (C1–C5) drückt aus, mit welcher diagnostischen Sicherheit die Klassifikation erfolgte – z. B. C1 = klinische Untersuchung, C4 = Operation/Pathologie, C5 = Autopsie.",
  },

  // ===================== KREBSREGISTER & MELDEWESEN =====================
  {
    id: "reg-001", topic: "register", difficulty: 2, type: "single",
    question: "Welcher Datensatz bildet die bundesweit einheitliche Grundlage der klinischen Krebsregistrierung?",
    options: [
      "Der DRG-Datensatz",
      "Der ADT/GEKID-Basisdatensatz (Onkologischer Basisdatensatz)",
      "Der ICD-10-GM-Datensatz",
      "Der OPS-Datensatz",
    ],
    correct: [1],
    explanation: "Der ADT/GEKID-Basisdatensatz ist der bundesweit einheitliche onkologische Basisdatensatz für die klinische Krebsregistrierung. Er definiert die zu meldenden Merkmale.",
  },
  {
    id: "reg-002", topic: "register", difficulty: 2, type: "single",
    question: "Wofür steht die Abkürzung „GEKID“?",
    options: [
      "Gesellschaft der epidemiologischen Krebsregister in Deutschland",
      "Gesamtverband der klinischen Datenverarbeitung",
      "Gemeinsame Erfassung klinischer Informationen und Diagnosen",
      "Gesellschaft für kurative Krebstherapie in Deutschland",
    ],
    correct: [0],
    explanation: "GEKID = Gesellschaft der epidemiologischen Krebsregister in Deutschland e. V. Zusammen mit der ADT verantwortet sie den ADT/GEKID-Basisdatensatz.",
  },
  {
    id: "reg-003", topic: "register", difficulty: 3, type: "single",
    question: "Welcher Paragraf des SGB V regelt die Förderung und Aufgaben der klinischen Krebsregister?",
    options: ["§ 63 SGB V", "§ 65c SGB V", "§ 137 SGB V", "§ 300 SGB V"],
    correct: [1],
    explanation: "§ 65c SGB V regelt die klinischen Krebsregister (eingeführt mit dem Krebsfrüherkennungs- und -registergesetz, KFRG, 2013), einschließlich Aufgaben und Finanzierung.",
  },
  {
    id: "reg-004", topic: "register", difficulty: 2, type: "multi",
    question: "Welche Ereignisse sind typische Meldeanlässe an das klinische Krebsregister?",
    options: [
      "Diagnosestellung einer Krebserkrankung",
      "Beginn und Abschluss einer tumorspezifischen Therapie (OP, Strahlen-, systemische Therapie)",
      "Verlauf/Nachsorge inkl. Statusänderung (z. B. Rezidiv, Progression)",
      "Tod des Patienten",
    ],
    correct: [0, 1, 2, 3],
    explanation: "Meldeanlässe sind u. a.: Diagnose, Therapiebeginn/-ende (operativ, strahlentherapeutisch, systemisch), Verlauf/Statusänderung und Tod. Sie bilden den onkologischen Krankheitsverlauf lückenlos ab.",
  },
  {
    id: "reg-005", topic: "register", difficulty: 3, type: "single",
    question: "Welche Institution führt auf Bundesebene die epidemiologischen Krebsregisterdaten zusammen (Zentrum für Krebsregisterdaten, ZfKD)?",
    options: [
      "Das Robert Koch-Institut (RKI)",
      "Das Paul-Ehrlich-Institut",
      "Der Gemeinsame Bundesausschuss (G-BA)",
      "Das Bundesinstitut für Arzneimittel und Medizinprodukte (BfArM)",
    ],
    correct: [0],
    explanation: "Das Zentrum für Krebsregisterdaten (ZfKD) ist am Robert Koch-Institut (RKI) angesiedelt und führt die Daten der epidemiologischen Landeskrebsregister zusammen.",
  },
  {
    id: "reg-006", topic: "register", difficulty: 2, type: "single",
    question: "Was ist das vorrangige Ziel der klinischen Krebsregistrierung?",
    options: [
      "Die Abrechnung von Krankenhausleistungen",
      "Die flächendeckende Erfassung des Behandlungsgeschehens zur Qualitätssicherung und Verbesserung der onkologischen Versorgung",
      "Die Erstellung von Arztbriefen",
      "Die Verwaltung von Medikamentenbeständen",
    ],
    correct: [1],
    explanation: "Klinische Krebsregister erfassen Diagnose, Therapie und Verlauf flächendeckend, um die Versorgungsqualität zu messen, zu vergleichen und zu verbessern (Qualitätssicherung).",
  },

  // ===================== EPIDEMIOLOGIE & STATISTIK =====================
  {
    id: "epi-001", topic: "epidemiologie", difficulty: 2, type: "single",
    question: "Was bezeichnet die „Inzidenz“?",
    options: [
      "Die Zahl der zu einem Zeitpunkt bestehenden Erkrankungsfälle",
      "Die Zahl der NEU aufgetretenen Erkrankungsfälle in einem definierten Zeitraum",
      "Den Anteil der an einer Krankheit Verstorbenen",
      "Die durchschnittliche Erkrankungsdauer",
    ],
    correct: [1],
    explanation: "Inzidenz = Anzahl der Neuerkrankungen in einer Population in einem bestimmten Zeitraum (z. B. pro Jahr). Sie beschreibt das Neuauftreten – im Gegensatz zur Prävalenz (Bestand).",
  },
  {
    id: "epi-002", topic: "epidemiologie", difficulty: 2, type: "single",
    question: "Was bezeichnet die „Prävalenz“?",
    options: [
      "Die Zahl der Neuerkrankungen pro Jahr",
      "Die Zahl bzw. der Anteil der zu einem bestimmten Zeitpunkt Erkrankten (Bestand)",
      "Die Sterberate der Gesamtbevölkerung",
      "Die Heilungsrate nach Therapie",
    ],
    correct: [1],
    explanation: "Prävalenz = Anzahl/Anteil der zu einem Zeitpunkt (oder in einem Zeitraum) an einer Krankheit Erkrankten (Bestand). Neuerkrankungen = Inzidenz.",
  },
  {
    id: "epi-003", topic: "epidemiologie", difficulty: 3, type: "single",
    question: "Worin unterscheiden sich Mortalität und Letalität?",
    options: [
      "Sie sind identisch.",
      "Mortalität bezieht die Todesfälle auf die Gesamtbevölkerung; Letalität bezieht die Todesfälle auf die an der Krankheit Erkrankten.",
      "Mortalität misst Heilungen, Letalität misst Neuerkrankungen.",
      "Letalität bezieht sich auf die Gesamtbevölkerung, Mortalität auf die Erkrankten.",
    ],
    correct: [1],
    explanation: "Mortalität = Sterbefälle (an einer Krankheit) bezogen auf die Gesamtbevölkerung. Letalität = Anteil der an der Krankheit Verstorbenen bezogen auf die Zahl der Erkrankten (Maß der „Tödlichkeit“).",
  },
  {
    id: "epi-004", topic: "epidemiologie", difficulty: 3, type: "single",
    question: "Was beschreibt das „relative Überleben“ in der Krebsepidemiologie?",
    options: [
      "Den Anteil der Patienten, die geheilt wurden",
      "Das Verhältnis des beobachteten Überlebens der Erkrankten zum erwarteten Überleben einer vergleichbaren Allgemeinbevölkerung",
      "Die absolute Zahl überlebender Patienten",
      "Das Überleben ausschließlich ohne Rezidiv",
    ],
    correct: [1],
    explanation: "Das relative Überleben setzt das beobachtete Überleben der Erkrankten ins Verhältnis zum erwarteten Überleben einer nach Alter/Geschlecht vergleichbaren Allgemeinbevölkerung. So wird das krebsspezifische Überleben näherungsweise ohne Kenntnis der Todesursache geschätzt.",
  },
  {
    id: "epi-005", topic: "epidemiologie", difficulty: 3, type: "single",
    question: "Warum werden Krebsraten häufig „altersstandardisiert“ angegeben?",
    options: [
      "Um die Raten größer erscheinen zu lassen",
      "Um Populationen mit unterschiedlicher Altersstruktur vergleichbar zu machen",
      "Weil das Alter der Patienten unbekannt ist",
      "Um nur junge Patienten zu erfassen",
    ],
    correct: [1],
    explanation: "Da Krebs stark altersabhängig ist, verzerren unterschiedliche Altersstrukturen den Vergleich roher Raten. Die Altersstandardisierung (z. B. auf eine Standardbevölkerung) macht Regionen/Zeiträume vergleichbar.",
  },
  {
    id: "epi-006", topic: "epidemiologie", difficulty: 1, type: "single",
    question: "Ein Register erfasst in einer Region mit 200.000 Einwohnern in einem Jahr 100 Neuerkrankungen. Wie hoch ist die rohe Inzidenzrate pro 100.000 Einwohner?",
    options: ["25 pro 100.000", "50 pro 100.000", "100 pro 100.000", "200 pro 100.000"],
    correct: [1],
    explanation: "Rate = (Neuerkrankungen / Bevölkerung) × 100.000 = (100 / 200.000) × 100.000 = 50 pro 100.000 Einwohner und Jahr.",
  },

  // ===================== METASTASIERUNG (Grundlagen/therapie-nah) =====================
  {
    id: "met-001", topic: "grundlagen", difficulty: 2, type: "multi",
    question: "Welche Ausbreitungswege der Metastasierung gibt es?",
    options: [
      "Lymphogen (über die Lymphbahnen)",
      "Hämatogen (über die Blutbahn)",
      "Kavitär / per continuitatem (über Körperhöhlen bzw. flächenhaft in Nachbarschaft)",
      "Neuronal-elektrisch (über Nervenimpulse)",
    ],
    correct: [0, 1, 2],
    explanation: "Tumoren metastasieren lymphogen, hämatogen und kavitär (Abtropf-/Abklatschmetastasen in Körperhöhlen) bzw. per continuitatem. Eine „neuronal-elektrische“ Metastasierung existiert nicht (Nerveninvasion = perineurale Ausbreitung, Pn).",
  },
  {
    id: "met-002", topic: "grundlagen", difficulty: 3, type: "single",
    question: "Wie wird eine Lymphknotenmetastase des Primärtumors in der Regel kodiert bzw. eingeordnet?",
    options: [
      "Als eigener Primärtumor mit /3",
      "Über die N-Kategorie (regionär) bzw. bei nicht-regionären Lymphknoten als Fernmetastase (M1)",
      "Immer als M1 unabhängig von der Lokalisation",
      "Sie wird nicht dokumentiert",
    ],
    correct: [1],
    explanation: "Metastasen in regionären Lymphknoten werden über die N-Kategorie erfasst. Befall nicht-regionärer (entfernter) Lymphknoten gilt als Fernmetastase (M1). Die Topografie einer Metastase erhält in ICD-O das Verhalten /6.",
  },

  // ===================== THERAPIE & VERLAUF =====================
  {
    id: "the-001", topic: "therapie", difficulty: 2, type: "single",
    question: "Was bedeutet „adjuvante“ Therapie?",
    options: [
      "Eine Therapie VOR der operativen Entfernung des Tumors",
      "Eine unterstützende Therapie NACH der Primärbehandlung (z. B. nach OP), um das Rückfallrisiko zu senken",
      "Eine rein schmerzlindernde Behandlung",
      "Eine Therapie ausschließlich bei Metastasen",
    ],
    correct: [1],
    explanation: "Adjuvant = ergänzend nach der Primärtherapie (meist nach OP), um verbliebene Tumorzellen zu bekämpfen und Rezidive zu verhindern. Neoadjuvant = vor der OP.",
  },
  {
    id: "the-002", topic: "therapie", difficulty: 2, type: "single",
    question: "Was bedeutet „neoadjuvante“ Therapie?",
    options: [
      "Therapie nach der Operation",
      "Therapie vor der geplanten Operation (z. B. zur Tumorverkleinerung)",
      "Nachsorgeuntersuchung",
      "Alternative Bezeichnung für Palliativtherapie",
    ],
    correct: [1],
    explanation: "Neoadjuvant = vor der eigentlichen (operativen) Primärtherapie, z. B. um den Tumor zu verkleinern (Downstaging) und operabel zu machen. Die anschließende Klassifikation trägt das Präfix „y“.",
  },
  {
    id: "the-003", topic: "therapie", difficulty: 1, type: "single",
    question: "Worin unterscheiden sich kurative und palliative Therapieintention?",
    options: [
      "Kurativ zielt auf Heilung; palliativ zielt auf Linderung/Lebensqualität ohne Heilungsanspruch.",
      "Kurativ und palliativ bedeuten dasselbe.",
      "Kurativ ist immer eine Operation, palliativ immer eine Chemotherapie.",
      "Palliativ zielt auf Heilung, kurativ auf Linderung.",
    ],
    correct: [0],
    explanation: "Kurative Therapie verfolgt das Ziel der Heilung. Palliative Therapie zielt – bei nicht heilbarer Erkrankung – auf Symptomlinderung, Lebensverlängerung und Erhalt der Lebensqualität.",
  },
  {
    id: "the-004", topic: "therapie", difficulty: 2, type: "multi",
    question: "Welche der folgenden zählen zu den systemischen (im ganzen Körper wirkenden) Tumortherapien?",
    options: [
      "Chemotherapie",
      "Strahlentherapie",
      "Hormon-(endokrine) Therapie",
      "Zielgerichtete Therapie / Immuntherapie",
    ],
    correct: [0, 2, 3],
    explanation: "Systemische Therapien wirken im ganzen Körper: Chemotherapie, endokrine (Hormon-)Therapie sowie zielgerichtete Therapie/Immuntherapie. Die Strahlentherapie ist dagegen – wie die Operation – ein lokales bzw. lokoregionäres Verfahren und zählt NICHT zu den systemischen Therapien. (Alle Verfahren werden im Register als Therapiemeldung erfasst.)",
  },
  {
    id: "the-005", topic: "therapie", difficulty: 2, type: "single",
    question: "Was versteht man unter einem „Rezidiv“?",
    options: [
      "Das erstmalige Auftreten eines Tumors",
      "Das erneute Auftreten der Tumorerkrankung nach einem krankheitsfreien Intervall",
      "Eine gutartige Neubildung",
      "Eine Nebenwirkung der Chemotherapie",
    ],
    correct: [1],
    explanation: "Ein Rezidiv ist das Wiederauftreten der Erkrankung nach zwischenzeitlicher Tumorfreiheit. Man unterscheidet z. B. Lokalrezidiv, regionäres Rezidiv und Fernmetastasen/Progress. In der TNM wird es mit dem Präfix „r“ gekennzeichnet.",
  },
  {
    id: "the-006", topic: "therapie", difficulty: 3, type: "single",
    question: "Was beschreibt das „Staging“ – im Unterschied zum „Grading“?",
    options: [
      "Staging = Differenzierungsgrad; Grading = Ausbreitung",
      "Staging = anatomische Ausbreitung (z. B. via TNM/Stadiengruppierung); Grading = Differenzierungsgrad des Gewebes",
      "Beide beschreiben die Ausbreitung",
      "Beide beschreiben die Differenzierung",
    ],
    correct: [1],
    explanation: "Staging beschreibt die anatomische Ausbreitung der Erkrankung (TNM → UICC-Stadien I–IV). Grading beschreibt den feingeweblichen Differenzierungsgrad (G1–G4). Beide sind prognostisch wichtig, aber verschieden.",
  },

  // ===================== DATENSCHUTZ & RECHT =====================
  {
    id: "ds-001", topic: "datenschutz", difficulty: 2, type: "multi",
    question: "Welche Aussagen zum Datenschutz in der Krebsregistrierung sind zutreffend?",
    options: [
      "Gesundheitsdaten gehören zu den besonders schützenswerten Datenkategorien (Art. 9 DSGVO).",
      "Für Meldung und Verarbeitung gelten enge gesetzliche Grundlagen (u. a. Landeskrebsregistergesetze, § 65c SGB V).",
      "Krebsregisterdaten dürfen frei und ohne Einschränkung veröffentlicht werden.",
      "Patientinnen und Patienten haben grundsätzlich Betroffenenrechte (z. B. Information, unter Umständen Widerspruch).",
    ],
    correct: [0, 1, 3],
    explanation: "Gesundheitsdaten sind nach Art. 9 DSGVO besonders geschützt; die Registrierung stützt sich auf gesetzliche Grundlagen (Landeskrebsregistergesetze, § 65c SGB V). Betroffenenrechte bestehen. Eine freie, uneingeschränkte Veröffentlichung ist unzulässig.",
  },
  {
    id: "ds-002", topic: "datenschutz", difficulty: 3, type: "single",
    question: "Wozu dient die Pseudonymisierung im epidemiologischen Krebsregister?",
    options: [
      "Zur endgültigen, unwiederbringlichen Löschung aller Personendaten",
      "Zur Trennung der Identitätsdaten von den medizinischen Daten, sodass ein direkter Personenbezug nur über einen gesicherten Schlüssel möglich ist",
      "Zur schnelleren Abrechnung",
      "Zur Veröffentlichung von Klarnamen in Statistiken",
    ],
    correct: [1],
    explanation: "Pseudonymisierung trennt Identitäts- von medizinischen Daten; ein Rückbezug ist nur über einen streng geschützten Schlüssel (z. B. Vertrauensstelle) möglich. Das ermöglicht Auswertungen bei gleichzeitigem Schutz der Betroffenen. Anonymisierung wäre unwiederbringlich – hier aber ist die Zusammenführung von Meldungen nötig.",
  },

  // ===================== RECHEN-/ANWENDUNGSAUFGABEN (numeric) =====================
  {
    id: "reg-007", topic: "register", difficulty: 2, type: "numeric",
    question: "Erstdiagnose war am 15.03.2020, das Sterbedatum am 15.09.2022. Wie viele volle Monate beträgt die Überlebenszeit?",
    answer: 30, tolerance: 0, unit: "Monate",
    explanation: "Von 03/2020 bis 03/2022 sind es 24 Monate, plus weitere 6 Monate bis 09/2022 = 30 Monate. Da beide Daten auf den 15. fallen, ist der letzte Monat voll. Die Überlebenszeit (Zeit von Diagnose bis Tod/letztem Kontakt) ist eine zentrale Kenngröße der Verlaufsdokumentation.",
  },
  {
    id: "reg-008", topic: "register", difficulty: 2, type: "numeric",
    question: "Eine Patientin ist am 12.06.1958 geboren. Die Erstdiagnose wurde am 12.03.2021 gestellt. Wie alt (in vollen Jahren) war sie bei Diagnose?",
    answer: 62, tolerance: 0, unit: "Jahre",
    explanation: "Im März 2021 hatte die Patientin ihren Geburtstag im Juni 2021 noch nicht erreicht. Ihr letzter Geburtstag war der 12.06.2020 (62. Geburtstag). Das Erkrankungsalter wird in vollen Jahren zum Diagnosedatum dokumentiert – hier 62 Jahre.",
  },
  {
    id: "epi-007", topic: "epidemiologie", difficulty: 2, type: "numeric",
    question: "In einer Region mit 200.000 Einwohnern werden in einem Jahr 50 Neuerkrankungen registriert. Wie hoch ist die rohe Inzidenzrate (pro 100.000 Einwohner)?",
    answer: 25, tolerance: 0, unit: "pro 100.000",
    explanation: "Rohe Inzidenzrate = (Neuerkrankungen ÷ Bevölkerung) × 100.000 = (50 ÷ 200.000) × 100.000 = 25 pro 100.000 Einwohner und Jahr. „Roh“ bedeutet ohne Altersstandardisierung – für Vergleiche zwischen Regionen wird meist zusätzlich altersstandardisiert.",
  },
  {
    id: "tnm-012", topic: "tnm", difficulty: 1, type: "numeric",
    question: "Bei einer Operation wurden 18 regionäre Lymphknoten entfernt und untersucht, 3 davon waren tumorbefallen. Wie viele der untersuchten Lymphknoten waren tumorfrei?",
    answer: 15, tolerance: 0, unit: "Lymphknoten",
    explanation: "18 untersuchte − 3 befallene = 15 tumorfreie Lymphknoten. Dokumentiert werden sowohl die Zahl der untersuchten als auch der befallenen Lymphknoten (z. B. als „3/18“). Diese Angabe fließt in die pN-Kategorie ein.",
  },
];

// Aktive Inhalte auflösen: FREIGESCHALTETE (lokal gecachte) Inhalte haben Vorrang,
// sonst die öffentlichen Beispiel-Inhalte. So enthält die öffentliche App-Hülle keine
// geschützten Fragen – die kommen erst nach Zugangscode aus Supabase und liegen dann
// nur lokal im Cache dieses Geräts.
if (typeof window !== "undefined") {
  window.ADT_SAMPLE = { TOPICS: SAMPLE_TOPICS, QUESTIONS: SAMPLE_QUESTIONS };
  var __active = window.ADT_SAMPLE;
  try {
    var __ls = window.localStorage;
    var __raw = __ls && __ls.getItem("adt_content_v1");
    if (__raw) {
      var __g = JSON.parse(__raw);
      if (__g && __g.TOPICS && Array.isArray(__g.QUESTIONS) && __g.QUESTIONS.length) __active = __g;
    }
  } catch (e) {}
  window.TOPICS = __active.TOPICS;
  window.QUESTIONS = __active.QUESTIONS;
}
