/** A Request to a fixed test URL, optionally carrying headers such as Authorization */
export function createMockHttpRequest(headers?: HeadersInit): Request {
   return new Request('http://localhost/api/test', { headers });
}
