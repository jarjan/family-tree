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
    notes: "Notes"
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
    notes: "Жазбалар"
  }
};

export let currentLanguage = 'en';

export function setLanguage(lang) {
  currentLanguage = lang;
}

export function t(key) {
  return dictionaries[currentLanguage]?.[key] || dictionaries['en'][key] || key;
}
