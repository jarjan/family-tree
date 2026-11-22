// Small display helpers shared by the components.

/** "Name LastName", or just the name when there is no last name. */
export const fullName = (person) => [person.name, person.lastName].filter(Boolean).join(" ");

/** Two-letter initials for avatars: first letters of name and last name, else the name's first two. */
export const getInitials = (person) =>
  (person.lastName ? person.name[0] + person.lastName[0] : person.name.slice(0, 2)).toUpperCase();

/** Joins the truthy class names: cx("a", cond && "b") -> "a b". */
export const cx = (...classes) => classes.filter(Boolean).join(" ");
