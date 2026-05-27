import type { CommonPattern } from './types'

export const COMMON_PATTERNS: CommonPattern[] = [
  {
    name: 'Email',
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    flags: ['g', 'm'],
    testString:
      'user@example.com\ninvalid@\nhello.world+tag@sub.domain.org\nnot-an-email',
  },
  {
    name: 'URL',
    pattern: 'https?:\\/\\/[^\\s/$.?#].[^\\s]*',
    flags: ['g'],
    testString:
      'Visit https://example.com or http://sub.domain.org/path?q=1 for more info.',
  },
  {
    name: 'Phone (US)',
    pattern: '\\(?(\\d{3})\\)?[-.\\s]?(\\d{3})[-.\\s]?(\\d{4})',
    flags: ['g'],
    testString:
      'Call (555) 123-4567 or 555.987.6543 or 555-000-1111 today.',
  },
  {
    name: 'IPv4',
    pattern: '\\b(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\b',
    flags: ['g'],
    testString: 'Servers: 192.168.1.1, 10.0.0.255, 999.999.999.999',
  },
  {
    name: 'Date (YYYY-MM-DD)',
    pattern: '(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])',
    flags: ['g'],
    testString: 'Dates: 2024-01-15, 2023-12-31, 2025-13-01 (invalid month)',
  },
  {
    name: 'Hex Color',
    pattern: '#([0-9a-fA-F]{3}){1,2}\\b',
    flags: ['g'],
    testString: 'Colors: #fff, #aabbcc, #123456, #ggg (invalid)',
  },
  {
    name: 'HTML Tag',
    pattern: '<([a-z][a-z0-9]*)\\b[^>]*>(.*?)<\\/\\1>',
    flags: ['g'],
    testString: '<div class="main">Hello</div> and <p>World</p>',
  },
  {
    name: 'CSS Class',
    pattern: '\\.([a-zA-Z_][\\w-]*)',
    flags: ['g'],
    testString: '.container { } .my-class { } .btn_primary { }',
  },
]
