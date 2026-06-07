export const dictionaries = {
  en: {
    appTitle: "Family Tree Heritage",
    searchPlaceholder: "Search family member...",
    detailsTitle: "Personal Details",
    born: "Born",
    died: "Died",
    parent: "Parent",
    children: "Children",
    noBio: "No biography available.",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    zoomInOut: "Zoom In/Out",
    resetZoom: "Reset",
    gender: "Gender",
    male: "Male",
    female: "Female",
    spouse: "Spouse",
    notes: "Notes",
    father: "Father",
    mother: "Mother",
    siblings: "Siblings",
    cousins: "First Cousins",
    grandparents: "Grandparents",
    paternalSide: "Paternal Side",
    maternalSide: "Maternal Side",
    unclesAunts: "Uncles & Aunts",
    grandchildren: "Grandchildren",
    spouseParents: "Spouse's Parents",
    spouseSiblings: "Spouse's Siblings",
  },
  kk: {
    appTitle: "Шежіре",
    searchPlaceholder: "Туысты іздеу...",
    detailsTitle: "Жеке деректер",
    born: "Туған жылы",
    died: "Қайтыс болған жылы",
    parent: "Ата-анасы",
    children: "Балалары",
    noBio: "Өмірбаяны жоқ.",
    zoomIn: "Үлкейту",
    zoomOut: "Кішірейту",
    zoomInOut: "Үлкейту/Кішірейту",
    resetZoom: "Қайтару",
    gender: "Жынысы",
    male: "Ер",
    female: "Әйел",
    spouse: "Жұбайы",
    notes: "Жазбалар",
    father: "Әкесі",
    mother: "Анасы",
    siblings: "Бауырлары",
    cousins: "Бөле-жиендері",
    grandparents: "Ата-әжелері",
    paternalSide: "Әке жағы",
    maternalSide: "Ана жағы",
    unclesAunts: "Әке-ана бауырлары",
    grandchildren: "Немерелері",
    spouseParents: "Жұбайының ата-анасы",
    spouseSiblings: "Жұбайының бауырлары",
  },
};

export let currentLanguage = "kk";

export function setLanguage(lang) {
  currentLanguage = lang;
}

export function t(key) {
  return dictionaries[currentLanguage]?.[key] || dictionaries["en"][key] || key;
}
