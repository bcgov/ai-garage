export function normalize(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

export function matchesPrefix(file, prefixes) {
  const f = normalize(file);
  return (prefixes || []).some((raw) => {
    const prefix = normalize(raw).replace(/\/$/, "");
    if (!prefix) return false;
    return f === prefix || f.startsWith(prefix + "/");
  });
}

export function anyMatch(files, prefixes) {
  return (files || []).some((f) => matchesPrefix(f, prefixes));
}
