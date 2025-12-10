export interface TestCase {
  description: string;
  code: string;
  config: { paths: string[] };
  shouldError: boolean;
  errorPattern?: RegExp;
}

export const testCases: TestCase[] = [
  // Pattern 1: Optional chaining
  {
    description: 'should error on process?.env.API_KEY',
    code: 'const x = process?.env.API_KEY;',
    config: { paths: ['process.env'] },
    shouldError: true,
    errorPattern: /Optional chaining with 'process\.env' is unsafe/,
  },
  {
    description: 'should error on process.env?.API_KEY',
    code: 'const x = process.env?.API_KEY;',
    config: { paths: ['process.env'] },
    shouldError: true,
    errorPattern: /Optional chaining with 'process\.env' is unsafe/,
  },
  {
    description: 'should not error on direct access process.env.API_KEY',
    code: 'const x = process.env.API_KEY;',
    config: { paths: ['process.env'] },
    shouldError: false,
  },

  // Pattern 2: Destructuring with optional chaining
  {
    description: 'should error on destructuring with optional chaining',
    code: 'const { API_KEY } = process?.env;',
    config: { paths: ['process.env'] },
    shouldError: true,
    errorPattern: /Destructuring with optional chaining on 'process\.env' is unsafe/,
  },

  // Pattern 3: Pure destructuring
  {
    description: 'should error on const { env } = process',
    code: 'const { env } = process;',
    config: { paths: ['process.env'] },
    shouldError: true,
    errorPattern: /Destructuring 'process\.env' is unsafe/,
  },
  {
    description: 'should not error on const { API_KEY } = process.env',
    code: 'const { API_KEY } = process.env;',
    config: { paths: ['process.env'] },
    shouldError: false,
  },
  {
    description: 'should error on const { host } = process.env when config is process.env.host',
    code: 'const { host } = process.env;',
    config: { paths: ['process.env.host'] },
    shouldError: true,
    errorPattern: /Destructuring 'process\.env\.host' is unsafe/,
  },

  // import.meta.env
  {
    description: 'should error on import.meta?.env.MODE',
    code: 'const x = import.meta?.env.MODE;',
    config: { paths: ['import.meta.env'] },
    shouldError: true,
    errorPattern: /Optional chaining with 'import\.meta\.env' is unsafe/,
  },
  {
    description: 'should error on import.meta.env?.MODE',
    code: 'const x = import.meta.env?.MODE;',
    config: { paths: ['import.meta.env'] },
    shouldError: true,
    errorPattern: /Optional chaining with 'import\.meta\.env' is unsafe/,
  },
  {
    description: 'should not error on direct access import.meta.env.MODE',
    code: 'const x = import.meta.env.MODE;',
    config: { paths: ['import.meta.env'] },
    shouldError: false,
  },
  {
    description: 'should error on const { env } = import.meta',
    code: 'const { env } = import.meta;',
    config: { paths: ['import.meta.env'] },
    shouldError: true,
    errorPattern: /Destructuring 'import\.meta\.env' is unsafe/,
  },

  // No config cases
  {
    description: 'should not error when config paths is empty',
    code: 'const x = process?.env.API_KEY;',
    config: { paths: [] },
    shouldError: false,
  },

  // Multiple paths
  {
    description: 'should error with multiple configured paths',
    code: 'const x = import.meta?.env.MODE;',
    config: { paths: ['process.env', 'import.meta.env'] },
    shouldError: true,
    errorPattern: /Optional chaining with 'import\.meta\.env' is unsafe/,
  },

  // Optional chaining on method calls (should NOT error)
  {
    description: 'should not error on optional method call: process.env.mock_boolean?.toString()',
    code: 'const a = process.env.mock_boolean?.toString();',
    config: { paths: ['process'] },
    shouldError: false,
  },
  {
    description: 'should not error on optional method call: process.env.API_KEY?.toLowerCase()',
    code: 'const a = process.env.API_KEY?.toLowerCase();',
    config: { paths: ['process.env'] },
    shouldError: false,
  },
];
