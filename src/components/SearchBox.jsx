import { useMemo, useRef, useState } from "preact/hooks";
import { useT } from "../utils/i18n.js";
import "./SearchBox.css";

const MAX_RESULTS = 8;

const fullName = (p) => [p.name, p.lastName].filter(Boolean).join(" ");
const normalize = (s) => s.toLocaleLowerCase("kk").trim();

export function SearchBox({ data, onSelect }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  const entries = useMemo(() => {
    const byId = new Map(data.map((d) => [d.id, d]));
    return data.map((person) => {
      const father = person.fatherId ? byId.get(person.fatherId) : null;
      const spouse = person.spouseOf ? byId.get(person.spouseOf) : null;
      return {
        person,
        haystack: normalize(fullName(person)),
        // Disambiguates people with the same name
        hint: father ? `← ${father.name}` : spouse ? `⚭ ${spouse.name}` : "",
      };
    });
  }, [data]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return entries
      .filter((e) => e.haystack.includes(q))
      .sort((a, b) => Number(!a.haystack.startsWith(q)) - Number(!b.haystack.startsWith(q)))
      .slice(0, MAX_RESULTS);
  }, [entries, query]);

  const choose = (entry) => {
    onSelect(entry.person.id, { open: true });
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault();
      choose(results[activeIdx]);
    } else if (e.key === "Escape") {
      setQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const showList = isOpen && query.trim() !== "";

  return (
    <div className="search-box">
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        role="combobox"
        aria-expanded={showList}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={showList && results[activeIdx] ? `search-result-${activeIdx}` : undefined}
        value={query}
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          setActiveIdx(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id="search-results" className="search-results glass" role="listbox">
          {results.length === 0 && <li className="search-empty">{t("noResults")}</li>}
          {results.map((entry, i) => (
            <li
              key={entry.person.id}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              className={`search-result ${i === activeIdx ? "active" : ""}`}
              // mousedown (not click) so it fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                choose(entry);
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="search-name">{fullName(entry.person)}</span>
              {entry.hint && <span className="search-hint">{entry.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
