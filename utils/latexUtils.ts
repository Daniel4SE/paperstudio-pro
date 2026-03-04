export const PHYSICS_MACROS = {
  "\\bra": "\\langle #1 |",
  "\\ket": "| #1 \\rangle",
  "\\braket": "\\langle #1 | #2 \\rangle",
  "\\op": "\\hat{#1}",
  "\\abs": "\\left| #1 \\right|",
  "\\order": "\\mathcal{O}\\left(#1\\right)",
  "\\vb": "\\mathbf{#1}",
  "\\dd": "\\mathrm{d}",
  "\\dv": "\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}",
  "\\pdv": "\\frac{\\partial #1}{\\partial #2}",
  "\\grad": "\\nabla",
  "\\div": "\\nabla \\cdot",
  "\\curl": "\\nabla \\times",
  "\\laplacian": "\\nabla^2",
};

export const extractMacros = (content: string): Record<string, any> => {
  const macros: Record<string, any> = {};

  // 1. Detect Packages
  // Simulating the 'physics' package which is popular in KaTeX environments
  if (content.match(/\\usepackage\s*(\[.*\])?\s*\{physics\}/)) {
    Object.assign(macros, PHYSICS_MACROS);
  }

  // 2. Parse \newcommand
  // Regex: \newcommand{\name}[args]{definition}
  // We handle simple cases here. Nested braces are hard for regex.
  const newCommandRegex = /\\newcommand\s*\{\s*(\\[a-zA-Z@]+)\s*\}\s*(\[(\d)\])?\s*\{([^}]+)\}/g;
  let match;
  while ((match = newCommandRegex.exec(content)) !== null) {
    const name = match[1];
    const numArgs = match[3] ? parseInt(match[3]) : 0;
    const definition = match[4];
    
    // KaTeX macros can be strings or functions, but passing string with #1 #2 usually works for simple cases
    macros[name] = definition;
  }
  
  // 3. Parse \def
  const defRegex = /\\def\s*(\\[a-zA-Z@]+)\s*\{([^}]+)\}/g;
  while ((match = defRegex.exec(content)) !== null) {
    macros[match[1]] = match[2];
  }

  return macros;
};