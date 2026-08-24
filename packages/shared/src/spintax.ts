/**
 * Spintax parsing engine for anti-ban message variation.
 * Resolves nested {option1|option2|{sub1|sub2}} templates recursively.
 */

export function parseSpintax(template: string, rng: () => number = Math.random): string {
  if (!template || !template.includes("{") || !template.includes("}")) {
    return template;
  }

  // Regex to match innermost {option1|option2|...} patterns containing at least one pipe '|'
  const spintaxPattern = /\{([^{}]*\|[^{}]*)\}/;

  let current = template;
  let match = spintaxPattern.exec(current);

  while (match) {
    const options = match[1].split("|");
    const selectedIndex = Math.floor(rng() * options.length);
    const chosen = options[selectedIndex] ?? options[0];

    current = current.slice(0, match.index) + chosen + current.slice(match.index + match[0].length);
    match = spintaxPattern.exec(current);
  }

  return current;
}
