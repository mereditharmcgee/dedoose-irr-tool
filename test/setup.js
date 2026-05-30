// Tests run in Node, where DOMParser is not a global. The parser uses the
// browser-native DOMParser in production; here we polyfill it with the
// lightweight @xmldom/xmldom (a devDependency only — it never ships).
import { DOMParser } from '@xmldom/xmldom';

if (!globalThis.DOMParser) {
  globalThis.DOMParser = DOMParser;
}
